import pytest
import uuid
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models.workflow import SequentialWorkflow, WorkflowStage, WorkflowEventLog
from backend.app.models.run import Run as DBRun
from backend.app.models.resource import Resource as DBResource
from backend.app.schemas.workflow import WorkflowContext
from backend.app.workflow.policy_evaluator import PolicyEvaluator
from backend.app.workflow.sequential_orchestrator import sequential_orchestrator_engine

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- POLICY EVALUATION TESTS ---

def test_policy_evaluation_idle_non_prod(db_session):
    # Setup test resource
    res_id = "test-vm-dev"
    db_res = db_session.query(DBResource).filter(DBResource.id == res_id).first()
    if not db_res:
        db_res = DBResource(
            id=res_id,
            provider_id="/subscriptions/000/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/test-vm-dev",
            name=res_id,
            type="Microsoft.Compute/virtualMachines",
            region="eastus",
            status="Running",
            tags={"Environment": "Dev"}
        )
        db_session.add(db_res)
        db_session.commit()

    evaluation = PolicyEvaluator.evaluate_resource_remediation(
        db=db_session,
        resource_id=res_id,
        proposed_action="stop"
    )

    assert evaluation["compliant"] is True
    assert evaluation["requires_approval"] is False
    assert "compliant" in evaluation["reason"].lower()

def test_policy_evaluation_never_stop(db_session):
    res_id = "test-vm-neverstop"
    db_res = db_session.query(DBResource).filter(DBResource.id == res_id).first()
    if not db_res:
        db_res = DBResource(
            id=res_id,
            provider_id="/subscriptions/000/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/test-vm-neverstop",
            name=res_id,
            type="Microsoft.Compute/virtualMachines",
            region="eastus",
            status="Running",
            tags={"NeverStop": "True"}
        )
        db_session.add(db_res)
        db_session.commit()

    evaluation = PolicyEvaluator.evaluate_resource_remediation(
        db=db_session,
        resource_id=res_id,
        proposed_action="stop"
    )

    assert evaluation["compliant"] is False
    assert "violated" in evaluation["reason"].lower()

# --- WORKFLOW ENGINE INTEGRATION TESTS ---

@pytest.mark.asyncio
async def test_workflow_engine_idle_vm_flow(db_session):
    # Clear any stale active sequential workflows to prevent concurrency locks
    db_session.query(SequentialWorkflow).delete()
    db_session.commit()

    run_id = f"test-run-{uuid.uuid4()}"
    correlation_id = f"corr-{uuid.uuid4()}"

    # Pre-add run to prevent foreign key errors
    db_run = DBRun(id=run_id, status="running")
    db_session.add(db_run)
    db_session.commit()

    # Create sequential workflow
    wf = SequentialWorkflow(
        id=f"wf-run-{run_id}",
        run_id=run_id,
        status="pending",
        objective="Verify idle VM sequential sweep",
        scenario_name="idle_vm",
        execution_mode="MOCK",
        correlation_id=correlation_id
    )
    db_session.add(wf)
    db_session.commit()

    # Pre-create or update resource VM matching idle_vm scenario
    db_res = db_session.query(DBResource).filter(DBResource.id == "vm-idle-01").first()
    if db_res:
        db_res.tags = {"Environment": "Dev"}
    else:
        db_res = DBResource(
            id="vm-idle-01",
            provider_id="/subscriptions/000/providers/Microsoft.Compute/virtualMachines/vm-idle-01",
            name="vm-idle-01",
            type="VirtualMachine",
            region="eastus",
            status="running",
            tags={"Environment": "Dev"}
        )
        db_session.add(db_res)
    db_session.commit()

    # Execute workflow
    wf = await sequential_orchestrator_engine.execute_workflow(wf.id, db_session)

    # Assert success and stage persistence
    assert wf.status == "completed"
    assert wf.duration > 0.0
    assert len(wf.stages) == 9
    
    stages_status = {s.stage_id: s.status for s in wf.stages}
    assert stages_status["executive_orchestrator"] == "success"
    assert stages_status["inventory_agent"] == "success"
    assert stages_status["telemetry_agent"] == "success"
    assert stages_status["analysis_agent"] == "success"
    assert stages_status["recommendation_agent"] == "success"
    assert stages_status["risk_assessment_agent"] == "success"
    assert stages_status["approval_agent"] == "success"
    assert stages_status["execution_agent"] == "success"
    assert stages_status["audit_agent"] == "success"

    # Assert persistent event log count
    events = db_session.query(WorkflowEventLog).filter(WorkflowEventLog.workflow_id == wf.id).all()
    assert len(events) >= 11 # workflow starts, 9 stages start/complete, workflow completed
    
    start_events = [e for e in events if e.event_type == "WorkflowStarted"]
    completed_events = [e for e in events if e.event_type == "WorkflowCompleted"]
    assert len(start_events) == 1
    assert len(completed_events) == 1

# --- API ENDPOINTS TESTS ---

def test_api_workflows_lifecycle():
    # Ensure vm-idle-01 has Dev tags to prevent approval blocks and clear stale workflows
    with SessionLocal() as db:
        db.query(SequentialWorkflow).delete()
        db.commit()
        db_res = db.query(DBResource).filter(DBResource.id == "vm-idle-01").first()
        if db_res:
            db_res.tags = {"Environment": "Dev"}
            db.commit()
            
    # 1. Trigger sequential workflow run
    response = client.post("/api/v1/workflows", json={
        "scenario_name": "idle_vm",
        "objective": "REST Endpoints validation",
        "execution_mode": "MOCK"
    })
    assert response.status_code == 200
    res_data = response.json()
    assert "workflow_id" in res_data
    wf_id = res_data["workflow_id"]

    # 2. Get workflow details
    response = client.get(f"/api/v1/workflows/{wf_id}")
    assert response.status_code == 200
    wf_details = response.json()
    assert wf_details["workflow_id"] == wf_id
    assert wf_details["status"] == "completed"

    # 3. Get timeline
    response = client.get(f"/api/v1/workflows/{wf_id}/timeline")
    assert response.status_code == 200
    timeline = response.json()
    assert len(timeline) == 9
    assert timeline[0]["stage_id"] == "executive_orchestrator"

    # 4. Get live state
    response = client.get(f"/api/v1/workflows/{wf_id}/state")
    assert response.status_code == 200
    state = response.json()
    assert state["workflow_id"] == wf_id
    assert state["progress_percentage"] == 100.0

    # 5. Get visualization pipeline model
    response = client.get(f"/api/v1/workflows/{wf_id}/visualization")
    assert response.status_code == 200
    vis = response.json()
    assert "nodes" in vis
    assert "edges" in vis
    assert len(vis["nodes"]) == 9

    # 6. Replay workflow execution
    response = client.get(f"/api/v1/workflows/{wf_id}/replay")
    assert response.status_code == 200
    replay = response.json()
    assert replay["workflow_id"] == wf_id
    assert len(replay["stages"]) == 9

    # 7. Get aggregated metrics summary
    response = client.get("/api/v1/workflows/metrics/summary")
    assert response.status_code == 200
    metrics = response.json()
    assert metrics["total_workflow_executions"] > 0
    assert metrics["success_rate"] >= 0.0

# --- CONCURRENCY PROTECTION AND IDEMPOTENCY TESTS ---

@pytest.mark.asyncio
async def test_concurrency_lock(db_session):
    run_id1 = f"test-run-{uuid.uuid4()}"
    run_id2 = f"test-run-{uuid.uuid4()}"

    db_run1 = DBRun(id=run_id1, status="running")
    db_run2 = DBRun(id=run_id2, status="running")
    db_session.add_all([db_run1, db_run2])
    db_session.commit()

    # Active running workflow operating on resource vm-locked-01
    ctx1 = WorkflowContext(
        workflow_id=f"wf-run-{run_id1}",
        run_id=run_id1,
        correlation_id=f"corr-{uuid.uuid4()}",
        execution_mode="MOCK",
        scenario_name="idle_vm"
    )
    ctx1.inventory = {"resources": [{"id": "vm-locked-01", "type": "VirtualMachine"}]}

    wf1 = SequentialWorkflow(
        id=f"wf-run-{run_id1}",
        run_id=run_id1,
        status="running",
        objective="Active remediation VM",
        scenario_name="idle_vm",
        execution_mode="MOCK",
        correlation_id=ctx1.correlation_id,
        context=ctx1.model_dump(mode="json")
    )
    
    # Second workflow attempting to run remediation on same resource vm-locked-01
    ctx2 = WorkflowContext(
        workflow_id=f"wf-run-{run_id2}",
        run_id=run_id2,
        correlation_id=f"corr-{uuid.uuid4()}",
        execution_mode="MOCK",
        scenario_name="idle_vm"
    )
    ctx2.recommendations = [{"resource_id": "vm-locked-01", "proposed_action": "stop"}]
    ctx2.cost_estimates = {"savings_detail": {"vm-locked-01": 50.00}}
    ctx2.approval_state = {"approved": True}

    wf2 = SequentialWorkflow(
        id=f"wf-run-{run_id2}",
        run_id=run_id2,
        status="running",
        objective="Conflicting sweep VM",
        scenario_name="idle_vm",
        execution_mode="MOCK",
        correlation_id=ctx2.correlation_id,
        context=ctx2.model_dump(mode="json")
    )
    db_session.add_all([wf1, wf2])
    db_session.commit()

    # Pre-populate first 7 stages as successful so orchestrator resumes at execution_agent
    stage_ids = [
        ("executive_orchestrator", "Executive Orchestrator"),
        ("inventory_agent", "Inventory Agent"),
        ("telemetry_agent", "Telemetry Agent"),
        ("analysis_agent", "Analysis Agent"),
        ("recommendation_agent", "Recommendation Agent"),
        ("risk_assessment_agent", "Risk Assessment Agent"),
        ("approval_agent", "Approval Agent")
    ]
    for idx, (s_id, s_name) in enumerate(stage_ids):
        stage = WorkflowStage(
            id=f"stage-{s_id}-{run_id2}",
            workflow_id=wf2.id,
            stage_id=s_id,
            stage_name=s_name,
            status="success",
            started_at=datetime.utcnow() - timedelta(minutes=10 - idx),
            completed_at=datetime.utcnow() - timedelta(minutes=9 - idx),
            duration=1.0,
            input_summary={},
            output_summary={}
        )
        db_session.add(stage)
    db_session.commit()

    # Attempting to execute execution_agent stage should trigger concurrency failure state
    wf2 = await sequential_orchestrator_engine.execute_workflow(wf2.id, db_session)
    
    assert wf2.status == "failed"
    exec_stage = next(s for s in wf2.stages if s.stage_id == "execution_agent")
    assert exec_stage.status == "failed"
    assert "concurrency lock" in exec_stage.errors["error"].lower()
