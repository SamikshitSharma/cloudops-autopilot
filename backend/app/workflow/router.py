from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
import uuid
import logging
from datetime import datetime

from backend.app.database import get_db, SessionLocal
from backend.app.models.run import Run as DBRun
from backend.app.models.workflow import SequentialWorkflow, WorkflowStage, WorkflowEventLog
from backend.app.workflow.sequential_orchestrator import sequential_orchestrator_engine
from backend.app.schemas.workflow import (
    WorkflowContext,
    WorkflowCard,
    PipelineGraph,
    TimelineCard,
    AgentExecutionCard,
    ReasoningCard,
    MetricsCard,
    ExecutionSummary,
    LiveWorkflowState,
    AggregatedMetricsDTO
)
from pydantic import BaseModel

logger = logging.getLogger("WorkflowsRouter")

async def run_workflow_bg(workflow_id: str):
    with SessionLocal() as db:
        try:
            await sequential_orchestrator_engine.execute_workflow(workflow_id, db)
        except Exception as e:
            logger.error(f"Background workflow run '{workflow_id}' failed: {e}", exc_info=True)


router = APIRouter(prefix="/workflows", tags=["Sequential Workflows"])

class TriggerWorkflowRequest(BaseModel):
    scenario_name: str
    objective: Optional[str] = None
    execution_mode: str = "MOCK"  # MOCK or LIVE

class ApproveWorkflowRequest(BaseModel):
    approval_token: str

@router.post("", response_model=Dict[str, Any])
async def trigger_workflow(req: TriggerWorkflowRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Initiates a new sequential multi-agent workflow run."""
    run_id = str(uuid.uuid4())
    correlation_id = f"corr-{uuid.uuid4()}"
    
    # 1. Ensure a DBRun exists for foreign key constraints
    db_run = DBRun(
        id=run_id,
        status="running",
        started_at=datetime.utcnow()
    )
    db.add(db_run)
    db.commit()
    
    from cloud_adapter import get_azure_client
    cloud_mode = get_azure_client().get_mode()
    
    # 2. Build initial Workflow Context
    initial_context = WorkflowContext(
        workflow_id=f"wf-run-{run_id}",
        run_id=run_id,
        correlation_id=correlation_id,
        execution_mode=cloud_mode,
        scenario_name=req.scenario_name,
        objective=req.objective
    )
    
    # 3. Create SequentialWorkflow record
    wf = SequentialWorkflow(
        id=f"wf-run-{run_id}",
        run_id=run_id,
        status="pending",
        objective=req.objective or f"Sweep scenario: {req.scenario_name}",
        scenario_name=req.scenario_name,
        execution_mode=cloud_mode,
        correlation_id=correlation_id,
        context=initial_context.model_dump(mode="json")
    )
    db.add(wf)
    db.commit()
    
    # 4. Trigger execution in background
    try:
        background_tasks.add_task(run_workflow_bg, wf.id)
        return {
            "workflow_id": wf.id,
            "status": "pending",
            "correlation_id": wf.correlation_id,
            "execution_mode": wf.execution_mode,
            "message": "Workflow started successfully in background."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Workflow trigger failed: {str(e)}")

@router.get("", response_model=List[WorkflowCard])
def list_workflow_history(db: Session = Depends(get_db)):
    """Retrieves all historical and active sequential workflow execution logs."""
    from cloud_adapter import get_azure_client
    cloud_mode = get_azure_client().get_mode()
    workflows = db.query(SequentialWorkflow).filter(SequentialWorkflow.execution_mode == cloud_mode).order_by(SequentialWorkflow.created_at.desc()).all()
    results = []
    
    for wf in workflows:
        ctx = wf.context or {}
        savings = wf.metrics.get("estimated_savings", 0.0) if wf.metrics else 0.0
        duration = wf.duration
        
        # Calculate progress percentage based on stage count
        success_stages = len([s for s in wf.stages if s.status == "success"])
        total_stages = 9  # Total agent stages in pipeline
        progress = round((success_stages / total_stages) * 100, 1)
        if wf.status == "completed":
            progress = 100.0
            
        results.append(WorkflowCard(
            workflow_id=wf.id,
            run_id=wf.run_id,
            correlation_id=wf.correlation_id,
            status=wf.status,
            objective=wf.objective,
            scenario_name=wf.scenario_name,
            execution_mode=wf.execution_mode,
            created_at=wf.created_at,
            updated_at=wf.updated_at,
            progress_percentage=progress,
            duration_seconds=duration,
            confidence=wf.confidence or 1.0,
            estimated_savings=savings
        ))
        
    return results

@router.get("/metrics/summary", response_model=AggregatedMetricsDTO)
def get_aggregated_metrics(db: Session = Depends(get_db)):
    """Exposes consolidated system performance metrics and Azure SDK utilization logs."""
    from cloud_adapter import get_azure_client
    cloud_mode = get_azure_client().get_mode()
    
    from backend.app.models.resource import Resource as DBResource
    from backend.app.models.recommendation import Recommendation as DBRecommendation, Approval as DBApproval
    from backend.app.models.run import AuditLog as DBAuditLog
    
    total_resources = db.query(DBResource).count()
    workflows = db.query(SequentialWorkflow).filter(SequentialWorkflow.execution_mode == cloud_mode).all()
    total = len(workflows)
    
    completed = [w for w in workflows if w.status == "completed"]
    failed = [w for w in workflows if w.status == "failed"]
    
    from datetime import date
    first_day_of_month = datetime(date.today().year, date.today().month, 1)
    from backend.app.models.run import Run as DBRun
 
    # Denominator rule: Success / Failure rate must use total workflows
    if total > 0:
        success_rate = (len(completed) / total) * 100
        failure_rate = (len(failed) / total) * 100
    else:
        success_rate = 0.0
        failure_rate = 0.0
        
    durations = [w.duration for w in workflows if w.duration is not None]
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    
    completed_confidences = [w.confidence for w in completed if w.confidence is not None]
    avg_confidence = sum(completed_confidences) / len(completed_confidences) if completed_confidences else None
    
    # Monthly savings: sum of approved, remediated, or executed recommendations this month
    approved_recos_this_month = db.query(DBRecommendation).join(DBRun).join(
        SequentialWorkflow, SequentialWorkflow.run_id == DBRun.id
    ).filter(
        DBRecommendation.status.in_(["approved", "remediated", "executed"]),
        DBRun.started_at >= first_day_of_month,
        SequentialWorkflow.execution_mode == cloud_mode
    ).all()
    total_savings = sum(r.saving_amount for r in approved_recos_this_month if r.saving_amount is not None)
    
    # Calculate average stage durations
    stage_durations: Dict[str, float] = {}
    stage_counts: Dict[str, int] = {}
    
    for w in workflows:
        for stage in w.stages:
            if stage.duration is not None:
                stage_durations[stage.stage_id] = stage_durations.get(stage.stage_id, 0.0) + stage.duration
                stage_counts[stage.stage_id] = stage_counts.get(stage.stage_id, 0) + 1
                
    avg_stage_durations = {
        sid: round(stage_durations[sid] / stage_counts[sid], 2)
        for sid in stage_durations
    }
    
    # Calculate failure reasons
    failures_map: Dict[str, int] = {}
    for w in workflows:
        if w.errors:
            err_str = str(w.errors)
            failures_map[err_str] = failures_map.get(err_str, 0) + 1
        for stage in w.stages:
            if stage.status == "failed" and stage.errors:
                err_str = str(stage.errors.get("error", "Unknown"))
                failures_map[err_str] = failures_map.get(err_str, 0) + 1
                
    common_failures = [
        {"reason": r, "count": c}
        for r, c in sorted(failures_map.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    # Azure API calls from database workflow runs
    list_resources_calls = 0
    get_metrics_calls = 0
    remediation_actions_calls = 0
    
    for w in workflows:
        # Check completed stages for this workflow
        stages_dict = {s.stage_id: s for s in w.stages}
        
        # inventory_agent (list resources)
        if "inventory_agent" in stages_dict and stages_dict["inventory_agent"].status == "success":
            list_resources_calls += 3 if w.execution_mode == "LIVE" else 1
            
        # telemetry_agent (get metrics)
        if "telemetry_agent" in stages_dict and stages_dict["telemetry_agent"].status == "success":
            output_sum = stages_dict["telemetry_agent"].output_summary or {}
            metrics_count = len(output_sum.get("metrics", []))
            get_metrics_calls += metrics_count if metrics_count > 0 else 1
            
        # execution_agent (remediation)
        if "execution_agent" in stages_dict and stages_dict["execution_agent"].status == "success":
            output_sum = stages_dict["execution_agent"].output_summary or {}
            results_count = len(output_sum.get("execution_results", []))
            remediation_actions_calls += results_count if results_count > 0 else 1
            
    azure_stats = {
        "list_resources": list_resources_calls,
        "get_metrics": get_metrics_calls,
        "remediation_actions": remediation_actions_calls
    }
    
    # Extra Executive KPIs calculations
    regions = db.query(DBResource.region).distinct().all()
    azure_regions = len([r[0] for r in regions if r[0]])
    
    running_workflows = len([w for w in workflows if w.status in ("running", "pending", "blocked_on_approval")])
    pending_approvals = db.query(DBApproval).join(DBRecommendation).join(DBRun).join(
        SequentialWorkflow, SequentialWorkflow.run_id == DBRun.id
    ).filter(
        DBApproval.status == "pending",
        SequentialWorkflow.execution_mode == cloud_mode
    ).count()
    
    # resources_optimized_today: count recommendations remediated/executed from workflows completed today
    # IMPORTANT: All timestamps are stored as UTC. Use utcnow().date() to avoid timezone drift.
    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    today_completed_wf_run_ids = [w.run_id for w in workflows if w.status == "completed" and w.updated_at and w.updated_at >= today_start]
    if today_completed_wf_run_ids:
        resources_optimized_today = db.query(DBRecommendation).filter(
            DBRecommendation.status.in_(["remediated", "executed"]),
            DBRecommendation.run_id.in_(today_completed_wf_run_ids)
        ).count()
        cost_saved_today = sum(
            r.saving_amount for r in db.query(DBRecommendation).filter(
                DBRecommendation.status.in_(["remediated", "executed"]),
                DBRecommendation.run_id.in_(today_completed_wf_run_ids)
            ).all() if r.saving_amount is not None
        )
    else:
        resources_optimized_today = 0
        cost_saved_today = 0.0
    
    cost_saved_this_month = total_savings
    
    # policies checked is equal to count of runs * number of policy engines evaluated in the policy agent
    policies_checked = total * 3
    
    # Honestly count LLM and Azure API calls from persisted stage execution traces
    from backend.app.models.workflow import WorkflowStage
    stages = db.query(WorkflowStage).all()
    llm_requests = 0
    azure_api_calls_today = 0
    for stage in stages:
        if stage.llm_trace and isinstance(stage.llm_trace, dict):
            # Sum LLM requests
            calls = stage.llm_trace.get("llm_calls")
            if isinstance(calls, list):
                llm_requests += len(calls)
            # Sum Azure API calls completed today
            if stage.completed_at and stage.completed_at >= today_start:
                az_calls = stage.llm_trace.get("azure_calls")
                if isinstance(az_calls, list):
                    azure_api_calls_today += len(az_calls)
                    
    events_processed = db.query(WorkflowEventLog).count()
    
    if total == 0:
        return AggregatedMetricsDTO(
            total_workflow_executions=0,
            success_rate=0.0,
            failure_rate=0.0,
            average_workflow_duration=0.0,
            average_stage_duration={},
            average_confidence=1.0,
            estimated_total_savings=0.0,
            most_common_failure_reasons=[],
            azure_api_utilization_statistics={},
            total_discovered_resources=0,
            active_agents=9,
            azure_resources_managed=0,
            azure_regions=0,
            running_workflows=0,
            pending_approvals=0,
            resources_optimized_today=0,
            resources_under_observation=0,
            cost_saved_today=0.0,
            cost_saved_this_month=0.0,
            policies_checked=0,
            azure_api_calls_today=0,
            llm_requests=0,
            events_processed=0
        )
        
    return AggregatedMetricsDTO(
        total_workflow_executions=total,
        success_rate=round(success_rate, 2),
        failure_rate=round(failure_rate, 2),
        average_workflow_duration=round(avg_duration, 2),
        average_stage_duration=avg_stage_durations,
        average_confidence=round(avg_confidence, 2) if avg_confidence is not None else 1.0,
        estimated_total_savings=round(total_savings, 2) if total_savings is not None else 0.0,
        most_common_failure_reasons=common_failures,
        azure_api_utilization_statistics=azure_stats,
        total_discovered_resources=total_resources,
        active_agents=9,
        azure_resources_managed=total_resources,
        azure_regions=azure_regions,
        running_workflows=running_workflows,
        pending_approvals=pending_approvals,
        resources_optimized_today=resources_optimized_today,
        resources_under_observation=total_resources,
        cost_saved_today=round(cost_saved_today, 2),
        cost_saved_this_month=round(cost_saved_this_month, 2),
        policies_checked=policies_checked,
        azure_api_calls_today=azure_api_calls_today,
        llm_requests=llm_requests,
        events_processed=events_processed
    )

@router.get("/{workflow_id}", response_model=Dict[str, Any])
def get_workflow_context(workflow_id: str, db: Session = Depends(get_db)):
    """Retrieves full execution context and trace state for a single workflow execution."""
    wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
        
    return {
        "workflow_id": wf.id,
        "run_id": wf.run_id,
        "status": wf.status,
        "objective": wf.objective,
        "scenario_name": wf.scenario_name,
        "execution_mode": wf.execution_mode,
        "correlation_id": wf.correlation_id,
        "created_at": wf.created_at,
        "updated_at": wf.updated_at,
        "context": wf.context,
        "metrics": wf.metrics,
        "visualization_model": wf.visualization_model,
        "reasoning_chain": wf.reasoning_chain,
        "stages": [
            {
                "id": s.id,
                "stage_id": s.stage_id,
                "stage_name": s.stage_name,
                "status": s.status,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                "duration": s.duration,
                "input_summary": s.input_summary,
                "output_summary": s.output_summary,
                "reasoning_summary": s.reasoning_summary,
                "confidence": s.confidence,
                "errors": s.errors,
                "llm_trace": s.llm_trace
            } for s in wf.stages
        ]
    }

@router.get("/{workflow_id}/timeline", response_model=List[TimelineCard])
def get_workflow_timeline(workflow_id: str, db: Session = Depends(get_db)):
    """Retrieves the execution duration, order, and lifecycle timings of each stage."""
    wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
        
    results = []
    # Sort stages by start time
    stages = sorted(wf.stages, key=lambda x: x.started_at or datetime.utcnow())
    for s in stages:
        results.append(TimelineCard(
            stage_id=s.stage_id,
            stage_name=s.stage_name,
            status=s.status,
            started_at=s.started_at,
            completed_at=s.completed_at,
            duration_seconds=s.duration
        ))
    return results

@router.get("/{workflow_id}/state", response_model=LiveWorkflowState)
def get_live_workflow_state(workflow_id: str, db: Session = Depends(get_db)):
    """Exposes a lightweight, polling-ready live state object for UI pipelines."""
    wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
        
    completed = []
    running = None
    remaining = []
    
    from backend.app.workflow.agent_registry import global_agent_registry
    all_stages = [s.stage_id for s in global_agent_registry.list_stages_sorted()]
    
    for s in wf.stages:
        if s.status in ("success", "skipped"):
            completed.append(s.stage_id)
        elif s.status == "running":
            running = s.stage_id
            
    for sid in all_stages:
        if sid not in completed and sid != running:
            remaining.append(sid)
            
    total = len(all_stages)
    progress = (len(completed) / total) * 100 if total else 0.0
    if wf.status == "completed":
        progress = 100.0
        
    active_agent = None
    reasoning = None
    
    if running:
        active_stage_obj = next((x for x in wf.stages if x.stage_id == running), None)
        if active_stage_obj:
            active_agent = active_stage_obj.stage_name
            reasoning = f"Executing cognitive capabilities in stage {active_stage_obj.stage_name}"
            
    return LiveWorkflowState(
        workflow_id=wf.id,
        status=wf.status,
        current_stage=running,
        completed_stages=completed,
        remaining_stages=remaining,
        progress_percentage=round(progress, 1),
        estimated_time_remaining_seconds=len(remaining) * 2.0,
        active_agent=active_agent,
        current_reasoning_summary=reasoning,
        correlation_id=wf.correlation_id,
        execution_mode=wf.execution_mode
    )

@router.get("/{workflow_id}/visualization", response_model=PipelineGraph)
def get_pipeline_visualization(workflow_id: str, db: Session = Depends(get_db)):
    """Returns nodes and edges mapping the sequential collaborative layout."""
    wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
        
    graph_data = wf.visualization_model or {}
    return PipelineGraph(**graph_data)

@router.get("/{workflow_id}/replay", response_model=Dict[str, Any])
def replay_workflow_run(workflow_id: str, db: Session = Depends(get_db)):
    """Reconstructs decisions, confidence, and telemetry from DB history without making cloud API calls."""
    try:
        replay_data = sequential_orchestrator_engine.replay_workflow(db, workflow_id)
        return replay_data
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{workflow_id}/approve", response_model=Dict[str, Any])
async def approve_workflow_run(workflow_id: str, req: ApproveWorkflowRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Processes verification of a signed approval token and resumes execution."""
    wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
        
    if wf.status != "blocked_on_approval":
        raise HTTPException(status_code=400, detail="Workflow execution is not blocked awaiting approval.")
        
    try:
        # Generate and apply resume in background
        wf.status = "running"
        db.commit()
        
        async def resume_workflow_action_bg(wf_id: str, token: str):
            with SessionLocal() as local_db:
                try:
                    await sequential_orchestrator_engine.execute_workflow(
                        workflow_id=wf_id,
                        db=local_db,
                        approval_token=token
                    )
                except Exception as resume_err:
                    logger.error(f"Failed to resume workflow run '{wf_id}' in background: {resume_err}", exc_info=True)
                    
        background_tasks.add_task(resume_workflow_action_bg, wf.id, req.approval_token)
        return {
            "workflow_id": wf.id,
            "status": "running",
            "message": "Workflow resume successfully triggered in background."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{workflow_id}/pause", response_model=Dict[str, Any])
async def pause_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """Pauses an active workflow run at the next stage boundary."""
    wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
    if wf.status != "running":
        raise HTTPException(status_code=400, detail=f"Workflow status is {wf.status}, cannot pause.")
    wf.status = "paused"
    db.commit()
    return {"workflow_id": workflow_id, "status": "paused", "message": "Workflow successfully paused."}

@router.post("/{workflow_id}/resume", response_model=Dict[str, Any])
async def resume_workflow(workflow_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Resumes a paused workflow run in the background."""
    wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
    if wf.status != "paused":
        raise HTTPException(status_code=400, detail=f"Workflow status is {wf.status}, cannot resume.")
    wf.status = "running"
    db.commit()
    background_tasks.add_task(run_workflow_bg, wf.id)
    return {"workflow_id": workflow_id, "status": "running", "message": "Workflow successfully resumed."}

@router.post("/{workflow_id}/rerun", response_model=Dict[str, Any])
async def rerun_workflow(workflow_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Deletes existing run data for the workflow and triggers execution from the first stage."""
    wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
        
    from backend.app.models.recommendation import Recommendation as DBRecommendation, Approval as DBApproval
    
    # Delete dependent workflow stage runs
    db.query(WorkflowStage).filter(WorkflowStage.workflow_id == workflow_id).delete()
    
    # Delete event logs
    db.query(WorkflowEventLog).filter(WorkflowEventLog.workflow_id == workflow_id).delete()
    
    # Delete associated recommendations and approvals for this run
    recos = db.query(DBRecommendation).filter(DBRecommendation.run_id == workflow_id).all()
    reco_ids = [r.id for r in recos]
    
    if reco_ids:
        # Delete approvals for those recommendations
        db.query(DBApproval).filter(DBApproval.recommendation_id.in_(reco_ids)).delete(synchronize_session=False)
        # Delete recommendations
        db.query(DBRecommendation).filter(DBRecommendation.id.in_(reco_ids)).delete(synchronize_session=False)
        
    # Reset workflow status and metrics
    wf.status = "pending"
    wf.confidence = 1.0
    wf.duration = 0.0
    wf.errors = {}
    wf.metrics = {}
    wf.current_stage = None
    
    db.commit()
    
    # Trigger background execution
    background_tasks.add_task(run_workflow_bg, wf.id)
    
    return {"workflow_id": workflow_id, "status": "pending", "message": "Workflow rerun successfully triggered in background."}
