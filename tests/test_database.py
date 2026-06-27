from datetime import datetime
from backend.app.models import Run, Resource, Recommendation, Approval, AuditLog

def test_database_session_creation(db_session):
    # Verify we can execute basic queries on an empty test database
    assert db_session is not None

def test_run_and_recommendation_crud(db_session):
    # 1. Create a Run record
    new_run = Run(status="running")
    db_session.add(new_run)
    db_session.commit()
    db_session.refresh(new_run)
    
    assert new_run.id is not None
    assert new_run.status == "running"
    
    # 2. Create a Resource record
    new_resource = Resource(
        id="vm-dev-01",
        provider_id="/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm-dev-01",
        name="vm-dev-01",
        type="Microsoft.Compute/virtualMachines",
        region="eastus",
        status="Running",
        tags={"Environment": "Dev"}
    )
    db_session.add(new_resource)
    db_session.commit()
    db_session.refresh(new_resource)
    
    assert new_resource.id == "vm-dev-01"
    
    # 3. Create a Recommendation record targeting the run and resource
    reco = Recommendation(
        run_id=new_run.id,
        resource_id=new_resource.id,
        action_type="stop",
        saving_amount=45.0,
        rationale="Idle check VM",
        risk_level="low",
        status="pending"
    )
    db_session.add(reco)
    db_session.commit()
    db_session.refresh(reco)
    
    assert reco.id is not None
    assert reco.run.status == "running"
    assert reco.resource.name == "vm-dev-01"
    
    # 4. Create an Approval record associated with the recommendation
    approval = Approval(
        recommendation_id=reco.id,
        status="pending"
    )
    db_session.add(approval)
    db_session.commit()
    db_session.refresh(approval)
    
    assert approval.recommendation_id == reco.id
    assert reco.approval.status == "pending"

def test_run_cascade_deletes(db_session):
    # Verify that deleting a Run cascades and deletes child recommendations and audit logs
    new_run = Run(status="completed")
    db_session.add(new_run)
    db_session.commit()
    
    resource = Resource(
        id="vm-test",
        provider_id="/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm-test",
        name="vm-test",
        type="Microsoft.Compute/virtualMachines",
        region="eastus",
        status="Running",
        tags={}
    )
    db_session.add(resource)
    db_session.commit()
    
    reco = Recommendation(
        run_id=new_run.id,
        resource_id=resource.id,
        action_type="stop",
        saving_amount=10.0,
        rationale="Test",
        risk_level="low",
        status="pending"
    )
    db_session.add(reco)
    
    audit = AuditLog(
        run_id=new_run.id,
        agent_name="TelemetryAgent",
        step_name="Ingestion",
        event_type="TelemetryCollected",
        payload={"metrics": "ok"},
        status="success"
    )
    db_session.add(audit)
    db_session.commit()
    
    # Ensure items exist
    assert db_session.query(Recommendation).filter_by(run_id=new_run.id).count() == 1
    assert db_session.query(AuditLog).filter_by(run_id=new_run.id).count() == 1
    
    # Delete run
    db_session.delete(new_run)
    db_session.commit()
    
    # Assert orphan rows are removed
    assert db_session.query(Recommendation).filter_by(run_id=new_run.id).count() == 0
    assert db_session.query(AuditLog).filter_by(run_id=new_run.id).count() == 0
