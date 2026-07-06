from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime

# Global structured API response wrapper
class APIResponse(BaseModel):
    success: bool = Field(..., description="Flag indicating if the API operation was successful")
    message: str = Field(..., description="Human-readable response message")
    data: Optional[Any] = Field(None, description="Response payload")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of the API execution")

# Request Models
class TriggerRunRequest(BaseModel):
    scenario_name: str = Field(..., description="Name of the scenario to execute, e.g., 'idle_vm', 'unused_disk'")
    dry_run: bool = Field(False, description="Flag indicating if execution steps should be dry run only")
    objective: Optional[str] = Field(None, description="Optional high-level objective, e.g., 'Optimize Azure Subscription'")

class ApproveRequest(BaseModel):
    operator_id: str = Field("API-Operator", description="Unique identifier of the authorizing operator")

# Response DTO Models
class RunDTO(BaseModel):
    id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    log_file_path: Optional[str] = None

    class Config:
        from_attributes = True

class ResourceDTO(BaseModel):
    id: str
    provider_id: str
    name: str
    type: str
    region: str
    status: str
    tags: Dict[str, str]
    last_seen: datetime
    provider: str = "azure"
    utilization: Optional[float] = None
    monthly_cost: Optional[float] = None
    cpu_utilization: Optional[float] = None
    memory_utilization: Optional[float] = None
    disk_utilization: Optional[float] = None
    network_utilization: Optional[float] = None
    health: str = "healthy"
    last_updated: Optional[datetime] = None
    telemetry_explanation: Optional[str] = None
    metric_source: Optional[str] = None
    cost_explanation: Optional[str] = None

    class Config:
        from_attributes = True

class RecommendationDTO(BaseModel):
    id: str
    run_id: str
    resource_id: str
    action_type: str
    saving_amount: float
    rationale: str
    risk_level: str
    status: str
    confidence_score: Optional[float] = None
    evidence: Optional[str] = None
    reasoning_chain: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class ApprovalDTO(BaseModel):
    id: str
    recommendation_id: str
    token: Optional[str] = None
    status: str
    created_at: datetime
    decided_at: Optional[datetime] = None
    operator_id: Optional[str] = None

    class Config:
        from_attributes = True

class HealthDTO(BaseModel):
    status: str = Field(..., description="Status of the application service")
    database: str = Field(..., description="Database connectivity verification status")
    cloud_mode: str = Field(..., description="Configured cloud mode: LIVE or MOCK")
    cloud_status: str = Field(..., description="Cloud adapter status")
    cloud_error: Optional[str] = Field(None, description="Most recent cloud adapter error")

class AgentReasoningPathDTO(BaseModel):
    id: str
    timestamp: datetime
    resource_id: Optional[str] = None
    agent_name: str
    trigger_event: str
    observations: Dict[str, Any]
    hypotheses: List[Dict[str, Any]]
    policy_check_status: str
    recommended_action: str

    class Config:
        from_attributes = True

class AskAIRequest(BaseModel):
    query: str = Field(..., description="Query/message to ask the AI assistant")
    context_url: Optional[str] = Field(None, description="Optional page URL context")
    selected_resource_id: Optional[str] = Field(None, description="Optional active resource selection context")

