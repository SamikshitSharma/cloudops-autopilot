from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

from backend.app.database import get_db
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

router = APIRouter(prefix="/workflows", tags=["Sequential Workflows"])

class TriggerWorkflowRequest(BaseModel):
    scenario_name: str
    objective: Optional[str] = None
    execution_mode: str = "MOCK"  # MOCK or LIVE

class ApproveWorkflowRequest(BaseModel):
    approval_token: str

@router.post("", response_model=Dict[str, Any])
async def trigger_workflow(req: TriggerWorkflowRequest, db: Session = Depends(get_db)):
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
    
    # 2. Build initial Workflow Context
    initial_context = WorkflowContext(
        workflow_id=f"wf-run-{run_id}",
        run_id=run_id,
        correlation_id=correlation_id,
        execution_mode=req.execution_mode,
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
        execution_mode=req.execution_mode,
        correlation_id=correlation_id,
        context=initial_context.model_dump(mode="json")
    )
    db.add(wf)
    db.commit()
    
    # 4. Trigger execution
    try:
        wf = await sequential_orchestrator_engine.execute_workflow(wf.id, db)
        return {
            "workflow_id": wf.id,
            "status": wf.status,
            "correlation_id": wf.correlation_id,
            "execution_mode": wf.execution_mode,
            "message": "Workflow started successfully."
        }
    except Exception as e:
        db.commit()  # commit failure status if updated
        raise HTTPException(status_code=500, detail=f"Workflow execution failed: {str(e)}")

@router.get("", response_model=List[WorkflowCard])
def list_workflow_history(db: Session = Depends(get_db)):
    """Retrieves all historical and active sequential workflow execution logs."""
    workflows = db.query(SequentialWorkflow).order_by(SequentialWorkflow.created_at.desc()).all()
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
    workflows = db.query(SequentialWorkflow).all()
    total = len(workflows)
    if total == 0:
        return AggregatedMetricsDTO(
            total_workflow_executions=0,
            success_rate=0.0,
            failure_rate=0.0,
            average_workflow_duration=0.0,
            average_stage_duration={},
            average_confidence=0.0,
            estimated_total_savings=0.0,
            most_common_failure_reasons=[],
            azure_api_utilization_statistics={}
        )
        
    completed = [w for w in workflows if w.status == "completed"]
    failed = [w for w in workflows if w.status == "failed"]
    
    success_rate = (len(completed) / total) * 100
    failure_rate = (len(failed) / total) * 100
    
    durations = [w.duration for w in workflows if w.duration is not None]
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    
    confidences = [w.confidence for w in workflows if w.confidence is not None]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 1.0
    
    savings = [w.metrics.get("estimated_savings", 0.0) for w in workflows if w.metrics]
    total_savings = sum(savings)
    
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
    
    # Azure API calls simulation metrics
    api_calls = 0
    for w in workflows:
        if w.metrics:
            api_calls += w.metrics.get("azure_api_calls", 0)
            
    azure_stats = {
        "list_resources": int(api_calls * 0.4),
        "get_metrics": int(api_calls * 0.4),
        "remediation_actions": int(api_calls * 0.2)
    }
    
    return AggregatedMetricsDTO(
        total_workflow_executions=total,
        success_rate=round(success_rate, 2),
        failure_rate=round(failure_rate, 2),
        average_workflow_duration=round(avg_duration, 2),
        average_stage_duration=avg_stage_durations,
        average_confidence=round(avg_confidence, 2),
        estimated_total_savings=round(total_savings, 2),
        most_common_failure_reasons=common_failures,
        azure_api_utilization_statistics=azure_stats
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
async def approve_workflow_run(workflow_id: str, req: ApproveWorkflowRequest, db: Session = Depends(get_db)):
    """Processes verification of a signed approval token and resumes execution."""
    wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
        
    if wf.status != "blocked_on_approval":
        raise HTTPException(status_code=400, detail="Workflow execution is not blocked awaiting approval.")
        
    try:
        wf = await sequential_orchestrator_engine.execute_workflow(
            workflow_id=wf.id,
            db=db,
            approval_token=req.approval_token
        )
        return {
            "workflow_id": wf.id,
            "status": wf.status,
            "message": "Workflow successfully resumed execution."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
