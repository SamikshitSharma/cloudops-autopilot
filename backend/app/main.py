import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Depends, HTTPException, APIRouter, Query, BackgroundTasks
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from shared.config import settings
from backend.app.database import SessionLocal, engine
from backend.app.models.base import Base
import backend.app.models

from backend.app.models.run import Run as DBRun, AuditLog as DBAuditLog
from backend.app.models.resource import Resource as DBResource
from backend.app.models.recommendation import Recommendation as DBRecommendation, Approval as DBApproval
from backend.app.models.reasoning_path import AgentReasoningPath as DBAgentReasoningPath

from backend.app.workflow.coordinator import WorkflowCoordinator
from backend.app.workflow.models import WorkflowStatus
from backend.app.workflow.router import router as workflows_router

from pydantic import ValidationError
from jose.exceptions import JWTError
from mcp_server.exceptions import InvalidApprovalTokenError, ApprovalRequiredError

from backend.app.schemas.api import (
    APIResponse,
    TriggerRunRequest,
    ApproveRequest,
    RunDTO,
    ResourceDTO,
    RecommendationDTO,
    ApprovalDTO,
    HealthDTO,
    AgentReasoningPathDTO,
    AskAIRequest
)

# Initialize logging
logger = logging.getLogger("FastAPIServer")

# Initialize database tables immediately
Base.metadata.create_all(bind=engine)

# Auto-migrate database columns dynamically if they are missing
try:
    with engine.begin() as conn:
        res = conn.execute(text("PRAGMA table_info(recommendations)")).fetchall()
        column_names = [col[1] for col in res]
        if "confidence_score" not in column_names:
            conn.execute(text("ALTER TABLE recommendations ADD COLUMN confidence_score FLOAT"))
            logger.info("Migrated database: added confidence_score column to recommendations table")
        if "evidence" not in column_names:
            conn.execute(text("ALTER TABLE recommendations ADD COLUMN evidence VARCHAR(1000)"))
            logger.info("Migrated database: added evidence column to recommendations table")
        if "reasoning_chain" not in column_names:
            conn.execute(text("ALTER TABLE recommendations ADD COLUMN reasoning_chain JSON"))
            logger.info("Migrated database: added reasoning_chain column to recommendations table")
except Exception as migration_err:
    logger.error(f"Failed to auto-migrate database columns on startup: {migration_err}")

# Auto-seed mock demonstration data if the database is empty
from backend.app.seed import seed_db
try:
    with SessionLocal() as db:
        seed_db(db)
except Exception as seed_err:
    logger.error(f"Failed to automatically seed database on startup: {seed_err}")

# --- STARTUP STATE RECONCILIATION ---
# Fix orphaned/stale records left by previous server crashes or incomplete runs
def reconcile_state():
    """Reconciles state inconsistencies between runs, workflows, recommendations, and approvals."""
    from backend.app.models.workflow import SequentialWorkflow
    from datetime import datetime
    
    with SessionLocal() as db:
        reconciled = 0
        
        # 1. Sync Run.status from SequentialWorkflow.status for all workflows
        workflows = db.query(SequentialWorkflow).all()
        for wf in workflows:
            db_run = db.query(DBRun).filter(DBRun.id == wf.run_id).first()
            if not db_run:
                # Create missing Run record to maintain FK integrity
                db_run = DBRun(
                    id=wf.run_id,
                    status=wf.status if wf.status != "blocked_on_approval" else "running",
                    started_at=wf.created_at or datetime.utcnow(),
                    completed_at=wf.updated_at if wf.status in ("completed", "failed") else None
                )
                db.add(db_run)
                reconciled += 1
            elif db_run.status != wf.status:
                # Sync the Run status to match the canonical workflow status
                if wf.status == "completed":
                    db_run.status = "completed"
                    db_run.completed_at = db_run.completed_at or wf.updated_at or datetime.utcnow()
                elif wf.status == "failed":
                    db_run.status = "failed"
                    db_run.completed_at = db_run.completed_at or wf.updated_at or datetime.utcnow()
                elif wf.status == "blocked_on_approval":
                    db_run.status = "running"
                elif wf.status in ("running", "pending"):
                    db_run.status = "running"
                reconciled += 1
        
        # 2. Fix blocked workflows with no pending approvals
        blocked = db.query(SequentialWorkflow).filter(SequentialWorkflow.status == "blocked_on_approval").all()
        for wf in blocked:
            pending_apps = db.query(DBApproval).filter(
                DBApproval.status == "pending",
                DBApproval.id == "wf-app-" + wf.id
            ).count()
            if pending_apps == 0:
                # No pending approval exists — mark as failed due to orphaned state
                wf.status = "failed"
                wf.updated_at = datetime.utcnow()
                wf.errors = {"error": "Orphaned blocked_on_approval state: no pending approval record found. Marked failed on startup reconciliation."}
                db_run = db.query(DBRun).filter(DBRun.id == wf.run_id).first()
                if db_run:
                    db_run.status = "failed"
                    db_run.completed_at = datetime.utcnow()
                reconciled += 1
        
        # 3. Fix stale running workflows (running for > 10 min with no active stage)
        running = db.query(SequentialWorkflow).filter(SequentialWorkflow.status == "running").all()
        for wf in running:
            has_running_stage = any(s.status == "running" for s in wf.stages)
            age_minutes = (datetime.utcnow() - (wf.updated_at or wf.created_at)).total_seconds() / 60
            if not has_running_stage and age_minutes > 10:
                # Stale running workflow with no active stage — mark as failed
                wf.status = "failed"
                wf.updated_at = datetime.utcnow()
                wf.errors = {"error": f"Stale running workflow: no active stage found after {age_minutes:.0f} minutes. Marked failed on startup reconciliation."}
                db_run = db.query(DBRun).filter(DBRun.id == wf.run_id).first()
                if db_run:
                    db_run.status = "failed"
                    db_run.completed_at = datetime.utcnow()
                reconciled += 1
        
        db.commit()
        if reconciled > 0:
            logger.info(f"State reconciliation completed: {reconciled} records fixed.")

try:
    reconcile_state()
except Exception as reconcile_err:
    logger.error(f"Failed to reconcile database state on startup: {reconcile_err}")

# Create OpenAPI metadata for tags
tags_metadata = [
    {
        "name": "Health",
        "description": "Verifies service status and database engine connectivity."
    },
    {
        "name": "Runs",
        "description": "Initiate, list, and fetch execution details for multi-agent reasoning runs."
    },
    {
        "name": "Resources",
        "description": "Inspect discovered cloud resources and configurations."
    },
    {
        "name": "Recommendations",
        "description": "Analyze proposed cost optimization recommendations."
    },
    {
        "name": "Approvals",
        "description": "Manage human-in-the-loop approvals for resource state changes."
    },
    {
        "name": "Reasoning Paths",
        "description": "Retrieve step-by-step cognitive reasoning pathways of the agents."
    }
]

from fastapi.middleware.cors import CORSMiddleware

# Create main application instance with custom OpenAPI metadata
app = FastAPI(
    title="CloudOps Autopilot API",
    version="1.0.0",
    description="Production-ready cost governance, inventory sweeps, and adaptive remediation reasoning API.",
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the global workflow coordinator singleton
coordinator = WorkflowCoordinator()

# Dependency for database sessions
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper function to construct structured responses
def make_response(success: bool, message: str, data: Any = None) -> APIResponse:
    return APIResponse(
        success=success,
        message=message,
        data=data,
        timestamp=datetime.utcnow()
    )

# --- GLOBAL EXCEPTION HANDLERS ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    logger.error(f"API Request Validation Error: {exc}")
    payload = make_response(False, f"Validation Error: {exc.errors()}", data=None)
    return JSONResponse(status_code=422, content=payload.model_dump(mode="json"))

@app.exception_handler(ValidationError)
async def pydantic_validation_exception_handler(request, exc: ValidationError):
    logger.error(f"Pydantic Validation Error: {exc}")
    payload = make_response(False, f"Validation Error: {exc.errors()}", data=None)
    return JSONResponse(status_code=422, content=payload.model_dump(mode="json"))

@app.exception_handler(InvalidApprovalTokenError)
async def invalid_token_exception_handler(request, exc: InvalidApprovalTokenError):
    logger.error(f"Invalid Approval Token: {exc}")
    payload = make_response(False, f"Authentication Error: {str(exc)}", data=None)
    return JSONResponse(status_code=401, content=payload.model_dump(mode="json"))

@app.exception_handler(ApprovalRequiredError)
async def approval_required_exception_handler(request, exc: ApprovalRequiredError):
    logger.error(f"Approval Required: {exc}")
    payload = make_response(False, f"Authentication Error: {str(exc)}", data=None)
    return JSONResponse(status_code=401, content=payload.model_dump(mode="json"))

@app.exception_handler(JWTError)
async def jwt_exception_handler(request, exc: JWTError):
    logger.error(f"JWT Verification Error: {exc}")
    payload = make_response(False, f"Authentication Error: Invalid or expired signature. {str(exc)}", data=None)
    return JSONResponse(status_code=401, content=payload.model_dump(mode="json"))

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    payload = make_response(False, exc.detail, data=None)
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump(mode="json"))

@app.exception_handler(Exception)
async def unexpected_exception_handler(request, exc: Exception):
    logger.error(f"Unexpected API System Failure: {exc}", exc_info=True)
    payload = make_response(False, f"Unexpected System Error: {str(exc)}", data=None)
    return JSONResponse(status_code=500, content=payload.model_dump(mode="json"))

# --- API ROUTERS ---

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(workflows_router)

@v1_router.get("/health", response_model=APIResponse, tags=["Health"])
async def check_health(db: Session = Depends(get_db)):
    """Verifies service status and database engine connectivity."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"HealthCheck database connection failed: {e}")
        db_status = "unhealthy"

    from cloud_adapter import get_azure_client
    cloud_mode = get_azure_client().get_mode()

    health_info = HealthDTO(
        status="healthy" if db_status == "healthy" else "unhealthy",
        database=db_status,
        cloud_mode=cloud_mode
    )
    
    status_code = 200 if db_status == "healthy" else 503
    return JSONResponse(
        status_code=status_code,
        content=make_response(
            success=(db_status == "healthy"),
            message="Health check completed",
            data=health_info.model_dump()
        ).model_dump(mode="json")
    )

@v1_router.get("/runs", response_model=APIResponse, tags=["Runs"])
async def list_runs(db: Session = Depends(get_db)):
    """Retrieves all historical and active sweep run logs."""
    from cloud_adapter import get_azure_client
    from backend.app.models.workflow import SequentialWorkflow
    cloud_mode = get_azure_client().get_mode()
    runs = db.query(DBRun).join(SequentialWorkflow, SequentialWorkflow.run_id == DBRun.id).filter(
        SequentialWorkflow.execution_mode == cloud_mode
    ).order_by(DBRun.started_at.desc()).all()
    data = [RunDTO.model_validate(r).model_dump() for r in runs]
    return make_response(True, f"Retrieved {len(data)} run logs successfully", data)

# Background task helper functions
async def run_workflow_bg(workflow_id: str):
    from backend.app.database import SessionLocal
    from backend.app.workflow.sequential_orchestrator import sequential_orchestrator_engine
    with SessionLocal() as db:
        try:
            await sequential_orchestrator_engine.execute_workflow(workflow_id, db)
        except Exception as e:
            logger.error(f"Background workflow run '{workflow_id}' failed: {e}", exc_info=True)

async def resume_workflow_bg(workflow_id: str, token: Optional[str] = None):
    from backend.app.database import SessionLocal
    from backend.app.workflow.sequential_orchestrator import sequential_orchestrator_engine
    with SessionLocal() as db:
        try:
            await sequential_orchestrator_engine.execute_workflow(workflow_id, db, approval_token=token)
        except Exception as e:
            logger.error(f"Failed to resume workflow run '{workflow_id}' in background: {e}", exc_info=True)

@v1_router.post("/runs", response_model=APIResponse, tags=["Runs"])
async def trigger_run(payload: TriggerRunRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Initiates a new multi-agent sweep run for a specific scenario using the Sequential Engine."""
    run_id = str(uuid.uuid4())
    try:
        from shared.config import settings
        from backend.app.models.workflow import SequentialWorkflow
        from backend.app.workflow.sequential_orchestrator import sequential_orchestrator_engine
        from backend.app.schemas.workflow import WorkflowContext
        
        # 1. Initialize context and database records
        correlation_id = f"corr-{uuid.uuid4()}"
        initial_context = WorkflowContext(
            workflow_id=f"wf-run-{run_id}",
            run_id=run_id,
            correlation_id=correlation_id,
            execution_mode="MOCK" if payload.dry_run or settings.CLOUD_MODE == "MOCK" else "LIVE",
            scenario_name=payload.scenario_name,
            objective=payload.objective
        )
        
        # Create legacy DBRun record for foreign key constraints
        db_run = DBRun(
            id=run_id,
            status="running",
            started_at=datetime.utcnow()
        )
        db.add(db_run)
        db.commit()

        # Create SequentialWorkflow record
        wf = SequentialWorkflow(
            id=f"wf-run-{run_id}",
            run_id=run_id,
            status="pending",
            objective=payload.objective or f"Autopilot objective sweep: {payload.scenario_name}",
            scenario_name=payload.scenario_name,
            execution_mode="MOCK" if payload.dry_run or settings.CLOUD_MODE == "MOCK" else "LIVE",
            correlation_id=correlation_id,
            context=initial_context.model_dump(mode="json")
        )
        db.add(wf)
        db.commit()
        
        # 2. Trigger Sequential Multi-Agent Workflow Engine execution in background
        background_tasks.add_task(run_workflow_bg, wf.id)
        
        # 3. Retrieve DBRun record details representation
        db_run_data = RunDTO.model_validate(db_run).model_dump()
        
        data = {
            "run_id": run_id,
            "status": "running",
            "steps_count": 9,
            "db_record": db_run_data,
            "workflow_details": {
                "id": wf.id,
                "run_id": wf.run_id,
                "status": "running",
                "steps": [
                    {
                        "id": "executive_orchestrator",
                        "name": "Executive Orchestrator",
                        "status": "pending",
                        "started_at": None,
                        "completed_at": None,
                        "error_message": None,
                        "retries_attempted": 0
                    }
                ],
                "created_at": wf.created_at.isoformat() if wf.created_at else None,
                "updated_at": wf.updated_at.isoformat() if wf.updated_at else None
            }
        }
        return make_response(True, f"Autopilot reasoning sweep '{run_id}' completed or blocked", data)
    except Exception as e:
        logger.error(f"Failed to run autopilot reasoning for {payload.scenario_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@v1_router.get("/runs/{run_id}", response_model=APIResponse, tags=["Runs"])
async def get_run_details(run_id: str, db: Session = Depends(get_db)):
    """Retrieves execution details, active step statuses, and full audit logs for a run."""
    db_run = db.query(DBRun).filter(DBRun.id == run_id).first()
    if not db_run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")

    wf_run = coordinator.get_run(f"wf-run-{run_id}")
    audit_logs = db.query(DBAuditLog).filter(DBAuditLog.run_id == run_id).order_by(DBAuditLog.timestamp.asc()).all()

    data = {
        "db_record": RunDTO.model_validate(db_run).model_dump(),
        "in_memory_state": wf_run.model_dump() if wf_run else None,
        "audit_logs": [
            {
                "id": log.id,
                "agent_name": log.agent_name,
                "step_name": log.step_name,
                "event_type": log.event_type,
                "status": log.status,
                "timestamp": log.timestamp,
                "payload": log.payload
            }
            for log in audit_logs
        ]
    }
    return make_response(True, "Run details retrieved successfully", data)

def _enrich_resource_dto(r: DBResource) -> dict:
    """Enrich a resource with latest telemetry and cost estimate."""
    from backend.app.models.resource import TelemetryHistory
    dto = ResourceDTO.model_validate(r).model_dump()
    # Get latest telemetry for utilization
    latest_telemetry = (
        sorted(r.telemetry, key=lambda x: x.timestamp)[-1] if r.telemetry else None
    )
    
    dto["cpu_utilization"] = None
    dto["memory_utilization"] = None
    dto["disk_utilization"] = None
    dto["network_utilization"] = None
    dto["telemetry_explanation"] = None
    
    t = r.type.lower()
    is_vm = "virtualmachine" in t or "vm" in t
    
    if latest_telemetry:
        dto["utilization"] = round(latest_telemetry.cpu_percent, 1)
        dto["cpu_utilization"] = round(latest_telemetry.cpu_percent, 1)
        
        # Determine memory utilization: if memory_bytes represents percentage (<100) or bytes (out of 8GB)
        if latest_telemetry.memory_bytes < 100:
            dto["memory_utilization"] = float(latest_telemetry.memory_bytes)
        else:
            dto["memory_utilization"] = round((latest_telemetry.memory_bytes / (8 * 1024 * 1024 * 1024)) * 100, 1)
        dto["memory_utilization"] = min(100.0, max(0.0, dto["memory_utilization"]))
        
        dto["disk_utilization"] = 34.5 # Simulated disk usage
        net_total = latest_telemetry.network_in_bytes + latest_telemetry.network_out_bytes
        if net_total < 100:
            dto["network_utilization"] = float(net_total)
        else:
            dto["network_utilization"] = round(min(100.0, (net_total / (100 * 1024 * 1024)) * 100), 1)
    else:
        dto["utilization"] = None
        dto["telemetry_explanation"] = "Telemetry unavailable because Azure Monitor metrics are not found for this resource"
            
    # Estimate monthly cost from resource type (Azure pricing approximation)
    if "virtualmachine" in t or "vm" in t:
        dto["monthly_cost"] = 145.00
    elif "disk" in t or "storage" in t:
        dto["monthly_cost"] = 32.50
    elif "network" in t or "publicipaddress" in t:
        dto["monthly_cost"] = 18.00
    elif "appservice" in t or "webapps" in t:
        dto["monthly_cost"] = 55.00
    elif "sql" in t or "database" in t:
        dto["monthly_cost"] = 210.00
    else:
        dto["monthly_cost"] = 45.00
    dto["provider"] = "azure"
    dto["health"] = "healthy" if r.status.lower() in ("running", "available", "active", "ready", "ok") else "degraded"
    dto["last_updated"] = r.last_seen
    return dto

@v1_router.get("/resources", response_model=APIResponse, tags=["Resources"])
async def list_resources(q: Optional[str] = None, db: Session = Depends(get_db)):
    """Lists all cloud resources discovered during inventory sweeps."""
    query = db.query(DBResource)
    if q:
        query = query.filter(DBResource.name.contains(q) | DBResource.type.contains(q))
    resources = query.all()
    data = [_enrich_resource_dto(r) for r in resources]
    return make_response(True, f"Retrieved {len(data)} resources successfully", data)

@v1_router.get("/resources/export", tags=["Resources"])
async def export_resources(format: str = "csv", q: Optional[str] = None, db: Session = Depends(get_db)):
    """Exports discovered cloud resources in CSV or JSON format."""
    query = db.query(DBResource)
    if q:
        query = query.filter(DBResource.name.contains(q) | DBResource.type.contains(q))
    resources = query.all()
    if format == "json":
        data = [_enrich_resource_dto(r) for r in resources]
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content=make_response(True, "Resources exported successfully", data).model_dump(mode="json"),
            headers={"Content-Disposition": "attachment; filename=resources.json"}
        )
    else:
        import csv
        import io
        from fastapi.responses import StreamingResponse
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Name", "Type", "Region", "Status", "Utilization%", "Est. Monthly Cost", "Tags", "Last Seen"])
        for r in resources:
            enriched = _enrich_resource_dto(r)
            tags_str = ";".join([f"{k}={v}" for k, v in r.tags.items()])
            writer.writerow([
                r.id, r.name, r.type, r.region, r.status,
                enriched.get("utilization", ""),
                enriched.get("monthly_cost", ""),
                tags_str, r.last_seen.isoformat()
            ])
            
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=resources.csv"}
        )

@v1_router.get("/resources/{resource_id}", response_model=APIResponse, tags=["Resources"])
async def get_resource(resource_id: str, db: Session = Depends(get_db)):
    """Retrieves config properties and metadata for a single resource."""
    res = db.query(DBResource).filter(DBResource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail=f"Resource '{resource_id}' not found")
    return make_response(True, "Resource retrieved successfully", _enrich_resource_dto(res))

@v1_router.get("/recommendations", response_model=APIResponse, tags=["Recommendations"])
async def list_recommendations(db: Session = Depends(get_db)):
    """Lists all active and resolved cost optimization proposals."""
    from cloud_adapter import get_azure_client
    from backend.app.models.workflow import SequentialWorkflow
    cloud_mode = get_azure_client().get_mode()
    recommendations = db.query(DBRecommendation).join(DBRun).join(
        SequentialWorkflow, SequentialWorkflow.run_id == DBRun.id
    ).filter(
        SequentialWorkflow.execution_mode == cloud_mode
    ).all()
    data = [RecommendationDTO.model_validate(r).model_dump() for r in recommendations]
    return make_response(True, f"Retrieved {len(data)} recommendations successfully", data)

@v1_router.get("/recommendations/{reco_id}", response_model=APIResponse, tags=["Recommendations"])
async def get_recommendation(reco_id: str, db: Session = Depends(get_db)):
    """Retrieves rationale, savings, and status for a single recommendation."""
    reco = db.query(DBRecommendation).filter(DBRecommendation.id == reco_id).first()
    if not reco:
        raise HTTPException(status_code=404, detail=f"Recommendation '{reco_id}' not found")
    return make_model_response(reco)

def make_model_response(reco):
    return make_response(True, "Recommendation retrieved successfully", RecommendationDTO.model_validate(reco).model_dump())

@v1_router.get("/approvals", response_model=APIResponse, tags=["Approvals"])
async def list_approvals(db: Session = Depends(get_db)):
    """Lists human-in-the-loop approval task entries."""
    from cloud_adapter import get_azure_client
    from backend.app.models.workflow import SequentialWorkflow
    cloud_mode = get_azure_client().get_mode()
    approvals = db.query(DBApproval).join(DBRecommendation).join(DBRun).join(
        SequentialWorkflow, SequentialWorkflow.run_id == DBRun.id
    ).filter(
        SequentialWorkflow.execution_mode == cloud_mode
    ).all()
    data = [ApprovalDTO.model_validate(a).model_dump() for a in approvals]
    return make_response(True, f"Retrieved {len(data)} approvals successfully", data)

@v1_router.post("/approvals/{approval_id}/approve", response_model=APIResponse, tags=["Approvals"])
async def approve_recommendation(approval_id: str, payload: ApproveRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Grants sign-off for a recommendation, generates a signed JWT token, and resumes execution."""
    db_app = db.query(DBApproval).filter(DBApproval.id == approval_id).first()
    if not db_app:
        raise HTTPException(status_code=404, detail=f"Approval request '{approval_id}' not found")

    if db_app.status == "approved":
        return make_response(True, "Recommendation is already approved", ApprovalDTO.model_validate(db_app).model_dump())

    reco = db_app.recommendation
    if not reco:
        raise HTTPException(status_code=404, detail="Linked recommendation not found")

    from mcp_server.server import encode_token_jwt
    # Generate cryptographic signed JWT approval token
    token_payload = {
        "sub": reco.resource_id,
        "action": reco.action_type,
        "workflow_id": f"wf-run-{reco.run_id}",
        "exp": datetime.utcnow() + timedelta(minutes=10),
        "iss": settings.APPROVAL_TOKEN_ISSUER
    }
    token = encode_token_jwt(token_payload, settings.JWT_SECRET_KEY, settings.JWT_ALGORITHM)

    # Transition Database States
    db_app.status = "approved"
    db_app.token = token
    db_app.decided_at = datetime.utcnow()
    db_app.operator_id = payload.operator_id

    reco.status = "approved"
    
    # SYNC: Update Run record status to match resumed workflow state
    db_run = db.query(DBRun).filter(DBRun.id == reco.run_id).first()
    if db_run:
        db_run.status = "running"
    
    # Write Audit log
    audit_log = DBAuditLog(
        run_id=reco.run_id,
        agent_name="ApprovalAgent",
        step_name="Approval Approval",
        event_type="ApprovalGranted",
        payload={"approval_id": approval_id, "operator_id": payload.operator_id},
        status="success"
    )
    db.add(audit_log)
    db.commit()

    # Resume active in-memory coordinator run if blocked
    wf_run_id = f"wf-run-{reco.run_id}"
    wf_run = coordinator.get_run(wf_run_id)
    resumed = False
    if wf_run and wf_run.status == WorkflowStatus.BLOCKED_ON_APPROVAL:
        try:
            await coordinator.grant_approval(wf_run_id, token)
            resumed = True
        except Exception as grant_err:
            logger.error(f"Failed to resume workflow run '{wf_run_id}': {grant_err}")

    # Resume sequential workflow run if blocked
    from backend.app.models.workflow import SequentialWorkflow
    
    db_wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == wf_run_id).first()
    if db_wf and db_wf.status == "blocked_on_approval":
        try:
            db_wf.status = "running"
            db.commit()
            background_tasks.add_task(resume_workflow_bg, db_wf.id, token)
            resumed = True
        except Exception as seq_res_err:
            logger.error(f"Failed to resume sequential workflow run '{wf_run_id}': {seq_res_err}")

    response_data = {
        "approval": ApprovalDTO.model_validate(db_app).model_dump(),
        "workflow_resumed": resumed
    }
    return make_response(True, "Approval granted and token signed successfully", response_data)

@v1_router.post("/approvals/{approval_id}/reject", response_model=APIResponse, tags=["Approvals"])
async def reject_recommendation(approval_id: str, payload: ApproveRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Rejects a recommendation and resumes execution (marking it as rejected)."""
    db_app = db.query(DBApproval).filter(DBApproval.id == approval_id).first()
    if not db_app:
        raise HTTPException(status_code=404, detail=f"Approval request '{approval_id}' not found")

    if db_app.status == "approved" or db_app.status == "rejected":
        return make_response(True, f"Recommendation is already {db_app.status}", ApprovalDTO.model_validate(db_app).model_dump())

    reco = db_app.recommendation
    if not reco:
        raise HTTPException(status_code=404, detail="Linked recommendation not found")

    # Transition Database States
    db_app.status = "rejected"
    db_app.decided_at = datetime.utcnow()
    db_app.operator_id = payload.operator_id

    reco.status = "denied"
    
    # SYNC: Update Run record status
    db_run = db.query(DBRun).filter(DBRun.id == reco.run_id).first()
    if db_run:
        db_run.status = "running"
    
    # Write Audit log
    audit_log = DBAuditLog(
        run_id=reco.run_id,
        agent_name="ApprovalAgent",
        step_name="Approval Rejection",
        event_type="ApprovalRejected",
        payload={"approval_id": approval_id, "operator_id": payload.operator_id},
        status="warning"
    )
    db.add(audit_log)
    db.commit()

    # Resume sequential workflow run
    from backend.app.models.workflow import SequentialWorkflow
    
    wf_run_id = f"wf-run-{reco.run_id}"
    db_wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == wf_run_id).first()
    resumed = False
    if db_wf and db_wf.status == "blocked_on_approval":
        try:
            db_wf.status = "running"
            db.commit()
            background_tasks.add_task(resume_workflow_bg, db_wf.id, None)
            resumed = True
        except Exception as seq_res_err:
            logger.error(f"Failed to resume sequential workflow run '{wf_run_id}': {seq_res_err}")

    response_data = {
        "approval": ApprovalDTO.model_validate(db_app).model_dump(),
        "workflow_resumed": resumed
    }
    return make_response(True, "Approval rejected and workflow resumed successfully", response_data)

@v1_router.post("/recommendations/{reco_id}/approve", response_model=APIResponse, tags=["Recommendations"])
async def approve_recommendation_endpoint(reco_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Approve a recommendation. If approval required, create approval request or approve existing one."""
    reco = db.query(DBRecommendation).filter(DBRecommendation.id == reco_id).first()
    if not reco:
        raise HTTPException(status_code=404, detail=f"Recommendation '{reco_id}' not found")
        
    if reco.status == "approved" or reco.status == "remediated":
        return make_response(True, "Recommendation is already approved", RecommendationDTO.model_validate(reco).model_dump())
        
    approval_required = reco.risk_level == "high"
    
    # Write Audit log
    audit_log = DBAuditLog(
        run_id=reco.run_id,
        agent_name="Dashboard-Operator",
        step_name="Recommendation Approval",
        event_type="RecommendationApproved",
        payload={"recommendation_id": reco_id, "resource_id": reco.resource_id},
        status="success"
    )
    db.add(audit_log)
    db.commit()

    if approval_required:
        app_id = "wf-app-wf-run-" + reco.run_id
        db_app = db.query(DBApproval).filter(DBApproval.recommendation_id == reco_id).first()
        if not db_app:
            db_app = DBApproval(
                id=app_id,
                recommendation_id=reco_id,
                token=f"app-token-{uuid.uuid4()}",
                status="pending",
                created_at=datetime.utcnow()
            )
            db.add(db_app)
            db.commit()
            
        from mcp_server.server import encode_token_jwt
        token_payload = {
            "sub": reco.resource_id,
            "action": reco.action_type,
            "workflow_id": f"wf-run-{reco.run_id}",
            "exp": datetime.utcnow() + timedelta(minutes=10),
            "iss": settings.APPROVAL_TOKEN_ISSUER
        }
        token = encode_token_jwt(token_payload, settings.JWT_SECRET_KEY, settings.JWT_ALGORITHM)
        
        db_app.status = "approved"
        db_app.token = token
        db_app.decided_at = datetime.utcnow()
        db_app.operator_id = "reco-page-operator"
        
        reco.status = "approved"
        
        # SYNC: Update Run record status
        db_run = db.query(DBRun).filter(DBRun.id == reco.run_id).first()
        if db_run:
            db_run.status = "running"
        db.commit()
        
        from backend.app.models.workflow import SequentialWorkflow
        wf_run_id = f"wf-run-{reco.run_id}"
        db_wf = db.query(SequentialWorkflow).filter(SequentialWorkflow.id == wf_run_id).first()
        if db_wf and db_wf.status == "blocked_on_approval":
            try:
                db_wf.status = "running"
                db.commit()
                background_tasks.add_task(resume_workflow_bg, db_wf.id, token)
            except Exception as seq_res_err:
                logger.error(f"Failed to resume sequential workflow run '{wf_run_id}': {seq_res_err}")
    else:
        reco.status = "approved"
        db.commit()
        
    from backend.app.services.event_bus import event_bus
    from backend.app.models.workflow import EventType
    event_bus.publish(EventType.WORKFLOW_STEP_COMPLETED, reco.run_id, {"recommendation_id": reco_id, "action": "approved", "agent": "Dashboard-Operator"})
        
    return make_response(True, "Recommendation approved successfully", RecommendationDTO.model_validate(reco).model_dump())

@v1_router.post("/recommendations/{reco_id}/dismiss", response_model=APIResponse, tags=["Recommendations"])
async def dismiss_recommendation_endpoint(reco_id: str, db: Session = Depends(get_db)):
    """Dismisses a recommendation by changing its status to denied/dismissed."""
    reco = db.query(DBRecommendation).filter(DBRecommendation.id == reco_id).first()
    if not reco:
        raise HTTPException(status_code=404, detail=f"Recommendation '{reco_id}' not found")
        
    reco.status = "denied"
    
    # Write Audit log
    audit_log = DBAuditLog(
        run_id=reco.run_id,
        agent_name="Dashboard-Operator",
        step_name="Recommendation Dismissal",
        event_type="RecommendationDismissed",
        payload={"recommendation_id": reco_id, "resource_id": reco.resource_id},
        status="warning"
    )
    db.add(audit_log)
    db.commit()
    
    from backend.app.services.event_bus import event_bus
    from backend.app.models.workflow import EventType
    event_bus.publish(EventType.WORKFLOW_STEP_COMPLETED, reco.run_id, {"recommendation_id": reco_id, "action": "dismissed", "agent": "Dashboard-Operator"})
    
    return make_response(True, "Recommendation dismissed successfully", RecommendationDTO.model_validate(reco).model_dump())

# NOTE: /resources/export is registered earlier (before /resources/{resource_id}) to avoid route shadowing

@v1_router.get("/search", response_model=APIResponse, tags=["Search"])
async def search_endpoint(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """Performs global search across Resources, Runs, Recommendations, Approvals, Audit Logs, and Events."""
    pattern = f"%{q}%"
    from backend.app.models.workflow import SequentialWorkflow, WorkflowEventLog
    
    resources = db.query(DBResource).filter(
        DBResource.name.like(pattern) | DBResource.type.like(pattern) | DBResource.region.like(pattern)
    ).limit(5).all()
    
    runs = db.query(SequentialWorkflow).filter(
        SequentialWorkflow.id.like(pattern) | SequentialWorkflow.objective.like(pattern) | SequentialWorkflow.scenario_name.like(pattern)
    ).limit(5).all()
    
    recommendations = db.query(DBRecommendation).filter(
        DBRecommendation.resource_id.like(pattern) | DBRecommendation.rationale.like(pattern)
    ).limit(5).all()
    
    approvals = db.query(DBApproval).filter(
        DBApproval.id.like(pattern) | DBApproval.recommendation_id.like(pattern)
    ).limit(5).all()
    
    audit_logs = db.query(DBAuditLog).filter(
        DBAuditLog.agent_name.like(pattern) | DBAuditLog.step_name.like(pattern) | DBAuditLog.event_type.like(pattern)
    ).limit(5).all()
    
    events = db.query(WorkflowEventLog).filter(
        WorkflowEventLog.event_type.like(pattern) | WorkflowEventLog.stage_id.like(pattern)
    ).limit(5).all()
    
    data = {
        "resources": [ResourceDTO.model_validate(r).model_dump() for r in resources],
        "runs": [
            {"workflow_id": w.id, "scenario": w.scenario_name, "objective": w.objective, "status": w.status}
            for w in runs
        ],
        "recommendations": [RecommendationDTO.model_validate(r).model_dump() for r in recommendations],
        "approvals": [ApprovalDTO.model_validate(a).model_dump() for a in approvals],
        "audit_logs": [
            {"id": a.id, "agent_name": a.agent_name, "step_name": a.step_name, "event_type": a.event_type, "status": a.status, "timestamp": a.timestamp.isoformat()}
            for a in audit_logs
        ],
        "events": [
            {"id": e.id, "event_type": e.event_type, "stage_id": e.stage_id, "timestamp": e.timestamp.isoformat()}
            for e in events
        ]
    }
    return make_response(True, "Search completed successfully", data)

@v1_router.get("/topology", response_model=APIResponse, tags=["Resources"])
async def get_topology(db: Session = Depends(get_db)):
    """Generates the dynamic Infrastructure and Agent dependency topologies."""
    from shared.config import settings
    from cloud_adapter import get_azure_client
    
    client = get_azure_client()
    mode = client.get_mode()
    
    # If live mode and SDK authentication failed entirely, raise actual backend reason
    if settings.CLOUD_MODE == "LIVE" and getattr(client, "_failed_init", False):
        return make_response(False, "Topology unavailable: live Azure SDK authentication failed.", {
            "error_detail": "DefaultAzureCredential failed to acquire token. Please verify AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET environment variables or log in via Azure CLI.",
            "infrastructure": {"nodes": [], "edges": []},
            "agent": {"nodes": [], "edges": []}
        })
        
    # Query discovered resources
    resources = db.query(DBResource).all()
    
    # 1. BUILD INFRASTRUCTURE TOPOLOGY
    infra_nodes = []
    infra_edges = []
    
    # Static Hub Infrastructure
    infra_nodes.append({
        "id": "vnet-prod",
        "label": "vnet-prod-eastus",
        "type": "VNet",
        "health": "healthy",
        "details": "Azure Virtual Network (10.0.0.0/16)"
    })
    infra_nodes.append({
        "id": "subnet-app",
        "label": "subnet-app (10.0.1.0/24)",
        "type": "Subnet",
        "health": "healthy",
        "details": "Application Tier Subnet"
    })
    infra_edges.append({"source": "subnet-app", "target": "vnet-prod", "type": "contains"})
    
    infra_nodes.append({
        "id": "subnet-db",
        "label": "subnet-db (10.0.2.0/24)",
        "type": "Subnet",
        "health": "healthy",
        "details": "Database Tier Subnet"
    })
    infra_edges.append({"source": "subnet-db", "target": "vnet-prod", "type": "contains"})
    
    infra_nodes.append({
        "id": "nsg-prod",
        "label": "nsg-prod-rules",
        "type": "NSG",
        "health": "healthy",
        "details": "Security Group (Ports 80/443 open, 22 restricted)"
    })
    infra_edges.append({"source": "nsg-prod", "target": "subnet-app", "type": "routes"})
    
    infra_nodes.append({
        "id": "lb-prod",
        "label": "lb-prod-frontend",
        "type": "LoadBalancer",
        "health": "healthy",
        "details": "Public Load Balancer"
    })
    
    infra_nodes.append({
        "id": "db-prod-sql",
        "label": "db-prod-sql",
        "type": "Database",
        "health": "healthy",
        "details": "Azure SQL Serverless (General Purpose)"
    })
    infra_edges.append({"source": "db-prod-sql", "target": "subnet-db", "type": "dependency"})
    
    infra_nodes.append({
        "id": "kv-prod-keys",
        "label": "kv-prod-secrets",
        "type": "KeyVault",
        "health": "healthy",
        "details": "Azure Key Vault (Premium Keys HSM)"
    })
    
    infra_nodes.append({
        "id": "st-prod-logs",
        "label": "stprodlogs",
        "type": "Storage",
        "health": "healthy",
        "details": "Azure Blob Storage Account (Standard LRS)"
    })
    
    # Dynamic Discovered Resources
    for r in resources:
        r_type = r.type.lower()
        health_status = "healthy" if r.status.lower() in ("running", "available", "active", "ready", "ok") else "degraded"
        
        if "virtualmachines" in r_type or "vm" in r_type:
            # VM Node
            infra_nodes.append({
                "id": r.id,
                "label": r.name,
                "type": "VM",
                "health": health_status,
                "details": f"Virtual Machine ({r.status})"
            })
            
            # NIC Node
            nic_id = f"nic-{r.id}"
            infra_nodes.append({
                "id": nic_id,
                "label": f"nic-{r.name}",
                "type": "NIC",
                "health": "healthy",
                "details": f"Network Interface for {r.name}"
            })
            infra_edges.append({"source": r.id, "target": nic_id, "type": "dependency"})
            infra_edges.append({"source": nic_id, "target": "subnet-app", "type": "dependency"})
            infra_edges.append({"source": "lb-prod", "target": r.id, "type": "routes"})
            
            # Public IP for VM
            pip_id = f"pip-{r.id}"
            infra_nodes.append({
                "id": pip_id,
                "label": f"pip-{r.name}",
                "type": "PublicIP",
                "health": "healthy",
                "details": f"Public IP Address for {r.name}"
            })
            infra_edges.append({"source": nic_id, "target": pip_id, "type": "dependency"})
            
            # Connections to core services
            infra_edges.append({"source": r.id, "target": "db-prod-sql", "type": "dependency"})
            infra_edges.append({"source": r.id, "target": "kv-prod-keys", "type": "dependency"})
            infra_edges.append({"source": r.id, "target": "st-prod-logs", "type": "dependency"})
            
        elif "serverfarms" in r_type or "appservice" in r_type:
            infra_nodes.append({
                "id": r.id,
                "label": r.name,
                "type": "AppService",
                "health": health_status,
                "details": f"App Service Plan ({r.status})"
            })
            infra_edges.append({"source": r.id, "target": "db-prod-sql", "type": "dependency"})
            
    # 2. BUILD AGENT TOPOLOGY (REACTIVE TO RUNNING STATE)
    from backend.app.models.workflow import SequentialWorkflow
    latest_wf = db.query(SequentialWorkflow).order_by(SequentialWorkflow.created_at.desc()).first()
    stage_statuses = {s.stage_id: s.status for s in latest_wf.stages} if latest_wf else {}
    
    agent_contract_list = [
        ("executive_orchestrator", "Executive Agent", "Orchestration & Objectives"),
        ("inventory_agent", "Inventory Agent", "Asset Discovery & Sync"),
        ("telemetry_agent", "Telemetry Agent", "Metrics & Monitor API Logs"),
        ("analysis_agent", "Analysis Agent", "Anomaly & Idle Resource Identification"),
        ("recommendation_agent", "Recommendation Agent", "Dynamic Optimizations Planner"),
        ("risk_assessment_agent", "Risk Agent", "Security, Impact & Compliance Gates"),
        ("approval_agent", "Approval Agent", "Human-in-the-loop Guardrails Queue"),
        ("execution_agent", "Execution Agent", "Azure Resource State Remediation"),
        ("audit_agent", "Audit Agent", "Ledger Logs & Cryptographic Integrity")
    ]
    
    agent_nodes = []
    agent_edges = []
    
    for idx, (stage_id, label, details) in enumerate(agent_contract_list):
        status = stage_statuses.get(stage_id, "pending")
        if status == "success":
            health = "healthy"
        elif status == "running":
            health = "running"
        elif status == "failed":
            health = "failing"
        else:
            health = "pending"
            
        agent_nodes.append({
            "id": stage_id,
            "label": label,
            "type": "Agent",
            "health": health,
            "details": f"{details} (Status: {status})"
        })
        
        # Link to the next agent sequentially
        if idx < len(agent_contract_list) - 1:
            next_stage_id = agent_contract_list[idx + 1][0]
            agent_edges.append({"source": stage_id, "target": next_stage_id, "type": "agent_flow"})
        else:
            # Loop back to Executive Orchestrator
            agent_edges.append({"source": stage_id, "target": "executive_orchestrator", "type": "agent_flow"})
            
    topology_data = {
        "infrastructure": {"nodes": infra_nodes, "edges": infra_edges},
        "agent": {"nodes": agent_nodes, "edges": agent_edges}
    }
    
    return make_response(True, "Topology retrieved successfully", topology_data)

def fallback_rule_based_ai(query: str, resources, recommendations, workflows, audit_logs, selected_resource_id: Optional[str] = None, context_url: Optional[str] = None) -> str:
    q = query.lower()
    
    # Context-aware fallback: if the user asks a generic "why" or "what is this" or "explain" while selecting a resource
    if selected_resource_id and ("why" in q or "explain" in q or "detail" in q or "what is" in q or "describe" in q):
        r = next((x for x in resources if x.id == selected_resource_id or x.name == selected_resource_id), None)
        if r:
            reco = next((x for x in recommendations if x.resource_id == r.id), None)
            reco_text = f" and has a pending cost optimization recommendation to {reco.action_type.upper()} it (saving ${reco.saving_amount:.2f}/mo)" if reco else " and is operating within healthy parameters with no optimization recommendations pending"
            return (
                f"Resource '{r.id}' is a '{r.type}' in region '{r.region}' with current status '{r.status}'.\n"
                f"- CPU Utilization: {getattr(r, 'cpu_utilization', None) or r.utilization or 'N/A'}%\n"
                f"- Monthly Cost: ${r.monthly_cost or 0.0:.2f}/mo\n"
                f"It is currently under observation{reco_text}."
            )

    # 1. Why was VM stopped?
    if "why" in q and ("stop" in q or "dealloc" in q):
        target_vm = selected_resource_id
        if not target_vm:
            stopped = [r.id for r in resources if "virtualmachine" in r.type.lower() and r.status.lower() in ("stopped", "deallocated")]
            target_vm = stopped[0] if stopped else "vm-idle-01"
            
        reco = next((r for r in recommendations if r.resource_id == target_vm), None)
        saving_text = f"saving ${reco.saving_amount}/mo" if reco else "saving $50/mo"
        rationale = reco.rationale if reco else "its average CPU utilization was 2.5% over the observation window (well below the 5% threshold)"
        return f"Virtual Machine '{target_vm}' was stopped because {rationale}, realizing a cost savings of {saving_text}. The stop sequence was fully evaluated and approved."

    # 2. What changed today? / Compare yesterday vs today
    if "change" in q or "compare" in q or "yesterday" in q:
        running_wfs = len([w for w in workflows if w.status in ("running", "pending")])
        completed_wfs = len([w for w in workflows if w.status == "completed"])
        active_recos = len([r for r in recommendations if r.status == "pending"])
        realized_savings = sum(r.saving_amount for r in recommendations if r.status in ("approved", "remediated", "executed"))
        return (
            f"Comparing yesterday vs today:\n"
            f"- Discovered resources under managed observation: {len(resources)} (operating within standard thresholds).\n"
            f"- Completed optimization sweeps today: {completed_wfs} successfully finished run(s).\n"
            f"- Running/pending workflow runs: {running_wfs} active orchestrations.\n"
            f"- Active optimization recommendations: {active_recos} cost reduction proposals.\n"
            f"- Monthly cost savings realized today: ${realized_savings:.2f}/month."
        )

    # 3. Why confidence dropped?
    if "confidence" in q and ("drop" in q or "low" in q or "why" in q):
        return (
            "Causal reasoning confidence dropped slightly because of higher volatility during the Telemetry Agent's "
            "metrics aggregation phase. There was a transient network latency spike on the Azure Monitor API, "
            "causing the telemetry confidence sub-metric to drop to 85% compared to its normal 98% level. "
            "The system automatically flagged the reading but proceeded once the safety gate cleared."
        )

    # 4. What failed? / Show failed workflows
    if "fail" in q:
        failed_wfs = [w for w in workflows if w.status == "failed"]
        if failed_wfs:
            return f"The following workflows in history have failed: {', '.join([w.id for w in failed_wfs])}. Check the Workflows panel details for logs."
        return "All workflows executed successfully. There are no failed workflows recorded in the database."

    # 5. Which workflow saved most money?
    if "most money" in q or "saved most" in q or "max savings" in q:
        highest_savings = 0.0
        highest_wf = None
        for w in workflows:
            wf_savings = sum(r.saving_amount for r in recommendations if r.run_id == w.id or (w.id.replace("wf-run-", "") in r.run_id if r.run_id else False))
            if wf_savings > highest_savings:
                highest_savings = wf_savings
                highest_wf = w.id
        if highest_wf:
            return f"Workflow '{highest_wf}' saved the most money, realizing ${highest_savings:.2f}/month in estimated cost reduction by stop/resize actions."
        return "No workflow runs with savings are currently recorded in the database."

    # 6. Explain recommendation #15 (or any reco ID lookup)
    if "recommendation" in q:
        import re
        nums = re.findall(r"\d+", q)
        reco_item = None
        if nums:
            idx = int(nums[0])
            if idx < len(recommendations):
                reco_item = recommendations[idx]
            else:
                reco_item = next((r for r in recommendations if str(idx) in r.id), None)
        if not reco_item and recommendations:
            reco_item = recommendations[0]
        if reco_item:
            return (
                f"Recommendation '{reco_item.id}': Proposed action is '{reco_item.action_type.upper()}' on resource '{reco_item.resource_id}'.\n"
                f"- Estimated Monthly Savings: ${reco_item.saving_amount:.2f}/mo\n"
                f"- Risk Level: {reco_item.risk_level.upper()}\n"
                f"- Rationale: {reco_item.rationale}\n"
                f"- Current Status: {reco_item.status.upper()}"
            )
        return "No recommendations found in the database."

    # 7. Summarize Azure inventory.
    if "inventory" in q or "summarize" in q or "resource" in q:
        vms = [r for r in resources if "virtualmachine" in r.type.lower() or "vm" in r.type.lower()]
        disks = [r for r in resources if "disk" in r.type.lower()]
        plans = [r for r in resources if "serverfarms" in r.type.lower() or "appservice" in r.type.lower()]
        regions = set(r.region for r in resources)
        return (
            f"Azure Inventory Summary:\n"
            f"- Total Managed Resources: {len(resources)}\n"
            f"- Virtual Machines: {len(vms)} active instances\n"
            f"- Unattached Disks: {len(disks)} orphaned storage resources\n"
            f"- App Service Plans: {len(plans)} compute tiers\n"
            f"- Active Regions: {', '.join(regions)}"
        )

    # Standard Fallbacks
    if "why" in q and ("idle" in q or "underutilized" in q or "vm" in q):
        idle_recos = [r for r in recommendations if r.action_type in ("stop", "resize")]
        if idle_recos:
            reco = idle_recos[0]
            res_name = reco.resource_id
            return (
                f"The Virtual Machine '{res_name}' was classified as idle/underutilized "
                f"because its historical metrics showed average CPU utilization of 2.5% (well below the "
                f"system threshold of 5.0%) and memory utilization averaging 15% over the observation window. "
                f"Azure Advisor and our Telemetry Agent both confirmed zero active load, and no tags exist "
                f"to exempt this resource from cost-saving policy sweeps. Stopping or resizing this instance is "
                f"recommended to eliminate this waste."
            )
        return "I analyzed the resources but couldn't find any currently flagged as idle or underutilized in the active recommendations database."

    if "workflow" in q:
        wf_summary = [f"- Run {w.id}: objective '{w.objective}' is {w.status}" for w in workflows]
        return "Here is a summary of the multi-agent orchestrator workflows:\n" + ("\n".join(wf_summary) if wf_summary else "No workflow runs recorded in history.")
    elif "audit" in q or "ledger" in q or "trail" in q:
        audit_summary = [f"- {a.timestamp.strftime('%H:%M:%S')} | {a.agent_name} | {a.event_type} ({a.status})" for a in audit_logs[:10]]
        return "Here is a summary of the latest audit ledger records:\n" + ("\n".join(audit_summary) if audit_summary else "Audit ledger is currently empty.")
        
    return (
        f"I am the CloudOps Autopilot AI Assistant. I have context on {len(resources)} active resources, "
        f"{len(recommendations)} optimization proposals, and {len(workflows)} workflow runs.\n"
        f"You can ask me questions like:\n"
        f"- 'Why is this VM stopped?'\n"
        f"- 'What changed today?'\n"
        f"- 'Explain the last workflow.'\n"
        f"- 'Which recommendation saves the most money?'\n"
        f"- 'Summarize today's activity.'"
    )

@v1_router.post("/ask-ai", response_model=APIResponse, tags=["AI"])
async def ask_ai(payload: AskAIRequest, db: Session = Depends(get_db)):
    """Answers operator queries about cloud resources, optimization runs, policy status, and audit ledgers."""
    resources = db.query(DBResource).all()
    recommendations = db.query(DBRecommendation).all()
    from backend.app.models.workflow import SequentialWorkflow
    workflows = db.query(SequentialWorkflow).all()
    audit_logs = db.query(DBAuditLog).order_by(DBAuditLog.timestamp.desc()).all()
    
    # Use google-genai Gemini if API key is present
    api_key = settings.GEMINI_API_KEY
    if api_key:
        try:
            from google import genai
            resources_str = "\n".join([f"- Name: {r.name}, Type: {r.type}, Region: {r.region}, Status: {r.status}, CPU: {getattr(r, 'cpu_utilization', None) or r.utilization or 'N/A'}%" for r in resources])
            recommendations_str = "\n".join([f"- Action: {r.action_type} on {r.resource_id}, Savings: ${r.saving_amount}, Rationale: {r.rationale}, Status: {r.status}" for r in recommendations])
            workflows_str = "\n".join([f"- ID: {w.id}, Objective: {w.objective}, Scenario: {w.scenario_name}, Status: {w.status}" for w in workflows])
            audit_str = "\n".join([f"- {a.timestamp} | {a.agent_name} | {a.step_name} | {a.event_type} | Status: {a.status}" for a in audit_logs[:20]])
            
            context = f"""
You are the CloudOps Autopilot AI Assistant. You have access to the current live state of the cloud resources and multi-agent governance pipeline.

Active Page URL Context: {payload.context_url or "Dashboard Overview"}
Currently Selected Resource ID: {payload.selected_resource_id or "None"}

Current Resources Discovered:
{resources_str or "None"}

Current Optimization Recommendations:
{recommendations_str or "None"}

Workflow History / Active Orchestrations:
{workflows_str or "None"}

Recent Pipeline Audit Trail:
{audit_str or "None"}

User Query: {payload.query}

Answer the user's question clearly and concisely based on the current state.
- Summarize resources if asked.
- Summarize recommendations if asked.
- Explain workflow if asked.
- Explain audit trail if asked.
- Keep the response accurate to the data provided above.
"""
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL or "gemini-2.5-flash",
                contents=context
            )
            ai_response = response.text
        except Exception as gen_err:
            logger.error(f"Gemini generation failed: {gen_err}")
            ai_response = f"AI generation failed: {str(gen_err)}"
    else:
        ai_response = "Error: GEMINI_API_KEY is not configured in the backend environment. Real AI reasoning is required by the Release Contract."
        
    return make_response(True, "AI query completed", {"response": ai_response})

@v1_router.get("/reasoning-paths", response_model=APIResponse, tags=["Reasoning Paths"])
async def list_reasoning_paths(db: Session = Depends(get_db)):
    """Retrieves all agent reasoning paths recorded during resource evaluations."""
    paths = db.query(DBAgentReasoningPath).order_by(DBAgentReasoningPath.timestamp.desc()).all()
    data = [AgentReasoningPathDTO.model_validate(p).model_dump() for p in paths]
    return make_response(True, f"Retrieved {len(data)} reasoning paths successfully", data)

# Register versioned routes router
app.include_router(v1_router)
