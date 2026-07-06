import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from backend.app.events.event_bus import EventBus, event_bus
from backend.app.workflow.models import WorkflowRun, WorkflowStep, WorkflowStatus, StepStatus, ApprovalRequest, ActionPlan, ExecutionResult
from backend.app.workflow.policy import RetryPolicy

logger = logging.getLogger("WorkflowCoordinator")

# Track which EventBus instances have been configured for DB logging
_configured_buses = set()

def make_db_log_handler(event_name: str):
    async def handler(payload: Dict[str, Any]) -> None:
        from backend.app.database import SessionLocal
        from backend.app.models.run import AuditLog, Run
        
        wf_id = payload.get("workflow_run_id") or payload.get("workflow_id")
        run_id = payload.get("run_id")
        if not run_id and wf_id:
            run_id = wf_id.replace("wf-run-", "")
            
        if not run_id:
            return
            
        agent_name = payload.get("agent_id") or "WorkflowCoordinator"
        step_name = payload.get("step_id") or "Workflow"
        
        if event_name.startswith("Tool"):
            agent_name = payload.get("agent_id", "UnknownAgent")
            step_name = f"Tool:{payload.get('tool_name')}"
            
        status = "success"
        if "Failed" in event_name or "error" in payload:
            status = "failure"
        elif "Warning" in event_name or "Retrying" in event_name or "Blocked" in event_name:
            status = "warning"
            
        try:
            with SessionLocal() as db:
                run_exists = db.query(Run).filter(Run.id == run_id).first()
                if not run_exists:
                    run_exists = Run(id=run_id, status="running")
                    db.add(run_exists)
                    db.commit()
                    
                audit = AuditLog(
                    run_id=run_id,
                    agent_name=agent_name,
                    step_name=step_name,
                    event_type=event_name,
                    payload=payload,
                    status=status
                )
                db.add(audit)
                db.commit()
        except Exception as e:
            logging.getLogger("EventBus").error(f"Failed to log event to database: {e}")
    return handler

def setup_db_event_listeners(bus: EventBus) -> None:
    global _configured_buses
    if id(bus) in _configured_buses:
        return
    _configured_buses.add(id(bus))
    
    from backend.app.database import engine
    from backend.app.models.base import Base
    import backend.app.models
    Base.metadata.create_all(bind=engine)
    
    events = [
        "WorkflowStarted", "WorkflowCompleted", "WorkflowFailed",
        "WorkflowStepStarted", "WorkflowStepCompleted", "WorkflowStepFailed", "WorkflowStepRetrying",
        "WorkflowBlockedOnApproval", "ApprovalGranted",
        "ToolStarted", "ToolCompleted", "ToolFailed"
    ]
    
    for ev in events:
        bus.subscribe(ev, make_db_log_handler(ev))

class WorkflowCoordinator:
    """Orchestrates workflow states, transitions steps, tracks retries, and triggers events."""
    
    def __init__(self, bus: EventBus = event_bus) -> None:
        self.event_bus = bus
        self._active_runs: Dict[str, WorkflowRun] = {}
        setup_db_event_listeners(self.event_bus)
        
        # Ensure all required agents are instantiated and registered in the global registry
        required_agents = [
            "telemetry_agent",
            "analysis_agent",
            "finops_agent",
            "policy_agent",
            "decision_agent",
            "execution_agent",
            "verification_agent",
            "audit_agent",
            "executive_orchestrator_agent"
        ]
        from agents.shared import global_registry
        registered_ids = [a.agent_id for a in global_registry.list_agents()]
        missing_agents = [a for a in required_agents if a not in registered_ids]
        
        if missing_agents:
            from agents import (
                TelemetryAgent,
                AnalysisAgent,
                FinOpsAgent,
                PolicyAgent,
                DecisionAgent,
                ExecutionAgent,
                VerificationAgent,
                AuditAgent,
                ExecutiveOrchestratorAgent
            )
            if "telemetry_agent" in missing_agents:
                TelemetryAgent()
            if "analysis_agent" in missing_agents:
                AnalysisAgent()
            if "finops_agent" in missing_agents:
                FinOpsAgent()
            if "policy_agent" in missing_agents:
                PolicyAgent()
            if "decision_agent" in missing_agents:
                DecisionAgent()
            if "execution_agent" in missing_agents:
                ExecutionAgent()
            if "verification_agent" in missing_agents:
                VerificationAgent()
            if "audit_agent" in missing_agents:
                AuditAgent()
            if "executive_orchestrator_agent" in missing_agents:
                ExecutiveOrchestratorAgent()

    async def create_workflow(self, run_id: str, step_ids: List[str]) -> WorkflowRun:
        """Instantiates a new WorkflowRun with a sequence of pending steps."""
        steps = [
            WorkflowStep(
                id=step_id,
                name=step_id.replace("_", " ").title(),
                status=StepStatus.PENDING
            )
            for step_id in step_ids
        ]
        
        run = WorkflowRun(
            id=f"wf-run-{run_id}",
            run_id=run_id,
            status=WorkflowStatus.PENDING,
            steps=steps
        )
        
        self._active_runs[run.id] = run
        logger.info(f"Created workflow run: {run.id} for job run {run_id}")

        # Persist Run in DB
        from backend.app.database import SessionLocal
        from backend.app.models.run import Run as DBRun
        try:
            with SessionLocal() as db:
                existing_run = db.query(DBRun).filter(DBRun.id == run_id).first()
                if not existing_run:
                    db_run = DBRun(
                        id=run_id,
                        status="running",
                        started_at=datetime.utcnow()
                    )
                    db.add(db_run)
                    db.commit()
        except Exception as e:
            logger.error(f"Failed to persist new Run in DB: {e}")

        return run

    async def start_workflow(self, run_id: str) -> None:
        """Sets workflow status to RUNNING and dispatches start event."""
        run = self._active_runs.get(run_id)
        if not run:
            raise ValueError(f"Workflow run {run_id} not found.")
            
        run.status = WorkflowStatus.RUNNING
        run.updated_at = datetime.utcnow()
        logger.info(f"Starting workflow run: {run.id}")

        # Persist status in DB
        from backend.app.database import SessionLocal
        from backend.app.models.run import Run as DBRun
        try:
            with SessionLocal() as db:
                db_run = db.query(DBRun).filter(DBRun.id == run.run_id).first()
                if db_run:
                    db_run.status = "running"
                    db.commit()
        except Exception as e:
            logger.error(f"Failed to update Run status in DB: {e}")
        
        await self.event_bus.publish(
            "WorkflowStarted",
            {"workflow_run_id": run.id, "run_id": run.run_id}
        )

    async def start_step(self, run_id: str, step_id: str) -> None:
        """Transitions step status to RUNNING and updates timestamp."""
        run = self._active_runs.get(run_id)
        if not run:
            raise ValueError(f"Workflow run {run_id} not found.")
            
        step = next((s for s in run.steps if s.id == step_id), None)
        if not step:
            raise ValueError(f"Step {step_id} not found in run {run_id}")
            
        step.status = StepStatus.RUNNING
        step.started_at = datetime.utcnow()
        run.updated_at = datetime.utcnow()
        logger.info(f"Workflow {run_id} | Starting step: {step_id}")
        
        await self.event_bus.publish(
            "WorkflowStepStarted",
            {"workflow_run_id": run.id, "step_id": step_id}
        )

    async def complete_step(self, run_id: str, step_id: str) -> None:
        """Transitions step status to COMPLETED and records completion timestamp."""
        run = self._active_runs.get(run_id)
        if not run:
            raise ValueError(f"Workflow run {run_id} not found.")
            
        step = next((s for s in run.steps if s.id == step_id), None)
        if not step:
            raise ValueError(f"Step {step_id} not found in run {run_id}")
            
        step.status = StepStatus.COMPLETED
        step.completed_at = datetime.utcnow()
        run.updated_at = datetime.utcnow()
        logger.info(f"Workflow {run_id} | Completed step: {step_id}")
        
        await self.event_bus.publish(
            "WorkflowStepCompleted",
            {"workflow_run_id": run.id, "step_id": step_id}
        )

    async def fail_step(
        self,
        run_id: str,
        step_id: str,
        error_message: str,
        retry_policy: Optional[RetryPolicy] = None
    ) -> bool:
        """Handles step failure, evaluates retry policies, and schedules retries or fails the run."""
        run = self._active_runs.get(run_id)
        if not run:
            raise ValueError(f"Workflow run {run_id} not found.")
            
        step = next((s for s in run.steps if s.id == step_id), None)
        if not step:
            raise ValueError(f"Step {step_id} not found in run {run_id}")
            
        step.error_message = error_message
        run.updated_at = datetime.utcnow()
        
        # Check retry policy parameters
        if retry_policy and retry_policy.should_retry(step.retries_attempted, error_message):
            step.retries_attempted += 1
            step.status = StepStatus.PENDING # Revert to pending for re-execution queue
            logger.warning(
                f"Workflow {run_id} | Step {step_id} failed: {error_message}. "
                f"Scheduling retry #{step.retries_attempted}."
            )
            await self.event_bus.publish(
                "WorkflowStepRetrying",
                {
                    "workflow_run_id": run.id,
                    "step_id": step_id,
                    "attempt": step.retries_attempted,
                    "error": error_message
                }
            )
            return True
            
        # No retries remaining or not retryable - fail the step and workflow
        step.status = StepStatus.FAILED
        step.completed_at = datetime.utcnow()
        run.status = WorkflowStatus.FAILED
        logger.error(f"Workflow {run_id} | Step {step_id} failed critically: {error_message}")

        # Update DB run status to failed
        from backend.app.database import SessionLocal
        from backend.app.models.run import Run as DBRun
        try:
            with SessionLocal() as db:
                db_run = db.query(DBRun).filter(DBRun.id == run.run_id).first()
                if db_run:
                    db_run.status = "failed"
                    db_run.completed_at = datetime.utcnow()
                    db.commit()
        except Exception as e:
            logger.error(f"Failed to update Run status in DB on failure: {e}")
        
        await self.event_bus.publish(
            "WorkflowStepFailed",
            {"workflow_run_id": run.id, "step_id": step_id, "error": error_message}
        )
        await self.event_bus.publish(
            "WorkflowFailed",
            {"workflow_run_id": run.id, "run_id": run.run_id, "error": error_message}
        )
        return False

    async def complete_workflow(self, run_id: str) -> None:
        """Sets workflow status to COMPLETED and dispatches completion event."""
        run = self._active_runs.get(run_id)
        if not run:
            raise ValueError(f"Workflow run {run_id} not found.")
            
        run.status = WorkflowStatus.COMPLETED
        run.updated_at = datetime.utcnow()
        logger.info(f"Completed workflow run: {run.id}")

        # Update DB run status to completed
        from backend.app.database import SessionLocal
        from backend.app.models.run import Run as DBRun
        try:
            with SessionLocal() as db:
                db_run = db.query(DBRun).filter(DBRun.id == run.run_id).first()
                if db_run:
                    db_run.status = "completed"
                    db_run.completed_at = datetime.utcnow()
                    db.commit()
        except Exception as e:
            logger.error(f"Failed to update Run status in DB on completion: {e}")
        
        await self.event_bus.publish(
            "WorkflowCompleted",
            {"workflow_run_id": run.id, "run_id": run.run_id}
        )

    async def block_on_approval(self, run_id: str, approval_req: ApprovalRequest) -> None:
        """Blocks workflow execution, links approval request details, and updates state."""
        run = self._active_runs.get(run_id)
        if not run:
            raise ValueError(f"Workflow run {run_id} not found.")
            
        run.status = WorkflowStatus.BLOCKED_ON_APPROVAL
        run.approval_request = approval_req
        run.updated_at = datetime.utcnow()
        logger.warning(f"Workflow {run_id} is blocked awaiting approval for recommendation {approval_req.recommendation_id}")

        # Update DB run and persist Approval
        from backend.app.database import SessionLocal
        from backend.app.models.run import Run as DBRun
        from backend.app.models.recommendation import Approval as DBApproval, Recommendation as DBRecommendation
        try:
            with SessionLocal() as db:
                db_run = db.query(DBRun).filter(DBRun.id == run.run_id).first()
                if db_run:
                    db_run.status = "blocked_on_approval"
                
                # Check if recommendation exists in DB
                db_reco = db.query(DBRecommendation).filter(DBRecommendation.id == approval_req.recommendation_id).first()
                if not db_reco:
                    db_reco = DBRecommendation(
                        id=approval_req.recommendation_id,
                        run_id=run.run_id,
                        resource_id=approval_req.resource_id,
                        action_type=approval_req.action_type,
                        saving_amount=0.0,
                        rationale="Approval requested; savings unavailable until cost evidence is recorded.",
                        risk_level="high",
                        status="escalated"
                    )
                    db.add(db_reco)
                else:
                    db_reco.status = "escalated"
                
                db_app = db.query(DBApproval).filter(DBApproval.id == approval_req.id).first()
                if not db_app:
                    db_app = DBApproval(
                        id=approval_req.id,
                        recommendation_id=approval_req.recommendation_id,
                        token=approval_req.token,
                        status="pending",
                        created_at=datetime.utcnow()
                    )
                    db.add(db_app)
                else:
                    db_app.token = approval_req.token
                    db_app.status = "pending"
                
                db.commit()
        except Exception as e:
            logger.error(f"Failed to persist block_on_approval state in DB: {e}")
        
        await self.event_bus.publish(
            "WorkflowBlockedOnApproval",
            {"workflow_run_id": run.id, "approval_id": approval_req.id}
        )

    async def grant_approval(self, run_id: str, token: str) -> None:
        """Sets approval task state to approved and resumes workflow execution."""
        run = self._active_runs.get(run_id)
        if not run:
            raise ValueError(f"Workflow run {run_id} not found.")
            
        if not run.approval_request or run.status != WorkflowStatus.BLOCKED_ON_APPROVAL:
            raise ValueError(f"Workflow run {run_id} is not blocked on approval.")
            
        run.approval_request.status = "approved"
        run.approval_request.token = token
        run.status = WorkflowStatus.RUNNING
        run.updated_at = datetime.utcnow()
        logger.info(f"Workflow {run_id} | Approval granted. Resuming execution.")

        # Update DB run and Approval
        from backend.app.database import SessionLocal
        from backend.app.models.run import Run as DBRun
        from backend.app.models.recommendation import Approval as DBApproval, Recommendation as DBRecommendation
        try:
            with SessionLocal() as db:
                db_run = db.query(DBRun).filter(DBRun.id == run.run_id).first()
                if db_run:
                    db_run.status = "running"
                
                db_app = db.query(DBApproval).filter(DBApproval.id == run.approval_request.id).first()
                if db_app:
                    db_app.status = "approved"
                    db_app.token = token
                    db_app.decided_at = datetime.utcnow()
                
                db_reco = db.query(DBRecommendation).filter(DBRecommendation.id == run.approval_request.recommendation_id).first()
                if db_reco:
                    db_reco.status = "approved"
                
                db.commit()
        except Exception as e:
            logger.error(f"Failed to update grant_approval state in DB: {e}")
        
        await self.event_bus.publish(
            "ApprovalGranted",
            {"workflow_run_id": run.id, "approval_id": run.approval_request.id, "token": token}
        )

    def get_run(self, run_id: str) -> Optional[WorkflowRun]:
        """Returns the target WorkflowRun details from active state mappings."""
        return self._active_runs.get(run_id)

    def _upsert_resources(self, db, output: Dict[str, Any]) -> None:
        from backend.app.models.resource import Resource as DBResource
        
        vms = output.get("vms", [])
        disks = output.get("disks", [])
        plans = output.get("app_service_plans", [])
        others = output.get("other_resources", [])
        
        for vm in vms:
            db_res = db.query(DBResource).filter(DBResource.id == vm["id"]).first()
            if not db_res:
                db_res = DBResource(id=vm["id"])
                db.add(db_res)
            db_res.provider_id = vm["provider_id"]
            db_res.name = vm["name"]
            db_res.type = vm["type"]
            db_res.region = vm["region"]
            db_res.status = vm["status"]
            db_res.tags = vm["tags"]
            db_res.last_seen = datetime.utcnow()
            
        for disk in disks:
            db_res = db.query(DBResource).filter(DBResource.id == disk["id"]).first()
            if not db_res:
                db_res = DBResource(id=disk["id"])
                db.add(db_res)
            db_res.provider_id = disk["provider_id"]
            db_res.name = disk["name"]
            db_res.type = disk["type"]
            db_res.region = disk["region"]
            db_res.status = disk["status"]
            db_res.tags = disk["tags"]
            db_res.last_seen = datetime.utcnow()
            
        for plan in plans:
            db_res = db.query(DBResource).filter(DBResource.id == plan["id"]).first()
            if not db_res:
                db_res = DBResource(id=plan["id"])
                db.add(db_res)
            db_res.provider_id = plan["provider_id"]
            db_res.name = plan["name"]
            db_res.type = plan["type"]
            db_res.region = plan["region"]
            db_res.status = plan["status"]
            db_res.tags = plan["tags"]
            db_res.last_seen = datetime.utcnow()
            
        for item in others:
            db_res = db.query(DBResource).filter(DBResource.id == item["id"]).first()
            if not db_res:
                db_res = DBResource(id=item["id"])
                db.add(db_res)
            db_res.provider_id = item["provider_id"]
            db_res.name = item["name"]
            db_res.type = item["type"]
            db_res.region = item["region"]
            db_res.status = item["status"]
            db_res.tags = item["tags"]
            db_res.last_seen = datetime.utcnow()
            
        db.commit()

    def _save_recommendations(self, db, run_id: str, context: Any) -> None:
        from backend.app.models.recommendation import Recommendation as DBRecommendation
        from backend.app.models.resource import Resource as DBResource
        from backend.app.core.config import settings
        
        recommendations = context.recommendations or []
        cost_estimates = context.cost_estimates or {}
        savings_detail = cost_estimates.get("savings_detail", {})
        
        for reco in recommendations:
            reco_id = reco.get("recommendation_id", f"reco-{reco.get('resource_id')}")
            db_reco = db.query(DBRecommendation).filter(DBRecommendation.id == reco_id).first()
            if not db_reco:
                res_id = reco.get("resource_id")
                if not res_id:
                    logger.warning("Skipping recommendation without resource_id in run %s", run_id)
                    continue

                res = db.query(DBResource).filter(DBResource.id == res_id).first()
                if not res:
                    if settings.CLOUD_MODE.upper() == "LIVE":
                        logger.warning("Skipping LIVE recommendation for unknown resource %s", res_id)
                        continue
                    res = DBResource(
                        id=res_id,
                        provider_id=f"/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/default-rg/providers/Microsoft.Compute/virtualMachines/{res_id}",
                        name=res_id,
                        type="Microsoft.Compute/virtualMachines" if "vm" in res_id.lower() else ("Microsoft.Compute/disks" if "disk" in res_id.lower() else "Microsoft.Web/serverfarms"),
                        region="eastus",
                        status="Running",
                        tags={}
                    )
                    db.add(res)
                    db.commit()
                    
                db_reco = DBRecommendation(
                    id=reco_id,
                    run_id=run_id,
                    resource_id=res_id,
                    action_type=reco.get("proposed_action", "stop"),
                    saving_amount=savings_detail.get(res_id, 0.0),
                    rationale=f"{reco.get('finding')}: {reco.get('evidence')}",
                    risk_level="low",
                    status="pending"
                )
                db.add(db_reco)
            else:
                db_reco.saving_amount = savings_detail.get(db_reco.resource_id, 0.0)
                db_reco.rationale = f"{reco.get('finding')}: {reco.get('evidence')}"
            db.commit()

    def _update_policy_recommendations(self, db, context: Any) -> None:
        from backend.app.models.recommendation import Recommendation as DBRecommendation
        
        policies = context.policies or []
        for policy in policies:
            r_id = policy.get("resource_id")
            reco_id = f"reco-{r_id}"
            db_reco = db.query(DBRecommendation).filter(DBRecommendation.id == reco_id).first()
            if db_reco:
                db_reco.risk_level = "high" if policy.get("requires_approval") else "low"
                db.commit()

    def update_recommendation_reasoning(self, db, run_id: str, context: Any, objective: str = "Reduce Monthly Cost", selected_resource: str = "") -> None:
        from backend.app.models.recommendation import Recommendation as DBRecommendation
        
        # Query recommendations for this run
        db_recos = db.query(DBRecommendation).filter(DBRecommendation.run_id == run_id).all()
        
        # Get confidence scores from history
        analysis_conf = None
        policy_conf = None
        decision_conf = None
        for trace in getattr(context, "reasoning_history", []):
            agent = trace.get("agent_id")
            if agent == "analysis_agent":
                analysis_conf = trace.get("confidence_score", None)
            elif agent == "policy_agent":
                policy_conf = trace.get("confidence_score", None)
            elif agent == "decision_agent":
                decision_conf = trace.get("confidence_score", None)
                
        for db_reco in db_recos:
            r_id = db_reco.resource_id
            
            # 1. Analysis
            analysis_decision = "Idle patterns identified"
            for reco in getattr(context, "recommendations", []):
                if reco.get("resource_id") == r_id:
                    analysis_decision = reco.get("finding", "Idle patterns identified")
                    break
            analysis_data = {
                "decision": analysis_decision,
                "confidence": round(analysis_conf, 2) if analysis_conf is not None else None
            }
            
            # 2. FinOps
            savings_detail = getattr(context, "cost_estimates", {}).get("savings_detail", {})
            cost_saving = savings_detail.get(r_id, db_reco.saving_amount)
            finops_data = {
                "estimated_monthly_savings": float(cost_saving)
            }
            
            # 3. Policy
            requires_approval = False
            compliant = True
            for pol in getattr(context, "policies", []):
                if pol.get("resource_id") == r_id:
                    requires_approval = pol.get("requires_approval", False)
                    compliant = pol.get("compliant", True)
                    break
            policy_data = {
                "requires_approval": requires_approval,
                "compliant": compliant
            }
            
            # 4. Decision
            final_action = db_reco.action_type
            approved = True
            app_status = getattr(context, "approval_status", {})
            if app_status and app_status.get("resource_id") == r_id:
                final_action = app_status.get("action_type", final_action)
                approved = app_status.get("approved", approved)
            else:
                if requires_approval:
                    approved = False
                    
            decision_data = {
                "final_action": final_action,
                "approved": approved
            }
            
            # 5. Executive
            executive_data = {
                "objective": objective,
                "selected_resource": selected_resource or r_id
            }
            
            # Combine into final reasoning chain
            chain = {
                "analysis": analysis_data,
                "finops": finops_data,
                "policy": policy_data,
                "decision": decision_data,
                "executive": executive_data
            }
            
            # Update recommendation DB record
            db_reco.confidence_score = round(decision_conf, 2)
            db_reco.evidence = f"Average utilization metrics matched underutilization rules."
            for reco in getattr(context, "recommendations", []):
                if reco.get("resource_id") == r_id:
                    db_reco.evidence = reco.get("evidence", db_reco.evidence)
                    break
                    
            db_reco.reasoning_chain = chain
            db_reco.saving_amount = float(cost_saving)
            db_reco.action_type = final_action
            db_reco.risk_level = "high" if (requires_approval or not compliant) else "low"
            
            # Log structured AgentReasoningPath record
            from backend.app.models.reasoning_path import AgentReasoningPath
            
            obs = {
                "resource_id": r_id,
                "analysis_finding": analysis_data.get("decision"),
                "analysis_confidence": analysis_data.get("confidence"),
                "estimated_monthly_savings": finops_data.get("estimated_monthly_savings"),
                "compliance_gate": policy_data
            }
            
            hyps = [
                {
                    "hypothesis": f"Resource {r_id} is idle or overprovisioned due to low compute workload requirements.",
                    "confidence": analysis_data.get("confidence", None),
                    "evidence": analysis_data.get("decision")
                }
            ]
            
            pol_status = "Compliant"
            if requires_approval:
                pol_status = "Requires Approval"
            elif not compliant:
                pol_status = "Non-Compliant"
                
            reasoning_path_entry = AgentReasoningPath(
                resource_id=r_id,
                agent_name="Executive Orchestrator Agent",
                trigger_event=f"Autopilot objective sweep: {objective}",
                observations=obs,
                hypotheses=hyps,
                policy_check_status=pol_status,
                recommended_action=final_action
            )
            db.add(reasoning_path_entry)
            
        db.commit()

    async def invoke_mcp_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """Invokes an MCP tool by name via the registered tool function registry."""
        from mcp_server.server import get_registered_tool_functions
        tools = get_registered_tool_functions()
        if tool_name not in tools:
            raise ValueError(f"Tool {tool_name} not found in MCP registry.")
        
        tool_func = tools[tool_name]
        try:
            result = await tool_func(**kwargs)
            return result
        except Exception as e:
            logger.error(f"MCP Tool '{tool_name}' failed with error: {e}")
            raise e

    async def run_autopilot_reasoning(self, run_id: str, scenario_name: str, dry_run: bool = False, objective: Optional[str] = None) -> WorkflowRun:
        """Orchestrates the multi-agent collaboration reasoning engine pipeline via ExecutiveOrchestratorAgent."""
        from agents.shared import global_registry
        from agents.executive.agent import ExecutiveOrchestratorAgent
        
        executive_agent = global_registry.lookup("executive_orchestrator_agent")
        if not executive_agent:
            executive_agent = ExecutiveOrchestratorAgent()
            
        return await executive_agent.run_objective(
            run_id=run_id,
            objective=objective,
            scenario_name=scenario_name,
            dry_run=dry_run,
            coordinator=self
        )

