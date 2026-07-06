import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db
from backend.app.models.reasoning_path import AgentReasoningPath
from backend.app.seed import seed_db
from backend.app.workflow.coordinator import WorkflowCoordinator
from backend.app.workflow.models import WorkflowStatus

def test_reasoning_path_db_crud(db_session):
    """Test that we can create, read, update, and delete AgentReasoningPath in DB."""
    # 1. Create
    path = AgentReasoningPath(
        resource_id="cosmos-test-01",
        agent_name="FinOpsAgent",
        trigger_event="Unit Test Trigger",
        observations={"metric": "RU/s", "value": 4000},
        hypotheses=[{"hypothesis": "Dev tier left idle", "confidence_score": 0.9}],
        policy_check_status="Compliant",
        recommended_action="Scale down"
    )
    db_session.add(path)
    db_session.commit()
    db_session.refresh(path)
    
    assert path.id is not None
    assert path.resource_id == "cosmos-test-01"
    assert path.observations["metric"] == "RU/s"
    assert path.hypotheses[0]["confidence_score"] == 0.9
    
    # 2. Read
    fetched = db_session.query(AgentReasoningPath).filter_by(id=path.id).first()
    assert fetched is not None
    assert fetched.agent_name == "FinOpsAgent"
    
    # 3. Update
    fetched.recommended_action = "Scale down to 400"
    db_session.commit()
    db_session.refresh(fetched)
    assert fetched.recommended_action == "Scale down to 400"
    
    # 4. Delete
    db_session.delete(fetched)
    db_session.commit()
    deleted = db_session.query(AgentReasoningPath).filter_by(id=path.id).first()
    assert deleted is None

def test_reasoning_path_seeding(db_session):
    """Test that seed_db adds the 8 mock reasoning paths when database is empty."""
    # Ensure database is cleared of Runs and AgentReasoningPaths first to force seeding
    db_session.query(AgentReasoningPath).delete()
    from backend.app.models.run import Run
    db_session.query(Run).delete()
    db_session.commit()
    
    seed_db(db_session)
    
    # Check that reasoning paths are populated
    paths = db_session.query(AgentReasoningPath).all()
    assert len(paths) >= 8
    
    cosmos_path = db_session.query(AgentReasoningPath).filter_by(resource_id="cosmos-idle-01").first()
    assert cosmos_path is not None
    assert cosmos_path.agent_name == "FinOpsAgent"
    assert cosmos_path.recommended_action == "Scale throughput down to 400 RU/s (manual) to save $216.00/month."
    
    vm_path = db_session.query(AgentReasoningPath).filter_by(resource_id="vm-unpatched-02").first()
    assert vm_path is not None
    assert vm_path.policy_check_status == "Failed"

def test_reasoning_path_api_endpoint(db_session):
    """Test the GET /api/v1/reasoning-paths API endpoint using FastAPI TestClient."""
    # Clear and re-seed to ensure reliable records
    db_session.query(AgentReasoningPath).delete()
    from backend.app.models.run import Run
    db_session.query(Run).delete()
    db_session.commit()
    seed_db(db_session)

    # Override get_db dependency to use the test db_session
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    
    client = TestClient(app)
    response = client.get("/api/v1/reasoning-paths")
    
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert "data" in payload
    assert len(payload["data"]) >= 8
    
    # Verify structure of first item
    first_path = payload["data"][0]
    assert "id" in first_path
    assert "timestamp" in first_path
    assert "agent_name" in first_path
    assert "trigger_event" in first_path
    assert "observations" in first_path
    assert "hypotheses" in first_path
    assert "policy_check_status" in first_path
    assert "recommended_action" in first_path
    
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_coordinator_logging_on_evaluation(db_session):
    """Test that running coordinator sweeps creates an AgentReasoningPath entry automatically."""
    # Override get_db for workflow run triggers
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db

    coordinator = WorkflowCoordinator()
    
    # Clear paths and run idle_vm scenario which evaluates and runs update_recommendation_reasoning
    db_session.query(AgentReasoningPath).delete()
    db_session.commit()
    
    # We must patch session database session in coordinator to use our test session
    # The coordinator creates session using SessionLocal(), but we want it to commit to test db_session.
    # Fortunately, the coordinator's update_recommendation_reasoning method receives the db parameter.
    # In agents/executive/agent.py:
    # 456:                                 with SessionLocal() as db:
    # 457:                                     coordinator.update_recommendation_reasoning(
    # 458:                                         db, ...
    # This means executive/agent.py imports SessionLocal from database.py.
    # To mock it, we can temporarily patch the SessionLocal context manager inside executive agent/coordinator.
    
    import backend.app.database
    original_session_local = backend.app.database.SessionLocal
    
    class FakeSessionContextManager:
        def __init__(self, session):
            self.session = session
        def __enter__(self):
            return self.session
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass
            
    backend.app.database.SessionLocal = lambda: FakeSessionContextManager(db_session)
    
    try:
        run_idle = await coordinator.run_autopilot_reasoning(run_id="run-idle-test", scenario_name="idle_vm")
        assert run_idle.status == WorkflowStatus.COMPLETED
        
        # Verify that reasoning paths have been logged
        paths = db_session.query(AgentReasoningPath).all()
        assert len(paths) > 0
        
        # Check logged content
        logged = paths[0]
        assert logged.agent_name == "Executive Orchestrator Agent"
        assert "idle_vm" in logged.trigger_event or "Reduce Monthly Cost" in logged.trigger_event
        assert logged.recommended_action in ["stop", "resize", "delete"]
        assert logged.policy_check_status in ["Compliant", "Requires Approval", "Non-Compliant"]
        
    finally:
        # Restore backend database SessionLocal
        backend.app.database.SessionLocal = original_session_local
        app.dependency_overrides.clear()
