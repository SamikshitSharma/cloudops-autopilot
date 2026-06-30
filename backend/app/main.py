import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Depends, HTTPException, APIRouter, Query
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
    AgentReasoningPathDTO
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

    health_info = HealthDTO(
        status="healthy" if db_status == "healthy" else "unhealthy",
        database=db_status
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
    runs = db.query(DBRun).order_by(DBRun.started_at.desc()).all()
    data = [RunDTO.model_validate(r).model_dump() for r in runs]
    return make_response(True, f"Retrieved {len(data)} run logs successfully", data)

@v1_router.post("/runs", response_model=APIResponse, tags=["Runs"])
async def trigger_run(payload: TriggerRunRequest, db: Session = Depends(get_db)):
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
        
        # 2. Trigger Sequential Multi-Agent Workflow Engine execution
        wf = await sequential_orchestrator_engine.execute_workflow(wf.id, db)
        
        # 3. Retrieve DBRun record (which may have been updated during execution)
        db_run = db.query(DBRun).filter(DBRun.id == run_id).first()
        db_run_data = RunDTO.model_validate(db_run).model_dump() if db_run else None
        
        # Map sequential workflow status to legacy status
        legacy_status = "running"
        if wf.status == "completed":
            legacy_status = "completed"
        elif wf.status == "failed":
            legacy_status = "failed"
        elif wf.status == "blocked_on_approval":
            legacy_status = "blocked_on_approval"

        # Construct legacy-compatible workflow run details representation
        data = {
            "run_id": run_id,
            "status": legacy_status,
            "steps_count": len(wf.stages),
            "db_record": db_run_data,
            "workflow_details": {
                "id": wf.id,
                "run_id": wf.run_id,
                "status": legacy_status,
                "steps": [
                    {
                        "id": s.stage_id,
                        "name": s.stage_name,
                        "status": s.status,
                        "started_at": s.started_at.isoformat() if s.started_at else None,
                        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                        "error_message": s.errors.get("error") if s.errors else None,
                        "retries_attempted": 0
                    } for s in wf.stages
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

@v1_router.get("/resources", response_model=APIResponse, tags=["Resources"])
async def list_resources(db: Session = Depends(get_db)):
    """Lists all cloud resources discovered during inventory sweeps."""
    resources = db.query(DBResource).all()
    data = [ResourceDTO.model_validate(r).model_dump() for r in resources]
    return make_response(True, f"Retrieved {len(data)} resources successfully", data)

@v1_router.get("/resources/{resource_id}", response_model=APIResponse, tags=["Resources"])
async def get_resource(resource_id: str, db: Session = Depends(get_db)):
    """Retrieves config properties and metadata for a single resource."""
    res = db.query(DBResource).filter(DBResource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail=f"Resource '{resource_id}' not found")
    return make_response(True, "Resource retrieved successfully", ResourceDTO.model_validate(res).model_dump())

@v1_router.get("/recommendations", response_model=APIResponse, tags=["Recommendations"])
async def list_recommendations(db: Session = Depends(get_db)):
    """Lists all active and resolved cost optimization proposals."""
    recommendations = db.query(DBRecommendation).all()
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
    approvals = db.query(DBApproval).all()
    data = [ApprovalDTO.model_validate(a).model_dump() for a in approvals]
    return make_response(True, f"Retrieved {len(data)} approvals successfully", data)

@v1_router.post("/approvals/{approval_id}/approve", response_model=APIResponse, tags=["Approvals"])
async def approve_recommendation(approval_id: str, payload: ApproveRequest, db: Session = Depends(get_db)):
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

    response_data = {
        "approval": ApprovalDTO.model_validate(db_app).model_dump(),
        "workflow_resumed": resumed
    }
    return make_response(True, "Approval granted and token signed successfully", response_data)

@v1_router.get("/reasoning-paths", response_model=APIResponse, tags=["Reasoning Paths"])
async def list_reasoning_paths(db: Session = Depends(get_db)):
    """Retrieves all agent reasoning paths recorded during resource evaluations."""
    paths = db.query(DBAgentReasoningPath).order_by(DBAgentReasoningPath.timestamp.desc()).all()
    data = [AgentReasoningPathDTO.model_validate(p).model_dump() for p in paths]
    return make_response(True, f"Retrieved {len(data)} reasoning paths successfully", data)

# Register versioned routes router
app.include_router(v1_router)
