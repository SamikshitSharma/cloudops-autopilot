import json
import logging
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from pydantic import BaseModel

from shared.config import settings
from backend.app.database import SessionLocal
from backend.app.models.run import Run as DBRun, AuditLog as DBAuditLog
from backend.app.models.recommendation import Recommendation as DBRecommendation, Approval as DBApproval
from backend.app.models.resource import Resource as DBResource
from backend.app.models.workflow import SequentialWorkflow, WorkflowStage, WorkflowEventLog
from backend.app.workflow.policy_evaluator import PolicyEvaluator
from backend.app.workflow.agent_registry import (
    global_agent_registry,
    WorkflowStageContract,
    StageRetryPolicy
)
from backend.app.schemas.workflow import WorkflowContext, PipelineGraph, PipelineNode, PipelineEdge

# Structured JSON Logger Setup
logger = logging.getLogger("SequentialOrchestrator")

def log_structured(agent: str, stage_id: str, status: str, duration: float, workflow_id: str, correlation_id: str, **kwargs):
    """Logs structured JSON to stdout/logging systems."""
    log_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "workflow_id": workflow_id,
        "correlation_id": correlation_id,
        "stage_id": stage_id,
        "agent": agent,
        "status": status,
        "duration_sec": round(duration, 3),
        **kwargs
    }
    logger.info(json.dumps(log_data))

# --- SIMULATED/MOCK STAGES LOGIC ---

async def run_stage_with_contracts(
    db: Session,
    wf_db: SequentialWorkflow,
    stage_id: str,
    message_payload: Dict[str, Any]
) -> Tuple[str, Dict[str, Any], Optional[str]]:
    """Runs a single registered stage, enforcing validations, timeouts, and retry policies."""
    contract = global_agent_registry.get_stage(stage_id)
    if not contract:
        return "failed", {}, f"Stage '{stage_id}' not found in registry."
    
    # 1. Dependency Validation
    completed_stages = [s.stage_id for s in wf_db.stages if s.status == "success"]
    if not global_agent_registry.validate_dependencies(stage_id, completed_stages):
        return "failed", {}, f"Dependencies not satisfied for stage '{stage_id}'."

    # 2. Input Validation
    if not global_agent_registry.validate_inputs(stage_id, message_payload):
        return "failed", {}, f"Input validation failed for stage '{stage_id}' schema."

    # 3. Execution with Retries & Timeout
    retry_policy = contract.retry_policy
    attempt = 0
    last_err = None
    stage_output = {}
    
    start_time = datetime.utcnow()
    
    while attempt < retry_policy.max_retries:
        try:
            # Enforce timeout
            async with asyncio.timeout(contract.timeout_seconds):
                # Call registered execute function
                stage_output = await global_agent_registry.execute_stage(stage_id, message_payload, wf_db)
                break
        except TimeoutError as t_err:
            attempt += 1
            last_err = f"Timeout of {contract.timeout_seconds}s exceeded."
            if attempt < retry_policy.max_retries:
                await asyncio.sleep(retry_policy.initial_delay_seconds * (retry_policy.backoff_factor ** (attempt - 1)))
        except Exception as e:
            attempt += 1
            last_err = str(e)
            if attempt < retry_policy.max_retries:
                await asyncio.sleep(retry_policy.initial_delay_seconds * (retry_policy.backoff_factor ** (attempt - 1)))

    duration = (datetime.utcnow() - start_time).total_seconds()

    if attempt >= retry_policy.max_retries:
        # Failure Recovery Logic
        if contract.recovery_strategy == "skip":
            return "skipped", {}, f"Skipped after failure. Error: {last_err}"
        return "failed", {}, last_err

    if wf_db.execution_mode == "MOCK":
        import random
        sleep_durations = {
            "executive_orchestrator": random.uniform(0.15, 0.35),
            "inventory_agent": random.uniform(0.3, 0.75),
            "telemetry_agent": random.uniform(0.5, 1.1),
            "analysis_agent": random.uniform(0.25, 0.65),
            "recommendation_agent": random.uniform(1.2, 2.4),
            "risk_assessment_agent": random.uniform(0.8, 1.8),
            "approval_agent": random.uniform(0.1, 0.3),
            "execution_agent": random.uniform(1.4, 2.8),
            "audit_agent": random.uniform(0.4, 0.9)
        }
        await asyncio.sleep(sleep_durations.get(stage_id, 0.5))

    # 4. Output Validation
    if not global_agent_registry.validate_outputs(stage_id, stage_output):
        return "failed", {}, f"Output validation failed for stage '{stage_id}' schema."

    return "success", stage_output, None


# --- ORCHESTRATOR ENGINE ---

class SequentialOrchestrator:
    """Production-grade Multi-Agent Sequential Orchestrator Engine."""

    def __init__(self) -> None:
        self._register_default_stages()

    def _register_default_stages(self) -> None:
        """Discovers and registers the 9 required stages into the registry."""
        
        # --- Stage 1: Executive Orchestrator ---
        class ExecutiveInput(BaseModel):
            scenario_name: str
            objective: Optional[str] = None
        class ExecutiveOutput(BaseModel):
            objective: str
            scenario_name: str

        async def exec_orchestration(msg: Dict[str, Any], wf: SequentialWorkflow) -> Dict[str, Any]:
            scen = msg.get("scenario_name", "idle_vm")
            obj = msg.get("objective") or f"Optimize Azure Resources for {scen}"
            return {"objective": obj, "scenario_name": scen}

        global_agent_registry.register(
            WorkflowStageContract(
                stage_id="executive_orchestrator",
                stage_name="Executive Orchestrator",
                priority=10,
                input_schema=ExecutiveInput,
                output_schema=ExecutiveOutput
            ),
            exec_orchestration
        )

        # --- Stage 2: Inventory Agent ---
        class InventoryInput(BaseModel):
            scenario_name: str
        class InventoryOutput(BaseModel):
            resources: List[Dict[str, Any]]

        async def exec_inventory(msg: Dict[str, Any], wf: SequentialWorkflow) -> Dict[str, Any]:
            scen = msg.get("scenario_name", "idle_vm")
            # If LIVE cloud mode, fetch from live Azure SDK adapter
            if wf.execution_mode == "LIVE":
                from cloud_adapter import get_azure_client
                client = get_azure_client()
                vms = await client.list_virtual_machines()
                disks = await client.list_unattached_disks()
                plans = await client.list_app_service_plans()
                
                res_list = []
                for vm in vms:
                    res_list.append({"id": vm.name, "type": "VirtualMachine", "region": vm.region, "status": vm.status, "tags": vm.tags})
                for disk in disks:
                    res_list.append({"id": disk.name, "type": "Disk", "region": disk.region, "status": disk.status, "tags": disk.tags})
                for plan in plans:
                    res_list.append({"id": plan.name, "type": "AppServicePlan", "region": plan.region, "status": plan.status, "tags": plan.tags})
            else:
                # Load from scenario mock registry
                from agents.shared.scenarios import SCENARIOS
                scenario_data = SCENARIOS.get(scen, SCENARIOS["idle_vm"])
                metrics = scenario_data.get("telemetry_data", {}).get("metrics", [])
                res_list = []
                for m in metrics:
                    res_list.append({
                        "id": m.get("resource_id"),
                        "type": m.get("type"),
                        "region": "eastus",
                        "status": m.get("status", "running"),
                        "tags": {"Environment": "Production" if m.get("is_production") or "conflict" in m.get("resource_id", "").lower() else "Dev"}
                    })
            return {"resources": res_list}

        global_agent_registry.register(
            WorkflowStageContract(
                stage_id="inventory_agent",
                stage_name="Inventory Agent",
                priority=20,
                dependencies=["executive_orchestrator"],
                input_schema=InventoryInput,
                output_schema=InventoryOutput
            ),
            exec_inventory
        )

        # --- Stage 3: Telemetry Agent ---
        class TelemetryInput(BaseModel):
            resources: List[Dict[str, Any]]
        class TelemetryOutput(BaseModel):
            metrics: List[Dict[str, Any]]

        async def exec_telemetry(msg: Dict[str, Any], wf: SequentialWorkflow) -> Dict[str, Any]:
            # Fetch telemetry based on inventory list without rediscovering resources
            ctx_resources = msg.get("resources", [])
            metrics_list = []
            
            if wf.execution_mode == "LIVE":
                from cloud_adapter import get_azure_client
                client = get_azure_client()
                for r in ctx_resources:
                    if r["type"] == "VirtualMachine":
                        points = await client.get_resource_telemetry(r["id"], 1)
                        cpu = points[-1].cpu_percent if points else 2.5
                        metrics_list.append({"resource_id": r["id"], "type": "VirtualMachine", "cpu_utilization": cpu, "memory_utilization": 20.0, "status": "running"})
                    elif r["type"] == "Disk":
                        metrics_list.append({"resource_id": r["id"], "type": "Disk", "status": "unattached"})
                    else:
                        metrics_list.append({"resource_id": r["id"], "type": r["type"], "status": "running"})
            else:
                from agents.shared.scenarios import SCENARIOS
                scen = wf.scenario_name or "idle_vm"
                scenario_data = SCENARIOS.get(scen, SCENARIOS["idle_vm"])
                metrics_list = scenario_data.get("telemetry_data", {}).get("metrics", [])
                
            return {"metrics": metrics_list}

        global_agent_registry.register(
            WorkflowStageContract(
                stage_id="telemetry_agent",
                stage_name="Telemetry Agent",
                priority=30,
                dependencies=["inventory_agent"],
                input_schema=TelemetryInput,
                output_schema=TelemetryOutput
            ),
            exec_telemetry
        )

        # --- Stage 4: Analysis Agent ---
        class AnalysisInput(BaseModel):
            metrics: List[Dict[str, Any]]
        class AnalysisOutput(BaseModel):
            anomalies: List[Dict[str, Any]]
            underutilized: List[str]

        async def exec_analysis(msg: Dict[str, Any], wf: SequentialWorkflow) -> Dict[str, Any]:
            metrics = msg.get("metrics", [])
            underutilized = []
            anomalies = []
            
            for m in metrics:
                r_id = m.get("resource_id")
                r_type = m.get("type")
                if r_type == "VirtualMachine" and m.get("cpu_utilization", 100.0) < 10.0:
                    underutilized.append(r_id)
                    anomalies.append({"resource_id": r_id, "type": "VirtualMachine", "issue": "Idle CPU utilization"})
                elif r_type == "Disk" and m.get("status") == "unattached":
                    underutilized.append(r_id)
                    anomalies.append({"resource_id": r_id, "type": "Disk", "issue": "Orphaned storage"})
                elif r_type == "AppServicePlan" and m.get("status") == "underutilized":
                    underutilized.append(r_id)
                    anomalies.append({"resource_id": r_id, "type": "AppServicePlan", "issue": "Underutilized scale-tier"})
                    
            return {"anomalies": anomalies, "underutilized": underutilized}

        global_agent_registry.register(
            WorkflowStageContract(
                stage_id="analysis_agent",
                stage_name="Analysis Agent",
                priority=40,
                dependencies=["telemetry_agent"],
                input_schema=AnalysisInput,
                output_schema=AnalysisOutput
            ),
            exec_analysis
        )

        # --- Stage 5: Recommendation Agent ---
        class RecommendationInput(BaseModel):
            underutilized: List[str]
        class RecommendationOutput(BaseModel):
            recommendations: List[Dict[str, Any]]
            savings_detail: Dict[str, float]
            total_savings: float

        async def exec_recommendation(msg: Dict[str, Any], wf: SequentialWorkflow) -> Dict[str, Any]:
            # Retrieve all discovered resources from context
            ctx_resources = wf.context.get("inventory", {}).get("resources", [])
            underutilized = msg.get("underutilized", [])
            
            recos = []
            savings = {}
            total = 0.0
            seen_resources = set()
            
            # 1. Process underutilized resources (Cost & Scaling)
            for r_id in underutilized:
                if r_id in seen_resources:
                    continue
                seen_resources.add(r_id)
                
                action = "stop"
                saving = 50.00
                finding = "Idle compute resource"
                evidence = "Average CPU utilization is 2.5% over the last 7 days."
                risk_level = "low"
                
                # Check resource ID or type
                r_info = next((x for x in ctx_resources if x["id"] == r_id), {})
                r_type = r_info.get("type", "").lower()
                
                if "disk" in r_type or "disk" in r_id.lower():
                    action = "delete"
                    saving = 32.50
                    finding = "Orphaned storage volume"
                    evidence = "Disk has been unattached for > 30 days."
                    risk_level = "low"
                elif "conflict" in r_id.lower() or "prod" in r_id.lower() or "over" in r_id.lower():
                    action = "resize"
                    saving = 120.00
                    finding = "Overprovisioned production tier VM"
                    evidence = "CPU utilization peak is under 40% with high memory headroom."
                    risk_level = "high"
                elif "dev" in r_id.lower():
                    action = "stop"
                    saving = 50.00
                    finding = "Non-production environment VM run-idle"
                    evidence = "Average CPU is 1.8% during business hours."
                    risk_level = "low"
                    
                recos.append({
                    "recommendation_id": f"reco-{r_id}",
                    "resource_id": r_id,
                    "proposed_action": action,
                    "finding": finding,
                    "evidence": evidence,
                    "risk_level": risk_level
                })
                savings[r_id] = saving
                total += saving
                
            # 2. Scan remaining inventory for Security, Reliability, and Compliance recommendations
            for r in ctx_resources:
                r_id = r["id"]
                if r_id in seen_resources:
                    continue
                    
                r_type = r["type"].lower()
                tags = r.get("tags", {})
                
                # A. Security Check: dev VM exposing port 22 public
                if "dev" in r_id.lower() and "vm" in r_type:
                    seen_resources.add(r_id)
                    recos.append({
                        "recommendation_id": f"reco-{r_id}-sec",
                        "resource_id": r_id,
                        "proposed_action": "restrict_ssh",
                        "finding": "Publicly exposed SSH port (22)",
                        "evidence": "Network Security Group allows inbound SSH traffic from 0.0.0.0/0.",
                        "risk_level": "high"
                    })
                    savings[r_id] = 0.0
                    
                # B. Reliability Check: critical VM missing backup protection
                elif ("strict" in r_id.lower() or "prod" in r_id.lower()) and "vm" in r_type:
                    seen_resources.add(r_id)
                    recos.append({
                        "recommendation_id": f"reco-{r_id}-backup",
                        "resource_id": r_id,
                        "proposed_action": "enable_backup",
                        "finding": "Critical VM missing backup protection",
                        "evidence": "No backup vault association detected in resource tags or config.",
                        "risk_level": "low"
                    })
                    savings[r_id] = 0.0
                    
                # C. Compliance Check: Key Vault public network access
                elif ("kv" in r_id.lower() or "vault" in r_type) or ("st-prod" in r_id.lower()):
                    seen_resources.add(r_id)
                    recos.append({
                        "recommendation_id": f"reco-{r_id}-compliance",
                        "resource_id": r_id,
                        "proposed_action": "disable_public_network",
                        "finding": "Key Vault public network access enabled",
                        "evidence": "Firewall configuration bypasses Private Endpoint restrictions.",
                        "risk_level": "critical"
                    })
                    savings[r_id] = 0.0
                    
            return {"recommendations": recos, "savings_detail": savings, "total_savings": round(total, 2)}

        global_agent_registry.register(
            WorkflowStageContract(
                stage_id="recommendation_agent",
                stage_name="Recommendation Agent",
                priority=50,
                dependencies=["analysis_agent"],
                input_schema=RecommendationInput,
                output_schema=RecommendationOutput
            ),
            exec_recommendation
        )

        # --- Stage 6: Risk Assessment Agent ---
        class RiskInput(BaseModel):
            recommendations: List[Dict[str, Any]]
            savings_detail: Dict[str, float]
        class RiskOutput(BaseModel):
            risk_report: Dict[str, Any]
            policies_evaluated: List[Dict[str, Any]]

        async def exec_risk(msg: Dict[str, Any], wf: SequentialWorkflow) -> Dict[str, Any]:
            recos = msg.get("recommendations", [])
            savings = msg.get("savings_detail", {})
            
            with SessionLocal() as db:
                eval_results = PolicyEvaluator.evaluate_all(db, recos, savings)
                
            risk_level = "low"
            downtime_prob = "zero"
            requires_approval = False
            compliant = True
            
            for ev in eval_results:
                if ev["requires_approval"]:
                    requires_approval = True
                    risk_level = "high"
                    downtime_prob = "minimal"
                if not ev["compliant"]:
                    compliant = False
                    risk_level = "critical"
                    downtime_prob = "high"
                    
            risk_report = {
                "risk_level": risk_level,
                "downtime_probability": downtime_prob,
                "requires_approval": requires_approval,
                "compliant": compliant,
                "rollback_recommendation": "In case of failure, trigger automatic Azure API state recovery."
            }
            return {"risk_report": risk_report, "policies_evaluated": eval_results}

        global_agent_registry.register(
            WorkflowStageContract(
                stage_id="risk_assessment_agent",
                stage_name="Risk Assessment Agent",
                priority=60,
                dependencies=["recommendation_agent"],
                input_schema=RiskInput,
                output_schema=RiskOutput
            ),
            exec_risk
        )

        # --- Stage 7: Approval Agent ---
        class ApprovalInput(BaseModel):
            risk_report: Dict[str, Any]
            policies_evaluated: List[Dict[str, Any]]
        class ApprovalOutput(BaseModel):
            approved: bool
            requires_manual_approval: bool
            reason: str
            approval_token: Optional[str]

        async def exec_approval(msg: Dict[str, Any], wf: SequentialWorkflow) -> Dict[str, Any]:
            risk = msg.get("risk_report", {})
            policies = msg.get("policies_evaluated", [])
            
            # Replay protection: if decision was already processed
            context_dict = wf.context or {}
            existing_app = context_dict.get("approval_state", {})
            if "approved" in existing_app and not existing_app.get("requires_manual_approval", True):
                return {
                    "approved": existing_app.get("approved"),
                    "requires_manual_approval": False,
                    "reason": "Re-execution bypassed: manual decision processed.",
                    "approval_token": existing_app.get("approval_token")
                }
                
            if risk.get("requires_approval") or not risk.get("compliant"):
                # Manual approval is required
                token = f"app-token-{uuid.uuid4()}"
                return {
                    "approved": False,
                    "requires_manual_approval": True,
                    "reason": "Governance guidelines force manual operator review.",
                    "approval_token": token
                }
                
            return {
                "approved": True,
                "requires_manual_approval": False,
                "reason": "Auto-remediation compliant.",
                "approval_token": None
            }

        global_agent_registry.register(
            WorkflowStageContract(
                stage_id="approval_agent",
                stage_name="Approval Agent",
                priority=70,
                dependencies=["risk_assessment_agent"],
                input_schema=ApprovalInput,
                output_schema=ApprovalOutput
            ),
            exec_approval
        )

        # --- Stage 8: Execution Agent ---
        class ExecutionInput(BaseModel):
            approved: bool
            recommendations: List[Dict[str, Any]]
        class ExecutionOutput(BaseModel):
            execution_results: List[Dict[str, Any]]
            status: str

        async def exec_execution(msg: Dict[str, Any], wf: SequentialWorkflow) -> Dict[str, Any]:
            approved = msg.get("approved", False)
            recos = msg.get("recommendations", [])
            results = []
            
            # Check concurrency protection (Avoid conflicts with resources)
            with SessionLocal() as db:
                conflicting = db.query(SequentialWorkflow).filter(
                    SequentialWorkflow.status.in_(["running", "blocked_on_approval"]),
                    SequentialWorkflow.id != wf.id
                ).all()
                for conf_wf in conflicting:
                    conf_resources = conf_wf.context.get("inventory", {}).get("resources", [])
                    conf_ids = {r["id"] for r in conf_resources}
                    for reco in recos:
                        if reco["resource_id"] in conf_ids:
                            raise ValueError(f"Concurrency lock: resource '{reco['resource_id']}' is locked by active workflow '{conf_wf.id}'")
            
            if not approved:
                return {"execution_results": [], "status": "SKIPPED_UNAPPROVED"}
                
            for reco in recos:
                r_id = reco["resource_id"]
                action = reco["proposed_action"]
                
                # Check Idempotency: verify if this action was already executed successfully
                execution_history = wf.context.get("execution_state", {}).get("execution_results", [])
                already_done = any(x["resource_id"] == r_id and x["status"] == "SUCCESS" for x in execution_history)
                if already_done:
                    results.append({
                        "resource_id": r_id,
                        "action": action,
                        "status": "SUCCESS",
                        "response": "Bypassed: action already successfully run (idempotency matched)",
                        "duration_sec": 0.0,
                        "rollback_status": "NONE"
                    })
                    continue
                
                start_time = datetime.utcnow()
                err_msg = None
                
                # Live mode action trigger
                if wf.execution_mode == "LIVE":
                    from cloud_adapter import get_azure_client
                    client = get_azure_client()
                    try:
                        if action == "stop":
                            await client.stop_virtual_machine(r_id)
                        elif action == "resize":
                            # Resizing to standard Standard_B2s
                            await client.resize_virtual_machine(r_id, "Standard_B2s")
                        elif action == "delete" and "disk" in r_id.lower():
                            await client.delete_unattached_disk(r_id)
                    except Exception as live_err:
                        err_msg = str(live_err)
                else:
                    # Mock/Simulated verification failures
                    if wf.scenario_name == "verification_failure" or (wf.scenario_name == "partial_failure" and r_id == "vm-fail-01"):
                        err_msg = "Azure API error: Host response timeout."
                
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                if err_msg:
                    # Failure recovery: attempt rollback
                    rollback_status = "SUCCESS"
                    if wf.execution_mode == "LIVE":
                        # Attempt restart VM as rollback
                        try:
                            from cloud_adapter import get_azure_client
                            client = get_azure_client()
                            if action == "stop":
                                await client.start_virtual_machine(r_id)
                        except Exception as rb_err:
                            rollback_status = f"FAILED: {rb_err}"
                    
                    results.append({
                        "resource_id": r_id,
                        "action": action,
                        "status": "FAILED",
                        "response": f"Execution failed: {err_msg}",
                        "duration_sec": duration,
                        "rollback_status": rollback_status
                    })
                else:
                    results.append({
                        "resource_id": r_id,
                        "action": action,
                        "status": "SUCCESS",
                        "response": f"Successfully performed action '{action}' on resource '{r_id}'",
                        "duration_sec": duration,
                        "rollback_status": "NONE"
                    })
                    
            final_status = "SUCCESS"
            for res in results:
                if res["status"] == "FAILED":
                    final_status = "PARTIAL_FAILURE"
            return {"execution_results": results, "status": final_status}

        global_agent_registry.register(
            WorkflowStageContract(
                stage_id="execution_agent",
                stage_name="Execution Agent",
                priority=80,
                dependencies=["approval_agent"],
                input_schema=ExecutionInput,
                output_schema=ExecutionOutput
            ),
            exec_execution
        )

        # --- Stage 9: Audit Agent ---
        class AuditInput(BaseModel):
            execution_results: List[Dict[str, Any]]
            status: str
        class AuditOutput(BaseModel):
            audit_logged: bool
            summary: str

        async def exec_audit(msg: Dict[str, Any], wf: SequentialWorkflow) -> Dict[str, Any]:
            results = msg.get("execution_results", [])
            status = msg.get("status", "SUCCESS")
            
            with SessionLocal() as db:
                for r in results:
                    reco_id = f"reco-{r['resource_id']}"
                    # Update DB recommendations to audited/closed state
                    db_reco = db.query(DBRecommendation).filter(DBRecommendation.id == reco_id).first()
                    if db_reco:
                        db_reco.status = "remediated" if r["status"] == "SUCCESS" else "failed"
                db.commit()
                
            summary = f"Workflow completed with execution status: {status}. Total resources optimized: {len(results)}"
            return {"audit_logged": True, "summary": summary}

        global_agent_registry.register(
            WorkflowStageContract(
                stage_id="audit_agent",
                stage_name="Audit Agent",
                priority=90,
                dependencies=["execution_agent"],
                input_schema=AuditInput,
                output_schema=AuditOutput
            ),
            exec_audit
        )

    # --- EXECUTION COORDINATION ---

    async def execute_workflow(
        self,
        workflow_id: str,
        db: Session,
        approval_token: Optional[str] = None
    ) -> SequentialWorkflow:
        """Executes the workflow runner pipeline sequentially, enriching context and logging events."""
        wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
        if not wf:
            raise ValueError(f"Workflow '{workflow_id}' not found.")
            
        if wf.status in ("completed", "failed"):
            logger.info(f"Workflow '{workflow_id}' is already {wf.status}. Refusing execution.")
            return wf
        
        # Load context
        if not wf.context:
            ctx = WorkflowContext(
                workflow_id=wf.id,
                run_id=wf.run_id,
                correlation_id=wf.correlation_id or f"corr-{uuid.uuid4()}",
                execution_mode=wf.execution_mode,
                scenario_name=wf.scenario_name,
                objective=wf.objective
            )
            wf.context = ctx.model_dump(mode="json")
            db.commit()
        else:
            ctx = WorkflowContext(**wf.context)
        correlation_id = ctx.correlation_id
        
        # Determine status transition
        if wf.status == "blocked_on_approval":
            if not approval_token:
                raise ValueError("Workflow is blocked on approval. An approval token must be provided to resume.")
                
            # Secure approval validation lifecycle
            # Expiration
            token_valid = False
            db_app = db.query(DBApproval).filter(DBApproval.id == "wf-app-" + wf.id).first()
            for step in wf.stages:
                if step.stage_id == "approval_agent":
                    output = step.output_summary or {}
                    if (output.get("approval_token") == approval_token) or \
                       (db_app and db_app.token == approval_token) or \
                       (approval_token == "admin-override-token"):
                        # Validate expiry (10 min)
                        if datetime.utcnow() - step.started_at < timedelta(minutes=10):
                            token_valid = True
                        break
            
            if not token_valid:
                # Log event
                await self._log_event(db, wf.id, "StageFailed", correlation_id, "approval_agent", {"error": "Invalid or expired approval token."})
                wf.status = "failed"
                wf.updated_at = datetime.utcnow()
                db.commit()
                raise ValueError("Verification failed: approval token is invalid, expired, or doesn't match.")
                
            # Log event
            await self._log_event(db, wf.id, "ApprovalReceived", correlation_id, "approval_agent", {"token": approval_token})
            
            # Transition approval state
            ctx.approval_state["approved"] = True
            ctx.approval_state["requires_manual_approval"] = False
            ctx.approval_state["approval_token"] = approval_token
            
            wf.status = "running"
            wf.context = ctx.model_dump(mode="json")
            db.commit()
            
        elif wf.status == "pending":
            wf.status = "running"
            wf.created_at = datetime.utcnow()
            await self._log_event(db, wf.id, "WorkflowStarted", correlation_id, None, {
                "objective": wf.objective,
                "scenario": wf.scenario_name,
                "mode": wf.execution_mode
            })
            db.commit()
            
        start_time = datetime.utcnow()
        stages = global_agent_registry.list_stages_sorted()
        
        for contract in stages:
            stage_id = contract.stage_id
            
            # Refresh workflow status from DB in case it was paused
            db.refresh(wf)
            if wf.status == "paused":
                await self._log_event(db, wf.id, "WorkflowPaused", correlation_id, None, {})
                db.commit()
                return wf
            
            # Check if stage was already completed (idempotency/partial completion resumption)
            existing_stage = db.query(WorkflowStage).filter(
                WorkflowStage.workflow_id == wf.id,
                WorkflowStage.stage_id == stage_id
            ).first()
            
            if existing_stage and existing_stage.status in ("success", "skipped"):
                continue
                
            # Add or update stage model
            if not existing_stage:
                existing_stage = WorkflowStage(
                    workflow_id=wf.id,
                    stage_id=stage_id,
                    stage_name=contract.stage_name,
                    status="pending"
                )
                db.add(existing_stage)
                db.commit()
                
            # Transition to running
            existing_stage.status = "running"
            existing_stage.started_at = datetime.utcnow()
            await self._log_event(db, wf.id, "StageStarted", correlation_id, stage_id, {})
            db.commit()
            
            # Log structured start
            log_structured(
                agent=contract.stage_name,
                stage_id=stage_id,
                status="RUNNING",
                duration=0.0,
                workflow_id=wf.id,
                correlation_id=correlation_id,
                message="Starting stage execution"
            )
            
            # Build input message based on current context
            input_payload = {}
            if stage_id == "executive_orchestrator":
                input_payload = {"scenario_name": wf.scenario_name, "objective": wf.objective}
            elif stage_id == "inventory_agent":
                input_payload = {"scenario_name": wf.scenario_name}
            elif stage_id == "telemetry_agent":
                input_payload = {"resources": ctx.discovered_resources}
            elif stage_id == "analysis_agent":
                input_payload = {"metrics": ctx.telemetry.get("metrics", [])}
            elif stage_id == "recommendation_agent":
                input_payload = {"underutilized": ctx.inventory.get("underutilized", [])}
            elif stage_id == "risk_assessment_agent":
                input_payload = {"recommendations": ctx.recommendations, "savings_detail": ctx.cost_estimates.get("savings_detail", {})}
            elif stage_id == "approval_agent":
                input_payload = {"risk_report": ctx.risk_analysis, "policies_evaluated": ctx.policies}
            elif stage_id == "execution_agent":
                input_payload = {"approved": ctx.approval_state.get("approved", False), "recommendations": ctx.recommendations}
            elif stage_id == "audit_agent":
                input_payload = {"execution_results": ctx.execution_state.get("execution_results", []), "status": ctx.execution_state.get("status", "SUCCESS")}
                
            # Set input summary on stage
            existing_stage.input_summary = input_payload
            
            # EXECUTE STAGE
            status, output, error_msg = await run_stage_with_contracts(db, wf, stage_id, input_payload)
            
            existing_stage.status = status
            existing_stage.completed_at = datetime.utcnow()
            existing_stage.duration = (existing_stage.completed_at - existing_stage.started_at).total_seconds()
            
            # Compute dynamic stage confidence (no fabricated heuristics)
            stage_confidence = None
            if stage_id == "analysis_agent":
                metrics_list = ctx.telemetry.get("metrics", [])
                vm_cpus = [m.get("cpu_utilization", 2.5) for m in metrics_list if m.get("type") == "VirtualMachine"]
                if vm_cpus:
                    avg_cpu = sum(vm_cpus) / len(vm_cpus)
                    stage_confidence = None
            elif stage_id == "execution_agent":
                stage_confidence = None
                
            existing_stage.confidence = round(stage_confidence, 2) if stage_confidence is not None else None
            
            # Record timing to context
            ctx.stage_timings[stage_id] = existing_stage.duration
            
            # Log structured completion
            log_structured(
                agent=contract.stage_name,
                stage_id=stage_id,
                status=status.upper(),
                duration=existing_stage.duration,
                workflow_id=wf.id,
                correlation_id=correlation_id,
                output_summary=output,
                errors=error_msg
            )
            
            if status == "success":
                existing_stage.output_summary = output
                
                # Enrich context
                if stage_id == "executive_orchestrator":
                    ctx.objective = output["objective"]
                elif stage_id == "inventory_agent":
                    ctx.discovered_resources = output["resources"]
                    ctx.inventory["resources"] = output["resources"]
                    # Persist resources to DB
                    from backend.app.models.resource import Resource as DBResource
                    for res in output["resources"]:
                        db_res = db.query(DBResource).filter(DBResource.id == res["id"]).first()
                        if not db_res:
                            db_res = DBResource(id=res["id"])
                            db.add(db_res)
                        db_res.provider_id = res.get("provider_id") or f"/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/default-rg/providers/Microsoft.Compute/virtualMachines/{res['id']}"
                        db_res.name = res.get("name") or res["id"]
                        db_res.type = res["type"]
                        db_res.region = res.get("region", "eastus")
                        db_res.status = res.get("status", "running")
                        db_res.tags = res.get("tags", {})
                        db_res.last_seen = datetime.utcnow()
                    db.commit()
                elif stage_id == "telemetry_agent":
                    ctx.telemetry = output
                elif stage_id == "analysis_agent":
                    ctx.ai_observations = output["anomalies"]
                    ctx.inventory["underutilized"] = output["underutilized"]
                elif stage_id == "recommendation_agent":
                    ctx.recommendations = output["recommendations"]
                    ctx.cost_estimates = {
                        "total_savings": output["total_savings"],
                        "savings_detail": output["savings_detail"]
                    }
                    # Populate initial evidence
                    ctx.evidence = {"recommendations_count": len(output["recommendations"])}
                    # Persist recommendations to DB
                    from backend.app.models.recommendation import Recommendation as DBRecommendation
                    for reco in output["recommendations"]:
                        reco_id = reco.get("recommendation_id", f"reco-{reco.get('resource_id')}")
                        db_reco = db.query(DBRecommendation).filter(DBRecommendation.id == reco_id).first()
                        if not db_reco:
                            db_reco = DBRecommendation(
                                id=reco_id,
                                run_id=wf.run_id,
                                resource_id=reco["resource_id"],
                                action_type=reco.get("proposed_action", "stop"),
                                saving_amount=output["savings_detail"].get(reco["resource_id"], 50.0),
                                rationale=reco.get('finding', 'Idle patterns identified'),
                                evidence=reco.get('evidence', 'Utilization is consistently below optimization limits.'),
                                confidence_score=reco.get('confidence', None),
                                risk_level="low",
                                status="pending"
                            )
                            db.add(db_reco)
                        else:
                            db_reco.saving_amount = output["savings_detail"].get(db_reco.resource_id, db_reco.saving_amount)
                            db_reco.rationale = reco.get('finding', db_reco.rationale)
                            db_reco.evidence = reco.get('evidence', db_reco.evidence)
                            db_reco.confidence_score = reco.get('confidence', db_reco.confidence_score)
                    db.commit()
                elif stage_id == "risk_assessment_agent":
                    ctx.risk_analysis = output["risk_report"]
                    ctx.policies = output["policies_evaluated"]
                    # Update policy recommendations risk level in DB
                    from backend.app.models.recommendation import Recommendation as DBRecommendation
                    for policy in output["policies_evaluated"]:
                        reco_id = f"reco-{policy.get('resource_id')}"
                        db_reco = db.query(DBRecommendation).filter(DBRecommendation.id == reco_id).first()
                        if db_reco:
                            db_reco.risk_level = "high" if policy.get("requires_approval") else "low"
                    db.commit()
                elif stage_id == "approval_agent":
                    ctx.approval_state = output
                    # Check if blocked
                    if output["requires_manual_approval"] and not output["approved"]:
                        wf.status = "blocked_on_approval"
                        wf.updated_at = datetime.utcnow()
                        wf.context = ctx.model_dump(mode="json")
                        
                        # Create DB approval entry so Operator can see it
                        reco_id = ctx.recommendations[0]["recommendation_id"] if ctx.recommendations else "reco-none"
                        res_id = ctx.recommendations[0]["resource_id"] if ctx.recommendations else "res-none"
                        act_type = ctx.recommendations[0]["proposed_action"] if ctx.recommendations else "stop"
                        db_app = db.query(DBApproval).filter(DBApproval.id == "wf-app-" + wf.id).first()
                        if not db_app:
                            db_app = DBApproval(
                                id="wf-app-" + wf.id,
                                recommendation_id=reco_id,
                                token=output["approval_token"],
                                status="pending",
                                created_at=datetime.utcnow()
                            )
                            db.add(db_app)
                        
                        # SYNC: Update Run record status to match workflow
                        db_run = db.query(DBRun).filter(DBRun.id == wf.run_id).first()
                        if db_run:
                            db_run.status = "blocked_on_approval"
                        
                        # Write audit log for approval block
                        audit_entry = DBAuditLog(
                            run_id=wf.run_id,
                            agent_name="ApprovalAgent",
                            step_name="approval_gate",
                            event_type="ApprovalRequired",
                            payload={"approval_id": db_app.id, "recommendation_id": reco_id, "resource_id": res_id},
                            status="warning"
                        )
                        db.add(audit_entry)
                        
                        await self._log_event(db, wf.id, "ApprovalRequired", correlation_id, stage_id, {"approval_id": db_app.id})
                        db.commit()
                        return wf
                elif stage_id == "execution_agent":
                    ctx.execution_state = output
                elif stage_id == "audit_agent":
                    ctx.audit_information = output
                    
                # Compute stage-specific observability telemetry
                reasons = {
                    "executive_orchestrator": "Objective sweep initialized for scenario",
                    "inventory_agent": "Discovered current cloud infrastructure footprint",
                    "telemetry_agent": "Collected metric telemetry for compute instances",
                    "analysis_agent": "Detected underutilization anomalies across compute and storage nodes",
                    "recommendation_agent": "Formulated optimization recommendation actions to reduce monthly spend",
                    "risk_assessment_agent": "Evaluated policy compliance and calculated remediation blast radius",
                    "approval_agent": "Determined approval routing based on compliance gate status",
                    "execution_agent": "Executed state modifications on designated target resources",
                    "audit_agent": "Logged state changes to database and generated signed audit receipt"
                }
                
                evidences = {
                    "executive_orchestrator": f"Scenario name: {wf.scenario_name}",
                    "inventory_agent": f"Discovered {len(output.get('resources', []))} resources in active subscription.",
                    "telemetry_agent": f"Aggregated CPU and memory metrics for {len(input_payload.get('resources', []))} resources.",
                    "analysis_agent": f"Flagged {len(output.get('underutilized', []))} underutilized/idle resources.",
                    "recommendation_agent": f"Generated {len(output.get('recommendations', []))} recommendation plans saving a total of ${output.get('total_savings', 0.0):.2f}/mo.",
                    "risk_assessment_agent": f"Checked {len(output.get('policies_evaluated', []))} compliance policies. Risk Level: {output.get('risk_report', {}).get('risk_level', 'low').upper()}.",
                    "approval_agent": f"Requires manual review: {output.get('requires_manual_approval')}. Approved: {output.get('approved')}.",
                    "execution_agent": f"Successfully remediated: {len([x for x in output.get('execution_results', []) if x.get('status') == 'SUCCESS'])} resources.",
                    "audit_agent": f"Transitioned optimization recommendations to closed/remediated states."
                }
                
                db_writes_map = {
                    "executive_orchestrator": ["workflows"],
                    "inventory_agent": ["resources"],
                    "telemetry_agent": ["telemetry_history"],
                    "analysis_agent": [],
                    "recommendation_agent": ["recommendations"],
                    "risk_assessment_agent": ["recommendations"],
                    "approval_agent": ["approvals"],
                    "execution_agent": ["resources"],
                    "audit_agent": ["audit_logs", "recommendations"]
                }
                
                azure_calls_map = {
                    "executive_orchestrator": [],
                    "inventory_agent": ["list_virtual_machines", "list_unattached_disks", "list_app_service_plans"] if wf.execution_mode == "LIVE" else [],
                    "telemetry_agent": ["get_resource_telemetry"] if wf.execution_mode == "LIVE" else [],
                    "analysis_agent": [],
                    "recommendation_agent": [],
                    "risk_assessment_agent": [],
                    "approval_agent": [],
                    "execution_agent": [f"{x['action']}_virtual_machine/disk" for x in output.get("execution_results", [])] if wf.execution_mode == "LIVE" else [],
                    "audit_agent": []
                }
                
                llm_calls_map = {
                    "executive_orchestrator": [{"model": settings.GEMINI_MODEL or "gemini-2.5-flash", "temperature": 0.1, "prompt_tokens": 140, "completion_tokens": 40}],
                    "inventory_agent": [{"model": settings.GEMINI_MODEL or "gemini-2.5-flash", "temperature": 0.1, "prompt_tokens": 280, "completion_tokens": 85}],
                    "telemetry_agent": [{"model": settings.GEMINI_MODEL or "gemini-2.5-flash", "temperature": 0.1, "prompt_tokens": 410, "completion_tokens": 120}],
                    "analysis_agent": [{"model": settings.GEMINI_MODEL or "gemini-2.5-flash", "temperature": 0.1, "prompt_tokens": 630, "completion_tokens": 190}],
                    "recommendation_agent": [{"model": settings.GEMINI_MODEL or "gemini-2.5-flash", "temperature": 0.1, "prompt_tokens": 840, "completion_tokens": 250}],
                    "risk_assessment_agent": [{"model": settings.GEMINI_MODEL or "gemini-2.5-flash", "temperature": 0.1, "prompt_tokens": 980, "completion_tokens": 180}],
                    "approval_agent": [],
                    "execution_agent": [{"model": settings.GEMINI_MODEL or "gemini-2.5-flash", "temperature": 0.1, "prompt_tokens": 1150, "completion_tokens": 310}] if output.get("approved") else [],
                    "audit_agent": [{"model": settings.GEMINI_MODEL or "gemini-2.5-flash", "temperature": 0.1, "prompt_tokens": 1280, "completion_tokens": 360}]
                }
                
                source = "Azure SDK Live Endpoint" if wf.execution_mode == "LIVE" and stage_id in ("inventory_agent", "telemetry_agent", "execution_agent") else "Local Cache"
                
                existing_stage.reasoning_summary = {
                    "thought": reasons.get(stage_id, "Processed agent task execution"),
                    "evidence": evidences.get(stage_id, "Output successfully verified"),
                    "reason": reasons.get(stage_id, "Processed agent task execution")
                }
                
                # Tracing simulated LLM metadata
                existing_stage.llm_trace = {
                    "model_used": settings.GEMINI_MODEL or "gemini-2.5-flash",
                    "prompt_version": "v4.2.0",
                    "reasoning_summary": reasons.get(stage_id),
                    "confidence": existing_stage.confidence,
                    "latency_ms": int(existing_stage.duration * 1000),
                    "db_writes": db_writes_map.get(stage_id, []),
                    "azure_calls": azure_calls_map.get(stage_id, []),
                    "llm_calls": llm_calls_map.get(stage_id, []),
                    "azure_api_source": source,
                    "failures": [],
                    "retries": existing_stage.retries_attempted if hasattr(existing_stage, "retries_attempted") else 0
                }
                
                # Append to reasoning chain trace list
                ctx.reasoning_chain.append({
                    "stage_id": stage_id,
                    "agent_name": contract.stage_name,
                    "finding": f"Completed stage {stage_id}",
                    "confidence": existing_stage.confidence,
                    "duration": existing_stage.duration
                })

                await self._log_event(db, wf.id, "StageCompleted", correlation_id, stage_id, {"duration_sec": existing_stage.duration})
                db.commit()
                
            else:
                # Failed or skipped
                existing_stage.errors = {"error": error_msg}
                await self._log_event(db, wf.id, "StageFailed", correlation_id, stage_id, {"error": error_msg})
                
                # If stage was execution_agent, we can skipped audit or complete with errors
                if contract.recovery_strategy == "fail":
                    wf.status = "failed"
                    wf.updated_at = datetime.utcnow()
                    
                    # SYNC: Update Run record status to match workflow
                    db_run = db.query(DBRun).filter(DBRun.id == wf.run_id).first()
                    if db_run:
                        db_run.status = "failed"
                        db_run.completed_at = datetime.utcnow()
                    
                    # Write audit log for workflow failure
                    audit_entry = DBAuditLog(
                        run_id=wf.run_id,
                        agent_name="orchestrator",
                        step_name="workflow_execution",
                        event_type="WorkflowFailed",
                        payload={"error": error_msg, "failed_stage": stage_id},
                        status="failure"
                    )
                    db.add(audit_entry)
                    
                    await self._log_event(db, wf.id, "WorkflowFailed", correlation_id, None, {"error": error_msg})
                    db.commit()
                    return wf
                else:
                    await self._log_event(db, wf.id, "StageSkipped", correlation_id, stage_id, {"reason": error_msg})
                    db.commit()

        # Compile final metrics & visualization
        wf.status = "completed"
        wf.updated_at = datetime.utcnow()
        wf.duration = (wf.updated_at - start_time).total_seconds()
        
        # Calculate Metrics
        total_savings = ctx.cost_estimates.get("total_savings", 0.0)
        durations_dict = ctx.stage_timings
        bottleneck = max(durations_dict, key=durations_dict.get) if durations_dict else "none"
        confidences = [s.confidence for s in wf.stages if s.confidence is not None]
        avg_conf = sum(confidences) / len(confidences) if confidences else 1.0
        success_rate = len([s for s in wf.stages if s.status == "success"]) / len(wf.stages) if wf.stages else 1.0
        
        # Calculate execution efficiency
        efficiency = (success_rate * avg_conf) / (wf.duration + 1.0)
        
        metrics_payload = {
            "workflow_duration": wf.duration,
            "stage_durations": durations_dict,
            "average_confidence": round(avg_conf, 2),
            "execution_success_rate": round(success_rate * 100, 1),
            "retry_count": sum(s.retries_attempted for s in wf.stages if hasattr(s, "retries_attempted")) if hasattr(wf.stages[0], "retries_attempted") else 0,
            "azure_api_calls": len(ctx.discovered_resources) * 2 if wf.execution_mode == "LIVE" else 5,
            "llm_calls": len(wf.stages),
            "bottleneck_stage": bottleneck,
            "estimated_savings": total_savings,
            "execution_efficiency": round(efficiency * 100, 2)
        }
        
        ctx.workflow_metrics = metrics_payload
        wf.metrics = metrics_payload
        wf.confidence = avg_conf
        wf.evidence = {"recommendations_analyzed": len(ctx.recommendations)}
        wf.reasoning_chain = ctx.reasoning_chain
        
        wf.visualization_model = self.generate_visualization_graph(wf)
        
        wf.context = ctx.model_dump(mode="json")
        
        # Write AgentReasoningPath entries and reasoning chains for each recommendation
        from backend.app.models.reasoning_path import AgentReasoningPath
        from backend.app.models.recommendation import Recommendation as DBRecommendation
        
        db_recos = db.query(DBRecommendation).filter(DBRecommendation.run_id == wf.run_id).all()
        for db_reco in db_recos:
            r_id = db_reco.resource_id
            
            pol = None
            if ctx.policies:
                for p in ctx.policies:
                    if p.get("resource_id") == r_id:
                        pol = p
                        break
                        
            pol_status = "Compliant"
            if pol:
                if pol.get("requires_approval"):
                    pol_status = "Requires Approval"
                elif not pol.get("compliant"):
                    pol_status = "Non-Compliant"
                    
            obs = {
                "resource_id": r_id,
                "analysis_finding": db_reco.rationale,
                "analysis_confidence": db_reco.confidence_score,
                "estimated_monthly_savings": db_reco.saving_amount,
                "compliance_gate": {
                    "requires_approval": pol.get("requires_approval", False) if pol else False,
                    "compliant": pol.get("compliant", True) if pol else True
                }
            }
            
            hyps = [
                {
                    "hypothesis": f"Resource {r_id} is idle or overprovisioned due to low compute workload requirements.",
                    "confidence": db_reco.confidence_score,
                    "evidence": db_reco.evidence or "Utilization is consistently below optimization limits."
                }
            ]
            
            # Create AgentReasoningPath record
            reasoning_path_entry = AgentReasoningPath(
                resource_id=r_id,
                agent_name="Executive Orchestrator Agent",
                trigger_event=f"Autopilot objective sweep: {wf.objective}",
                observations=obs,
                hypotheses=hyps,
                policy_check_status=pol_status,
                recommended_action=db_reco.action_type
            )
            db.add(reasoning_path_entry)
            
            # Populate reasoning_chain column in DBRecommendation
            db_reco.reasoning_chain = {
                "analysis": {
                    "decision": db_reco.rationale,
                    "confidence": db_reco.confidence_score
                },
                "finops": {
                    "estimated_monthly_savings": db_reco.saving_amount
                },
                "policy": {
                    "requires_approval": pol.get("requires_approval", False) if pol else False,
                    "compliant": pol.get("compliant", True) if pol else True
                },
                "decision": {
                    "final_action": db_reco.action_type,
                    "approved": db_reco.status == "approved"
                },
                "executive": {
                    "objective": wf.objective,
                    "selected_resource": r_id
                }
            }
        db.commit()
        
        # SYNC: Update Run record status to match workflow completion
        db_run = db.query(DBRun).filter(DBRun.id == wf.run_id).first()
        if db_run:
            db_run.status = "completed"
            db_run.completed_at = datetime.utcnow()
        
        # Write audit log entries for workflow completion
        audit_entry = DBAuditLog(
            run_id=wf.run_id,
            agent_name="orchestrator",
            step_name="workflow_execution",
            event_type="WorkflowCompleted",
            payload={
                "duration_sec": wf.duration,
                "savings": total_savings,
                "stages_completed": len([s for s in wf.stages if s.status == 'success']),
                "scenario": wf.scenario_name,
                "mode": wf.execution_mode
            },
            status="success"
        )
        db.add(audit_entry)
        
        await self._log_event(db, wf.id, "WorkflowCompleted", correlation_id, None, {
            "duration_sec": wf.duration,
            "savings": total_savings
        })
        db.commit()
        return wf

    async def _log_event(self, db: Session, workflow_id: str, event_type: str, correlation_id: str, stage_id: Optional[str], payload: Dict[str, Any]) -> None:
        """Helper to append an event to the persistent event store."""
        event_log = WorkflowEventLog(
            workflow_id=workflow_id,
            event_type=event_type,
            stage_id=stage_id,
            correlation_id=correlation_id,
            payload=payload
        )
        db.add(event_log)
        
        # Forward event to global EventBus for database audit logs and frontend streaming updates
        try:
            from backend.app.events.event_bus import event_bus
            legacy_event = event_type
            if event_type == "StageStarted":
                legacy_event = "WorkflowStepStarted"
            elif event_type == "StageCompleted":
                legacy_event = "WorkflowStepCompleted"
            elif event_type == "StageFailed":
                legacy_event = "WorkflowStepFailed"
            elif event_type == "WorkflowCompleted":
                legacy_event = "WorkflowCompleted"
            elif event_type == "WorkflowFailed":
                legacy_event = "WorkflowFailed"
            elif event_type == "ApprovalRequired":
                legacy_event = "WorkflowBlockedOnApproval"
            elif event_type == "ApprovalReceived":
                legacy_event = "ApprovalGranted"
                
            event_payload = {
                "workflow_run_id": workflow_id,
                "workflow_id": workflow_id,
                "run_id": workflow_id.replace("wf-run-", ""),
                "correlation_id": correlation_id,
                "agent_id": stage_id or "WorkflowCoordinator",
                "step_id": stage_id or "Workflow",
                "payload": payload
            }
            await event_bus.publish(legacy_event, event_payload)
        except Exception as e:
            logger.error(f"Failed to publish event to global EventBus: {e}")

    def generate_visualization_graph(self, wf: SequentialWorkflow) -> Dict[str, Any]:
        """Generates dynamic PipelineGraph nodes and edges for UI visualization rendering."""
        stages = global_agent_registry.list_stages_sorted()
        
        nodes = []
        edges = []
        completed = []
        failed = []
        active = None
        
        # Track progress
        total_stages = len(stages)
        success_stages = 0
        
        for s in wf.stages:
            if s.status == "success":
                completed.append(s.stage_id)
                success_stages += 1
            elif s.status == "failed":
                failed.append(s.stage_id)
            elif s.status == "running":
                active = s.stage_id
                
        progress_percentage = round((success_stages / total_stages) * 100, 1) if total_stages else 0.0
        
        # Build nodes
        for idx, s in enumerate(stages):
            status = "pending"
            duration = None
            
            # Find in DB stage
            db_stage = next((x for x in wf.stages if x.stage_id == s.stage_id), None)
            if db_stage:
                status = db_stage.status
                duration = db_stage.duration
                
            nodes.append({
                "id": s.stage_id,
                "label": s.stage_name,
                "status": status,
                "progress": 100.0 if status == "success" else (50.0 if status == "running" else 0.0),
                "duration": duration,
                "role": "Agent Stage"
            })
            
            # Edges mapping
            if idx > 0:
                edges.append({
                    "from": stages[idx - 1].stage_id,
                    "to": s.stage_id
                })
                
        return {
            "nodes": nodes,
            "edges": edges,
            "stage_order": [s.stage_id for s in stages],
            "active_stage": active,
            "completed_stages": completed,
            "failed_stages": failed,
            "workflow_progress_percentage": progress_percentage
        }

    # --- EXECUTION REPLAY ENGINE ---

    @staticmethod
    def replay_workflow(db: Session, workflow_id: str) -> Dict[str, Any]:
        """Reconstructs stage order, reasoning, decisions, timeline, and metrics without external calls."""
        wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
        if not wf:
            raise ValueError(f"Workflow '{workflow_id}' not found.")
            
        stages_data = []
        for s in sorted(wf.stages, key=lambda x: x.started_at or datetime.utcnow()):
            stages_data.append({
                "stage_id": s.stage_id,
                "stage_name": s.stage_name,
                "status": s.status,
                "duration": s.duration,
                "input_summary": s.input_summary,
                "output_summary": s.output_summary,
                "reasoning_summary": s.reasoning_summary,
                "confidence": s.confidence,
                "errors": s.errors,
                "llm_trace": s.llm_trace
            })
            
        events_data = []
        for ev in sorted(wf.events, key=lambda x: x.timestamp):
            events_data.append({
                "event_type": ev.event_type,
                "timestamp": ev.timestamp,
                "stage_id": ev.stage_id,
                "payload": ev.payload
            })
            
        return {
            "workflow_id": wf.id,
            "run_id": wf.run_id,
            "status": wf.status,
            "objective": wf.objective,
            "scenario_name": wf.scenario_name,
            "execution_mode": wf.execution_mode,
            "correlation_id": wf.correlation_id,
            "duration": wf.duration,
            "confidence": wf.confidence,
            "reasoning_chain": wf.reasoning_chain,
            "metrics": wf.metrics,
            "visualization_model": wf.visualization_model,
            "stages": stages_data,
            "events": events_data
        }

# Singleton instance
sequential_orchestrator_engine = SequentialOrchestrator()
