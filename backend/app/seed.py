import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.app.models.run import Run, AuditLog
from backend.app.models.resource import Resource, TelemetryHistory
from backend.app.models.recommendation import Recommendation, Approval

def seed_db(db: Session):
    from shared.config import settings
    if settings.CLOUD_MODE.upper() == "LIVE":
        print("Clearing mock/seeded database entries for live Azure mode...")
        try:
            db.query(TelemetryHistory).delete()
            db.query(Recommendation).delete()
            db.query(Approval).delete()
            db.query(AuditLog).delete()
            db.query(Run).delete()
            db.query(Resource).delete()
            db.commit()
        except Exception as delete_err:
            print(f"Error clearing database: {delete_err}")
            db.rollback()

        print("Discovering live Azure resources for inventory...")
        from cloud_adapter.live_client import LiveAzureClient
        import asyncio
        import threading
        
        async def discover():
            client = LiveAzureClient()
            resources_to_add = []
            
            # 1. Discover VMs
            try:
                vms = await client.list_virtual_machines()
                for vm in vms:
                    resources_to_add.append(Resource(
                        id=vm.name,
                        provider_id=vm.provider_id,
                        name=vm.name,
                        type=vm.type,
                        region=vm.region,
                        status=vm.status,
                        tags=vm.tags or {},
                        last_seen=datetime.utcnow()
                    ))
            except Exception as e:
                print(f"Error discovering VMs: {e}")
                
            # 2. Discover Disks
            try:
                disks = await client.list_unattached_disks()
                for disk in disks:
                    resources_to_add.append(Resource(
                        id=disk.name,
                        provider_id=disk.provider_id,
                        name=disk.name,
                        type=disk.type,
                        region=disk.region,
                        status=disk.status,
                        tags=disk.tags or {},
                        last_seen=datetime.utcnow()
                    ))
            except Exception as e:
                print(f"Error discovering disks: {e}")
                
            # 3. Discover App Service Plans
            try:
                plans = await client.list_app_service_plans()
                for plan in plans:
                    resources_to_add.append(Resource(
                        id=plan.name,
                        provider_id=plan.provider_id,
                        name=plan.name,
                        type=plan.type,
                        region=plan.region,
                        status=plan.status,
                        tags=plan.tags or {},
                        last_seen=datetime.utcnow()
                    ))
            except Exception as e:
                print(f"Error discovering App Service Plans: {e}")
                
            # 4. Discover generic resources in cloudops-demo-rg
            if client.resource_client:
                try:
                    # Add Resource Group itself
                    resources_to_add.append(Resource(
                        id="cloudops-demo-rg",
                        provider_id=f"/subscriptions/{client.subscription_id}/resourceGroups/cloudops-demo-rg",
                        name="cloudops-demo-rg",
                        type="Microsoft.Resources/resourceGroups",
                        region="centralindia",
                        status="Available",
                        tags={},
                        last_seen=datetime.utcnow()
                    ))
                    
                    generic_resources = client.resource_client.resources.list_by_resource_group("cloudops-demo-rg")
                    for res in generic_resources:
                        if res.type == "Microsoft.Compute/virtualMachines":
                            continue
                        resources_to_add.append(Resource(
                            id=res.name,
                            provider_id=res.id,
                            name=res.name,
                            type=res.type,
                            region=res.location,
                            status="Available",
                            tags=res.tags or {},
                            last_seen=datetime.utcnow()
                        ))
                except Exception as e:
                    print(f"Error discovering generic resources: {e}")
                    
            for r in resources_to_add:
                existing = db.query(Resource).filter(Resource.id == r.id).first()
                if not existing:
                    db.add(r)
            db.commit()
            
            # 5. Fetch telemetry history for VMs (last 24 hours)
            for r in resources_to_add:
                if r.type == "Microsoft.Compute/virtualMachines":
                    try:
                        print(f"Querying telemetry history from Monitor for VM {r.id}...")
                        points = await client.get_resource_telemetry(r.provider_id, 24)
                        for pt in points:
                            telemetry_pt = TelemetryHistory(
                                resource_id=r.id,
                                timestamp=pt.timestamp,
                                cpu_percent=pt.cpu_percent,
                                memory_bytes=pt.memory_bytes or 0,
                                network_in_bytes=pt.network_in_bytes or 0,
                                network_out_bytes=pt.network_out_bytes or 0
                            )
                            db.add(telemetry_pt)
                        db.commit()
                    except Exception as e:
                        print(f"Error getting telemetry for {r.id}: {e}")
                        
        def run_in_thread():
            new_loop = asyncio.new_event_loop()
            new_loop.run_until_complete(discover())
            new_loop.close()
            
        t = threading.Thread(target=run_in_thread)
        t.start()
        t.join()
        
        print("Live Azure resource discovery and seeding completed.")
        return

    # Check if database is already seeded
    if db.query(Run).first() is not None:
        return

    print("Seeding database with mock demonstration data...")

    # 1. Create Mock Resources
    resources = [
        Resource(
            id="vm-idle-01",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-idle-01",
            name="vm-idle-01",
            type="Microsoft.Compute/virtualMachines",
            region="eastus",
            status="Stopped",
            tags={"env": "prod", "owner": "finance"},
            last_seen=datetime.utcnow() - timedelta(hours=2)
        ),
        Resource(
            id="vm-dev-idle-01",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-dev/providers/Microsoft.Compute/virtualMachines/vm-dev-idle-01",
            name="vm-dev-idle-01",
            type="Microsoft.Compute/virtualMachines",
            region="westus2",
            status="Running",
            tags={"env": "dev", "owner": "engineering"},
            last_seen=datetime.utcnow() - timedelta(hours=1)
        ),
        Resource(
            id="vm-over-01",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-over-01",
            name="vm-over-01",
            type="Microsoft.Compute/virtualMachines",
            region="eastus2",
            status="Running",
            tags={"env": "prod", "owner": "billing"},
            last_seen=datetime.utcnow() - timedelta(hours=2)
        ),
        Resource(
            id="vm-busy-01",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-busy-01",
            name="vm-busy-01",
            type="Microsoft.Compute/virtualMachines",
            region="northeurope",
            status="Running",
            tags={"env": "prod", "owner": "core-platform"},
            last_seen=datetime.utcnow() - timedelta(hours=1)
        ),
        Resource(
            id="disk-temp-01",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-dev/providers/Microsoft.Compute/disks/disk-temp-01",
            name="disk-temp-01",
            type="Microsoft.Compute/disks",
            region="eastus",
            status="Unattached",
            tags={"env": "dev", "project": "migration"},
            last_seen=datetime.utcnow() - timedelta(hours=3)
        ),
        Resource(
            id="vm-conflict-01",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-staging/providers/Microsoft.Compute/virtualMachines/vm-conflict-01",
            name="vm-conflict-01",
            type="Microsoft.Compute/virtualMachines",
            region="eastus",
            status="Stopped",
            tags={"env": "staging"},
            last_seen=datetime.utcnow() - timedelta(minutes=10)
        ),
        Resource(
            id="vm-prod-active-02",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-prod-active-02",
            name="vm-prod-active-02",
            type="Microsoft.Compute/virtualMachines",
            region="westeurope",
            status="Running",
            tags={"env": "prod"},
            last_seen=datetime.utcnow() - timedelta(minutes=5)
        ),
        Resource(
            id="vm-strict-01",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-strict-01",
            name="vm-strict-01",
            type="Microsoft.Compute/virtualMachines",
            region="eastus",
            status="Running",
            tags={"env": "prod", "policy": "no-stop"},
            last_seen=datetime.utcnow() - timedelta(hours=4)
        ),
        Resource(
            id="vm-noisy-01",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-noisy-01",
            name="vm-noisy-01",
            type="Microsoft.Compute/virtualMachines",
            region="eastus",
            status="Running",
            tags={"env": "prod"},
            last_seen=datetime.utcnow() - timedelta(hours=4)
        ),
        Resource(
            id="vm-fail-01",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-fail-01",
            name="vm-fail-01",
            type="Microsoft.Compute/virtualMachines",
            region="eastus",
            status="Running",
            tags={"env": "prod"},
            last_seen=datetime.utcnow() - timedelta(hours=4)
        ),
        Resource(
            id="vm-dev",
            provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-dev/providers/Microsoft.Compute/virtualMachines/vm-dev",
            name="vm-dev",
            type="Microsoft.Compute/virtualMachines",
            region="eastus",
            status="Running",
            tags={"env": "dev"},
            last_seen=datetime.utcnow() - timedelta(hours=4)
        )
    ]
    
    for r in resources:
        db.add(r)
    db.commit()

    # 2. Add Telemetry Points for Resources
    for r in resources:
        base_cpu = 2.5 if "idle" in r.id else (85.0 if "busy" in r.id else 15.0)
        for i in range(5):
            t = TelemetryHistory(
                resource_id=r.id,
                timestamp=datetime.utcnow() - timedelta(hours=i),
                cpu_percent=base_cpu + (i * 0.4),
                memory_bytes=8 * 1024 * 1024 * 1024 if "vm" in r.type.lower() else 0,
                network_in_bytes=1000 * i,
                network_out_bytes=1500 * i
            )
            db.add(t)
    db.commit()

    # 3. Create Mock Runs
    runs = [
        Run(
            id="run-idle-demo",
            status="completed",
            started_at=datetime.utcnow() - timedelta(hours=2),
            completed_at=datetime.utcnow() - timedelta(hours=1, minutes=55),
            log_file_path="logs/run-idle-demo.log"
        ),
        Run(
            id="run-policy-demo",
            status="running",
            started_at=datetime.utcnow() - timedelta(minutes=15),
            log_file_path="logs/run-policy-demo.log"
        ),
        Run(
            id="run-conflict-demo",
            status="completed",
            started_at=datetime.utcnow() - timedelta(hours=4),
            completed_at=datetime.utcnow() - timedelta(hours=3, minutes=45),
            log_file_path="logs/run-conflict-demo.log"
        ),
        Run(
            id="run-high-demo",
            status="running",
            started_at=datetime.utcnow() - timedelta(minutes=5),
            log_file_path="logs/run-high-demo.log"
        ),
        Run(
            id="run-verif-demo",
            status="completed",
            started_at=datetime.utcnow() - timedelta(hours=6),
            completed_at=datetime.utcnow() - timedelta(hours=5, minutes=50),
            log_file_path="logs/run-verif-demo.log"
        ),
        Run(
            id="job-200",
            status="completed",
            started_at=datetime.utcnow() - timedelta(hours=8),
            completed_at=datetime.utcnow() - timedelta(hours=7, minutes=52),
            log_file_path="logs/job-200.log"
        )
    ]
    for run in runs:
        db.add(run)
    db.commit()

    # 4. Create Recommendations
    recos = [
        Recommendation(
            id="reco-vm-idle-01",
            run_id="run-idle-demo",
            resource_id="vm-idle-01",
            action_type="stop",
            saving_amount=50.0,
            rationale="Underutilization / idle patterns identified: Metric CPU / state flags match trigger rules.",
            risk_level="low",
            status="executed",
            confidence_score=0.95,
            evidence="Average CPU utilization: 2.5% (threshold: 10.0%).",
            reasoning_chain={
                "analysis": {
                    "decision": "Underutilization detected",
                    "confidence": 0.95
                },
                "finops": {
                    "estimated_monthly_savings": 50.0
                },
                "policy": {
                    "requires_approval": False,
                    "compliant": True
                },
                "decision": {
                    "final_action": "stop",
                    "approved": True
                },
                "executive": {
                    "objective": "Reduce Monthly Cost",
                    "selected_resource": "vm-idle-01"
                }
            }
        ),
        Recommendation(
            id="reco-vm-dev-idle-01",
            run_id="run-idle-demo",
            resource_id="vm-dev-idle-01",
            action_type="stop",
            saving_amount=50.0,
            rationale="Requested via tool API",
            risk_level="high",
            status="pending",
            confidence_score=0.85,
            evidence="VM is dev environment and idle.",
            reasoning_chain={
                "analysis": {
                    "decision": "Underutilization detected",
                    "confidence": 0.90
                },
                "finops": {
                    "estimated_monthly_savings": 50.0
                },
                "policy": {
                    "requires_approval": True,
                    "compliant": True
                },
                "decision": {
                    "final_action": "stop",
                    "approved": False
                },
                "executive": {
                    "objective": "Reduce Monthly Cost",
                    "selected_resource": "vm-dev-idle-01"
                }
            }
        ),
        Recommendation(
            id="reco-vm-over-01",
            run_id="run-idle-demo",
            resource_id="vm-over-01",
            action_type="resize",
            saving_amount=50.0,
            rationale="Underutilization / idle patterns identified: Metric CPU / state flags match trigger rules.",
            risk_level="low",
            status="executed",
            confidence_score=0.92,
            evidence="Average CPU utilization: 8.0% (threshold: 10.0%).",
            reasoning_chain={
                "analysis": {
                    "decision": "Overprovisioning detected",
                    "confidence": 0.92
                },
                "finops": {
                    "estimated_monthly_savings": 50.0
                },
                "policy": {
                    "requires_approval": False,
                    "compliant": True
                },
                "decision": {
                    "final_action": "resize",
                    "approved": True
                },
                "executive": {
                    "objective": "Reduce Monthly Cost",
                    "selected_resource": "vm-over-01"
                }
            }
        ),
        Recommendation(
            id="reco-vm-busy-01",
            run_id="run-high-demo",
            resource_id="vm-busy-01",
            action_type="audit",
            saving_amount=50.0,
            rationale="Requested via tool API",
            risk_level="high",
            status="pending",
            confidence_score=0.98,
            evidence="VM is busy and fully compliant.",
            reasoning_chain={
                "analysis": {
                    "decision": "No underutilization detected",
                    "confidence": 0.98
                },
                "finops": {
                    "estimated_monthly_savings": 0.0
                },
                "policy": {
                    "requires_approval": True,
                    "compliant": True
                },
                "decision": {
                    "final_action": "audit",
                    "approved": False
                },
                "executive": {
                    "objective": "Optimize Azure Subscription",
                    "selected_resource": "vm-busy-01"
                }
            }
        ),
        Recommendation(
            id="reco-vm-conflict-01",
            run_id="run-conflict-demo",
            resource_id="vm-conflict-01",
            action_type="stop",
            saving_amount=30.0,
            rationale="Underutilization / idle patterns identified: Metric CPU / state flags match trigger rules.",
            risk_level="high",
            status="approved",
            confidence_score=0.95,
            evidence="Average CPU: 4.0%. Resolved to resize due to production tags.",
            reasoning_chain={
                "analysis": {
                    "decision": "Underutilization detected",
                    "confidence": 0.95
                },
                "finops": {
                    "estimated_monthly_savings": 30.0
                },
                "policy": {
                    "requires_approval": True,
                    "compliant": True
                },
                "decision": {
                    "final_action": "resize",
                    "approved": True
                },
                "executive": {
                    "objective": "Optimize Azure Subscription",
                    "selected_resource": "vm-conflict-01"
                }
            }
        ),
        Recommendation(
            id="reco-vm-conflict-01-finops",
            run_id="run-conflict-demo",
            resource_id="vm-conflict-01",
            action_type="resize",
            saving_amount=30.0,
            rationale="FinOps Resizing alternative: Resizing preserves availability while yielding $30 monthly savings under long-term usage.",
            risk_level="low",
            status="pending",
            confidence_score=0.90,
            evidence="Production VM resizing alternative.",
            reasoning_chain={
                "analysis": {
                    "decision": "Underutilization detected",
                    "confidence": 0.95
                },
                "finops": {
                    "estimated_monthly_savings": 30.0
                },
                "policy": {
                    "requires_approval": False,
                    "compliant": True
                },
                "decision": {
                    "final_action": "resize",
                    "approved": False
                },
                "executive": {
                    "objective": "Optimize Azure Subscription",
                    "selected_resource": "vm-conflict-01"
                }
            }
        ),
        Recommendation(
            id="reco-vm-prod-active-02",
            run_id="run-conflict-demo",
            resource_id="vm-prod-active-02",
            action_type="resize",
            saving_amount=50.0,
            rationale="Requested via tool API",
            risk_level="high",
            status="pending",
            confidence_score=0.94,
            evidence="Production active VM require sizing checks.",
            reasoning_chain={
                "analysis": {
                    "decision": "Compliance active check",
                    "confidence": 0.95
                },
                "finops": {
                    "estimated_monthly_savings": 50.0
                },
                "policy": {
                    "requires_approval": True,
                    "compliant": True
                },
                "decision": {
                    "final_action": "resize",
                    "approved": False
                },
                "executive": {
                    "objective": "Optimize Azure Subscription",
                    "selected_resource": "vm-prod-active-02"
                }
            }
        ),
        Recommendation(
            id="reco-vm-strict-01",
            run_id="run-policy-demo",
            resource_id="vm-strict-01",
            action_type="resize",
            saving_amount=50.0,
            rationale="Underutilization / idle patterns identified: Metric CPU / state flags match trigger rules.",
            risk_level="low",
            status="pending",
            confidence_score=0.95,
            evidence="Average CPU is 3.0%. Violates NeverStop policy.",
            reasoning_chain={
                "analysis": {
                    "decision": "Underutilization detected",
                    "confidence": 0.95
                },
                "finops": {
                    "estimated_monthly_savings": 50.0
                },
                "policy": {
                    "requires_approval": True,
                    "compliant": False
                },
                "decision": {
                    "final_action": "stop",
                    "approved": False
                },
                "executive": {
                    "objective": "Optimize Azure Subscription",
                    "selected_resource": "vm-strict-01"
                }
            }
        ),
        Recommendation(
            id="reco-vm-noisy-01",
            run_id="run-conflict-demo",
            resource_id="vm-noisy-01",
            action_type="resize",
            saving_amount=50.0,
            rationale="Underutilization / idle patterns identified: Metric CPU / state flags match trigger rules.",
            risk_level="low",
            status="pending",
            confidence_score=0.45,
            evidence="Noisy metrics cause low confidence.",
            reasoning_chain={
                "analysis": {
                    "decision": "Underutilization detected",
                    "confidence": 0.95
                },
                "finops": {
                    "estimated_monthly_savings": 50.0
                },
                "policy": {
                    "requires_approval": False,
                    "compliant": True
                },
                "decision": {
                    "final_action": "resize",
                    "approved": False
                },
                "executive": {
                    "objective": "Optimize Azure Subscription",
                    "selected_resource": "vm-noisy-01"
                }
            }
        ),
        Recommendation(
            id="reco-vm-fail-01",
            run_id="run-verif-demo",
            resource_id="vm-fail-01",
            action_type="resize",
            saving_amount=50.0,
            rationale="Underutilization / idle patterns identified: Metric CPU / state flags match trigger rules.",
            risk_level="low",
            status="rolled_back",
            confidence_score=0.90,
            evidence="Failed execution verification.",
            reasoning_chain={
                "analysis": {
                    "decision": "Underutilization detected",
                    "confidence": 0.95
                },
                "finops": {
                    "estimated_monthly_savings": 50.0
                },
                "policy": {
                    "requires_approval": False,
                    "compliant": True
                },
                "decision": {
                    "final_action": "resize",
                    "approved": True
                },
                "executive": {
                    "objective": "Optimize Azure Subscription",
                    "selected_resource": "vm-fail-01"
                }
            }
        ),
        Recommendation(
            id="reco-99",
            run_id="job-200",
            resource_id="vm-dev",
            action_type="delete",
            saving_amount=50.0,
            rationale="Approval requested",
            risk_level="high",
            status="approved",
            confidence_score=0.95,
            evidence="Unattached disk deletion proposal.",
            reasoning_chain={
                "analysis": {
                    "decision": "Underutilization detected",
                    "confidence": 0.95
                },
                "finops": {
                    "estimated_monthly_savings": 50.0
                },
                "policy": {
                    "requires_approval": True,
                    "compliant": True
                },
                "decision": {
                    "final_action": "delete",
                    "approved": True
                },
                "executive": {
                    "objective": "Reduce Monthly Cost",
                    "selected_resource": "vm-dev"
                }
            }
        )
    ]
    for r in recos:
        db.add(r)
    db.commit()

    # 5. Create Approvals
    from mcp_server.server import encode_token_jwt
    from shared.config import settings

    def make_mock_token(res_id, action, wf_id):
        payload = {
            "sub": res_id,
            "action": action,
            "workflow_id": wf_id,
            "exp": datetime.utcnow() + timedelta(days=365),
            "iss": settings.APPROVAL_TOKEN_ISSUER
        }
        return "token-" + encode_token_jwt(payload, settings.JWT_SECRET_KEY, settings.JWT_ALGORITHM)

    approvals = [
        Approval(
            id="dbca9c2f-7fd4-45c9-a6df-522225a1efc9",
            recommendation_id="reco-vm-dev-idle-01",
            token=make_mock_token("vm-dev-idle-01", "stop", "wf-test"),
            status="pending",
            created_at=datetime.utcnow() - timedelta(minutes=5)
        ),
        Approval(
            id="7a61ef2f-01b6-4ab2-8f4a-618bbf54500b",
            recommendation_id="reco-vm-busy-01",
            token=make_mock_token("vm-busy-01", "audit", "wf-run-run-high-demo"),
            status="pending",
            created_at=datetime.utcnow() - timedelta(minutes=4)
        ),
        Approval(
            id="0adb75e5-5e1a-40c9-86cf-cf67fee1ec30",
            recommendation_id="reco-vm-prod-active-02",
            token=make_mock_token("vm-prod-active-02", "audit", "wf-run-run-policy-demo"),
            status="pending",
            created_at=datetime.utcnow() - timedelta(minutes=3)
        ),
        Approval(
            id="app-scenario-123",
            recommendation_id="reco-vm-conflict-01",
            token="token-12345",
            status="approved",
            created_at=datetime.utcnow() - timedelta(hours=4),
            decided_at=datetime.utcnow() - timedelta(hours=3, minutes=50)
        ),
        Approval(
            id="app-99",
            recommendation_id="reco-99",
            token="token-xyz-123",
            status="approved",
            created_at=datetime.utcnow() - timedelta(hours=8),
            decided_at=datetime.utcnow() - timedelta(hours=7, minutes=50)
        )
    ]
    for a in approvals:
        db.add(a)
    db.commit()

    # 6. Create Audit Logs
    audit_logs = [
        AuditLog(
            run_id="run-idle-demo",
            timestamp=datetime.utcnow() - timedelta(hours=2),
            agent_name="orchestrator",
            step_name="inventory_sweep",
            event_type="WorkflowStarted",
            payload={"scenario": "idle_vm"},
            status="success"
        ),
        AuditLog(
            run_id="run-idle-demo",
            timestamp=datetime.utcnow() - timedelta(hours=2, minutes=1),
            agent_name="telemetry_agent",
            step_name="inventory_sweep",
            event_type="ToolStarted",
            payload={"tool_name": "list_resources"},
            status="success"
        ),
        AuditLog(
            run_id="run-idle-demo",
            timestamp=datetime.utcnow() - timedelta(hours=2, minutes=2),
            agent_name="telemetry_agent",
            step_name="inventory_sweep",
            event_type="ToolCompleted",
            payload={"tool_name": "list_resources", "results_count": 3},
            status="success"
        ),
        AuditLog(
            run_id="run-idle-demo",
            timestamp=datetime.utcnow() - timedelta(hours=1, minutes=58),
            agent_name="decision_agent",
            step_name="decision_making",
            event_type="ToolStarted",
            payload={"tool_name": "estimate_cost"},
            status="success"
        ),
        AuditLog(
            run_id="run-idle-demo",
            timestamp=datetime.utcnow() - timedelta(hours=1, minutes=57),
            agent_name="decision_agent",
            step_name="decision_making",
            event_type="ToolCompleted",
            payload={"tool_name": "estimate_cost", "monthly_savings": 50.0},
            status="success"
        ),
        AuditLog(
            run_id="run-idle-demo",
            timestamp=datetime.utcnow() - timedelta(hours=1, minutes=55),
            agent_name="orchestrator",
            step_name="remediation_execution",
            event_type="WorkflowCompleted",
            payload={"remediated_resources": ["vm-idle-01"]},
            status="success"
        )
    ]
    for log in audit_logs:
        db.add(log)
    db.commit()

    print("Mock database seeding completed.")
