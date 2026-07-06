import pytest
from datetime import datetime
from unittest.mock import AsyncMock
from backend.app.workflow.coordinator import WorkflowCoordinator
from backend.app.workflow.models import WorkflowStatus, StepStatus, WorkflowRun
from backend.app.database import SessionLocal
from backend.app.models.recommendation import Recommendation as DBRecommendation
from backend.app.models.run import AuditLog as DBAuditLog
from agents import GoogleADKOrchestrator, ExecutiveOrchestratorAgent
from agents.shared import MessageType, AgentMessage, global_registry

@pytest.mark.asyncio
async def test_executive_goal_planning():
    """Verify that different objectives map to different strategies (participating steps) and deduce_objective behaves correctly."""
    executive = global_registry.lookup("executive_orchestrator_agent")
    if not executive:
        executive = ExecutiveOrchestratorAgent()

    # Test deduced objectives
    assert executive.deduce_objective("idle_vm") == "Reduce Monthly Cost"
    assert executive.deduce_objective("scaling_recommendation") == "Improve Availability"
    assert executive.deduce_objective("missing_telemetry") == "Investigate Incident"
    assert executive.deduce_objective("unknown_scenario") == "Optimize Azure Subscription"

    # Test participating steps for each strategy
    cost_steps = executive.get_participating_steps("Reduce Monthly Cost")
    assert "finops_evaluation" in cost_steps
    assert "policy_check" not in cost_steps

    availability_steps = executive.get_participating_steps("Improve Availability")
    assert "policy_check" in availability_steps
    assert "finops_evaluation" not in availability_steps

    investigate_steps = executive.get_participating_steps("Investigate Incident")
    assert "telemetry_collection" in investigate_steps
    assert "resource_analysis" in investigate_steps
    assert "audit_logging" in investigate_steps
    assert len(investigate_steps) == 3

@pytest.mark.asyncio
async def test_executive_agent_selection():
    """Verify that non-participating steps are marked as SKIPPED, demonstrating agent selection capability."""
    coordinator = WorkflowCoordinator()
    
    # Trigger run with a specific objective that limits participating steps, e.g. "Investigate Incident"
    run = await coordinator.run_autopilot_reasoning(
        run_id="run-selection-test",
        scenario_name="idle_vm",
        objective="Investigate Incident"
    )

    assert run.status == WorkflowStatus.COMPLETED
    
    # "Investigate Incident" only runs: telemetry_collection, resource_analysis, audit_logging
    # All other steps must be marked SKIPPED.
    expected_statuses = {
        "telemetry_collection": StepStatus.COMPLETED,
        "resource_analysis": StepStatus.COMPLETED,
        "finops_evaluation": StepStatus.SKIPPED,
        "policy_check": StepStatus.SKIPPED,
        "decision_making": StepStatus.SKIPPED,
        "execution_planning": StepStatus.SKIPPED,
        "post_verification": StepStatus.SKIPPED,
        "audit_logging": StepStatus.COMPLETED,
    }

    for step in run.steps:
        assert step.status == expected_statuses[step.id], f"Step {step.id} has incorrect status {step.status}"

@pytest.mark.asyncio
async def test_executive_conflict_resolution():
    """Verify that conflict between Stop (Telemetry) and Resize (FinOps) resolves to Resize for Production VM."""
    coordinator = WorkflowCoordinator()
    
    run = await coordinator.run_autopilot_reasoning(
        run_id="run-conflict-test",
        scenario_name="conflicting_recommendations"
    )
    
    # Conflict resolution chooses "resize" over "stop" to preserve production VM availability.
    # The VM is production, so it blocks on approval.
    assert run.status == WorkflowStatus.BLOCKED_ON_APPROVAL
    assert run.approval_request is not None
    assert run.approval_request.action_type == "resize"
    assert run.action_plan is None

    # Clean up by granting approval so the test run finishes cleanly
    await coordinator.grant_approval(run.id, token="token-conflict-approved")
    assert run.status == WorkflowStatus.RUNNING

@pytest.mark.asyncio
async def test_executive_retry_handling(monkeypatch):
    """Verify retry handling when a transient error is encountered during a step."""
    coordinator = WorkflowCoordinator()
    
    original_invoke_mcp = coordinator.invoke_mcp_tool
    call_counts = {"get_telemetry": 0}
    retrying_events = []

    async def mock_invoke_mcp_tool(tool_name: str, **kwargs):
        if tool_name == "get_telemetry":
            call_counts["get_telemetry"] += 1
            if call_counts["get_telemetry"] == 1:
                # Raise transient error on the first call
                raise ValueError("Transient error: Azure API rate limit exceeded")
        return await original_invoke_mcp(tool_name, **kwargs)

    async def on_retry_event(payload):
        retrying_events.append(payload)

    # Subscribe to WorkflowStepRetrying events
    coordinator.event_bus.subscribe("WorkflowStepRetrying", on_retry_event)
    monkeypatch.setattr(coordinator, "invoke_mcp_tool", mock_invoke_mcp_tool)

    run = await coordinator.run_autopilot_reasoning(
        run_id="run-retry-test",
        scenario_name="idle_vm"
    )

    # Assert that the run completed successfully after retry
    assert run.status == WorkflowStatus.COMPLETED
    
    # Check that get_telemetry was called twice (first time failed, second time succeeded)
    assert call_counts["get_telemetry"] == 2
    
    # Assert that we received a retry event on the event bus
    assert len(retrying_events) == 1
    assert retrying_events[0]["step_id"] == "telemetry_collection"
    assert retrying_events[0]["attempt"] == 1

@pytest.mark.asyncio
async def test_executive_partial_failures():
    """Verify partial failure handling where one VM optimization fails and rolls back, but another succeeds."""
    coordinator = WorkflowCoordinator()
    
    run = await coordinator.run_autopilot_reasoning(
        run_id="run-partial-failure-test",
        scenario_name="partial_failure"
    )

    # Workflow completes successfully overall (handles failure gracefully)
    assert run.status == WorkflowStatus.COMPLETED
    
    # Check that the database contains the correct status updates
    with SessionLocal() as db:
        # Check audit logs for the partial failure log
        audit_logs = db.query(DBAuditLog).filter(DBAuditLog.run_id == "run-partial-failure-test").all()
        audit_payloads = [log.payload for log in audit_logs if log.step_name == "Tool:audit_run" and log.event_type == "ToolStarted"]
        
        # Verify the audit log payload contains the rollback / partial success details
        assert len(audit_payloads) > 0
        final_audit = audit_payloads[-1]
        assert final_audit["inputs"]["log_payload"]["status"] == "partial_success"
        
        partial_failures = final_audit["inputs"]["log_payload"]["partial_failures"]
        assert len(partial_failures) == 1
        assert partial_failures[0]["resource_id"] == "vm-fail-01"
        assert "rollback_status" in partial_failures[0]
        assert partial_failures[0]["rollback_status"] == "success"

        # Check recommendation status in the database
        db_reco = db.query(DBRecommendation).filter(DBRecommendation.id == "reco-vm-fail-01").first()
        assert db_reco is not None
        assert db_reco.status == "partially_executed"

@pytest.mark.asyncio
async def test_executive_successful_execution_plan():
    """Verify that a successful run populates a proper action plan and final execution plan details."""
    from backend.app.database import SessionLocal
    from backend.app.models.resource import Resource as DBResource
    with SessionLocal() as db:
        db_res = db.query(DBResource).filter(DBResource.id == "vm-over-01").first()
        if db_res:
            db_res.tags = {"Environment": "Dev"}
            db.commit()
            
    coordinator = WorkflowCoordinator()
    
    run = await coordinator.run_autopilot_reasoning(
        run_id="run-success-plan-test",
        scenario_name="overprovisioned_vm"
    )
    
    assert run.status == WorkflowStatus.COMPLETED
    assert run.action_plan is not None
    assert run.action_plan.resource_id == "vm-over-01"
    assert run.action_plan.action_type == "resize"
    assert run.action_plan.risk_level == "low"
    assert run.action_plan.approval_required is False
