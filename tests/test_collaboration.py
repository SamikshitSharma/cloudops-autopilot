import pytest
from datetime import datetime
from backend.app.workflow.coordinator import WorkflowCoordinator
from backend.app.workflow.models import WorkflowStatus, StepStatus
from agents import GoogleADKOrchestrator
from agents.shared import MessageType, AgentMessage, TraceStatus

@pytest.mark.asyncio
async def test_reasoning_scenarios_success():
    """Verify that successful scenarios propagate context and complete successfully."""
    coordinator = WorkflowCoordinator()
    
    # 1. Idle VM Scenario
    run_idle = await coordinator.run_autopilot_reasoning(run_id="run-idle-demo", scenario_name="idle_vm")
    assert run_idle.status == WorkflowStatus.COMPLETED
    assert run_idle.steps[0].status == StepStatus.COMPLETED  # Telemetry
    assert run_idle.steps[4].status == StepStatus.COMPLETED  # Decision
    assert run_idle.steps[7].status == StepStatus.COMPLETED  # Audit
    
    # 2. Overprovisioned VM Scenario
    run_over = await coordinator.run_autopilot_reasoning(run_id="run-over-demo", scenario_name="overprovisioned_vm")
    assert run_over.status == WorkflowStatus.COMPLETED
    
    # 3. High CPU VM Scenario (Compliant, no action required, subsequent steps skipped, audit completes)
    run_high = await coordinator.run_autopilot_reasoning(run_id="run-high-demo", scenario_name="high_cpu_vm")
    assert run_high.status == WorkflowStatus.COMPLETED
    assert run_high.steps[2].status == StepStatus.SKIPPED      # FinOps skipped
    assert run_high.steps[7].status == StepStatus.COMPLETED    # Audit completes

@pytest.mark.asyncio
async def test_conflicting_recommendations_resolution():
    """Verify conflict resolution: DecisionAgent selects resize over stop for production VM."""
    coordinator = WorkflowCoordinator()
    
    run = await coordinator.run_autopilot_reasoning(run_id="run-conflict-demo", scenario_name="conflicting_recommendations")
    
    # The VM is production, so decision should block on approval
    assert run.status == WorkflowStatus.BLOCKED_ON_APPROVAL
    assert run.approval_request is not None
    assert run.approval_request.action_type == "resize"  # Resolved: select resize over stop
    
    # Let's inspect the action plan
    plan = run.approval_request.recommendation_id # It matches f"reco-{resource_id}"
    
    # Resume by granting approval
    await coordinator.grant_approval(run.id, token="token-12345")
    assert run.status == WorkflowStatus.RUNNING

@pytest.mark.asyncio
async def test_failure_simulations():
    """Verify correct step/workflow failures under mock scenario gates."""
    from backend.app.database import SessionLocal
    from backend.app.models.resource import Resource as DBResource
    from backend.app.models.recommendation import Recommendation as DBRecommendation
    with SessionLocal() as db:
        res = db.query(DBResource).filter(DBResource.id == "vm-strict-01").first()
        if res:
            res.tags = {"env": "dev", "policy": "no-stop"}
        else:
            res = DBResource(
                id="vm-strict-01",
                provider_id="/subscriptions/000/providers/Microsoft.Compute/virtualMachines/vm-strict-01",
                name="vm-strict-01",
                type="VirtualMachine",
                region="eastus",
                status="running",
                tags={"env": "dev", "policy": "no-stop"}
            )
            db.add(res)
        db.query(DBRecommendation).filter(DBRecommendation.resource_id == "vm-strict-01").delete()
        
        fail_res = db.query(DBResource).filter(DBResource.id == "vm-fail-01").first()
        if fail_res:
            fail_res.tags = {"Environment": "Dev"}
        else:
            fail_res = DBResource(
                id="vm-fail-01",
                provider_id="/subscriptions/000/providers/Microsoft.Compute/virtualMachines/vm-fail-01",
                name="vm-fail-01",
                type="VirtualMachine",
                region="eastus",
                status="running",
                tags={"Environment": "Dev"}
            )
            db.add(fail_res)
            
        db.commit()
            
    coordinator = WorkflowCoordinator()
    
    # 1. Missing Telemetry
    run_missing = await coordinator.run_autopilot_reasoning(run_id="run-missing-demo", scenario_name="missing_telemetry")
    assert run_missing.status == WorkflowStatus.FAILED
    assert run_missing.steps[0].status == StepStatus.FAILED # Failed at Telemetry Collection
    
    # 2. Policy Rejection
    run_policy = await coordinator.run_autopilot_reasoning(run_id="run-policy-demo", scenario_name="policy_rejection")
    # Coordinator handles policy check failure by terminating execution (policy step failed)
    assert run_policy.status == WorkflowStatus.FAILED or any(s.status == StepStatus.FAILED for s in run_policy.steps)
    policy_step = next(s for s in run_policy.steps if s.id == "policy_check")
    assert policy_step.status == StepStatus.FAILED
    
    # 3. Low Confidence
    run_conf = await coordinator.run_autopilot_reasoning(run_id="run-conf-demo", scenario_name="low_confidence")
    # Low confidence should fail/reject before execution planning
    assert run_conf.status == WorkflowStatus.FAILED or any(s.status == StepStatus.FAILED for s in run_conf.steps)
    exec_step = next(s for s in run_conf.steps if s.id == "execution_planning")
    assert exec_step.status == StepStatus.FAILED
    
    # 4. Verification Failure
    run_verif = await coordinator.run_autopilot_reasoning(run_id="run-verif-demo", scenario_name="verification_failure")
    assert run_verif.status == WorkflowStatus.FAILED
    verif_step = next(s for s in run_verif.steps if s.id == "post_verification")
    assert verif_step.status == StepStatus.FAILED
    
    # 5. Workflow Timeout
    run_timeout = await coordinator.run_autopilot_reasoning(run_id="run-timeout-demo", scenario_name="timeout")
    assert run_timeout.status == WorkflowStatus.FAILED
    assert run_timeout.steps[0].status == StepStatus.FAILED

@pytest.mark.asyncio
async def test_explainability_and_confidence_propagation():
    """Verify parent trace linkages, explanation payload extraction, and confidence scaling."""
    # Run a quick session manually to inspect details
    orchestrator = GoogleADKOrchestrator()
    session = orchestrator.create_session()
    
    # Invoke Telemetry
    t_msg = AgentMessage(
        sender="client",
        message_type=MessageType.TELEMETRY_REQUEST,
        payload={"resource_group": "test-rg", "scenario_name": "idle_vm"}
    )
    t_resp = await orchestrator.invoke_agent(session.session_id, "telemetry_agent", t_msg)
    
    # Invoke Analysis
    a_msg = AgentMessage(
        sender="client",
        message_type=MessageType.ANALYSIS_REQUEST,
        payload={"min_cpu_threshold": 10.0},
        confidence_score=t_resp.confidence_score
    )
    a_resp = await orchestrator.invoke_agent(session.session_id, "analysis_agent", a_msg)
    
    # Check trace tree linkage
    traces = orchestrator.get_session_traces(session.session_id)
    assert len(traces) == 4
    
    # trace 0: Telemetry thought
    # trace 1: Telemetry success
    # trace 2: Analysis thought
    # trace 3: Analysis success
    
    assert traces[1].parent_trace_id == traces[0].trace_id
    assert traces[2].parent_trace_id == traces[1].trace_id
    assert traces[3].parent_trace_id == traces[2].trace_id
    
    # Check confidence propagation scaling
    # Telemetry conf = 1.0. Analysis conf = 1.0 * 0.95 = 0.95
    assert a_resp.confidence_score == pytest.approx(0.95)
    assert traces[3].explanation is not None
    assert traces[3].explanation.confidence_score == pytest.approx(0.95)
    assert len(traces[3].explanation.assumptions) > 0
    assert traces[3].explanation.next_agent == "finops_agent"
