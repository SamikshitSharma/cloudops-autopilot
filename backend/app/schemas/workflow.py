from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime

class WorkflowContext(BaseModel):
    """Immutable/enriched shared context travelling between sequential stages."""
    workflow_id: str
    run_id: str
    correlation_id: str
    execution_mode: str = "MOCK"  # MOCK or LIVE
    azure_subscription: str = "Azure for Students"
    azure_tenant: str = "default-tenant-id"
    objective: Optional[str] = None
    scenario_name: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    timestamps: Dict[str, str] = Field(default_factory=dict)  # stage_id -> start/end timestamps
    
    # Data payloads
    discovered_resources: List[Dict[str, Any]] = Field(default_factory=list)
    inventory: Dict[str, Any] = Field(default_factory=dict)
    telemetry: Dict[str, Any] = Field(default_factory=dict)
    advisor_data: List[Dict[str, Any]] = Field(default_factory=list)
    ai_observations: List[Dict[str, Any]] = Field(default_factory=list)
    reasoning_chain: List[Dict[str, Any]] = Field(default_factory=list)
    evidence: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 1.0
    
    recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    cost_estimates: Dict[str, Any] = Field(default_factory=dict)
    risk_analysis: Dict[str, Any] = Field(default_factory=dict)
    policies: List[Dict[str, Any]] = Field(default_factory=list)
    approval_state: Dict[str, Any] = Field(default_factory=dict)
    execution_state: Dict[str, Any] = Field(default_factory=dict)
    audit_information: Dict[str, Any] = Field(default_factory=dict)
    
    # Logs & telemetry metrics
    logs: List[Dict[str, Any]] = Field(default_factory=list)
    stage_outputs: Dict[str, Any] = Field(default_factory=dict)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # timing & efficiency metrics
    workflow_metrics: Dict[str, Any] = Field(default_factory=dict)
    stage_timings: Dict[str, float] = Field(default_factory=dict)  # stage_id -> seconds duration
    execution_statistics: Dict[str, Any] = Field(default_factory=dict)
    
    # Versioning
    version_info: Dict[str, str] = Field(default_factory=lambda: {
        "Workflow Version": "1.0.0",
        "Pipeline Version": "1.0.0",
        "Agent Version": "1.0.0",
        "Schema Version": "1.0.0",
        "Project Version": "1.0.0"
    })

# --- FRONTEND DTOs ---

class WorkflowCard(BaseModel):
    """High-level summary of a sequential workflow run."""
    workflow_id: str
    run_id: str
    correlation_id: str
    status: str
    objective: Optional[str]
    scenario_name: Optional[str]
    execution_mode: str
    created_at: datetime
    updated_at: datetime
    progress_percentage: float
    duration_seconds: Optional[float]
    confidence: float
    estimated_savings: float

class PipelineNode(BaseModel):
    id: str
    label: str
    status: str  # pending, running, success, failed, skipped
    progress: float
    duration: Optional[float] = None
    role: Optional[str] = None

class PipelineEdge(BaseModel):
    from_node: str = Field(..., alias="from")
    to_node: str = Field(..., alias="to")

    class Config:
        populate_by_name = True

class PipelineGraph(BaseModel):
    """The pipeline graph structure representing stages and execution dependencies."""
    nodes: List[PipelineNode]
    edges: List[PipelineEdge]
    stage_order: List[str]
    active_stage: Optional[str] = None
    completed_stages: List[str]
    failed_stages: List[str]
    workflow_progress_percentage: float

class TimelineCard(BaseModel):
    """Execution timeline event representation."""
    stage_id: str
    stage_name: str
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_seconds: Optional[float]

class AgentExecutionCard(BaseModel):
    """Details for a single stage's execution card."""
    stage_id: str
    stage_name: str
    status: str
    duration: Optional[float]
    input_summary: Optional[Dict[str, Any]]
    output_summary: Optional[Dict[str, Any]]
    reasoning_summary: Optional[Dict[str, Any]]
    confidence: float
    errors: Optional[Dict[str, Any]]
    llm_trace: Optional[Dict[str, Any]]

class ReasoningCard(BaseModel):
    """Represents a human-readable reasoning path element."""
    stage_id: str
    agent_name: str
    finding: str
    action_proposed: str
    evidence: str
    confidence: float
    risk_level: str

class MetricsCard(BaseModel):
    """Deep analysis of workflow efficiency."""
    workflow_duration: float
    stage_durations: Dict[str, float]
    average_confidence: float
    execution_success_rate: float
    retry_count: int
    azure_api_calls: int
    llm_calls: int
    bottleneck_stage: str
    estimated_savings: float
    execution_efficiency: float

class ExecutionSummary(BaseModel):
    """Consolidated action audit trail summary."""
    resource_id: str
    action_type: str
    status: str
    duration_seconds: Optional[float]
    azure_response_summary: Optional[str]
    rollback_status: Optional[str]

class LiveWorkflowState(BaseModel):
    """Polled structure to represent active run progress."""
    workflow_id: str
    status: str
    current_stage: Optional[str]
    completed_stages: List[str]
    remaining_stages: List[str]
    progress_percentage: float
    estimated_time_remaining_seconds: Optional[float]
    active_agent: Optional[str]
    current_reasoning_summary: Optional[str]
    correlation_id: str
    execution_mode: str

class AggregatedMetricsDTO(BaseModel):
    """Overall system statistics across all historical workflows."""
    total_workflow_executions: int
    success_rate: float
    failure_rate: float
    average_workflow_duration: float
    average_stage_duration: Dict[str, float]
    average_confidence: float
    estimated_total_savings: float
    most_common_failure_reasons: List[Dict[str, Any]]
    azure_api_utilization_statistics: Dict[str, int]
    total_discovered_resources: int
    active_agents: int
    azure_resources_managed: int
    azure_regions: int
    running_workflows: int
    pending_approvals: int
    resources_optimized_today: int
    resources_under_observation: int
    cost_saved_today: float
    cost_saved_this_month: float
    policies_checked: int
    azure_api_calls_today: int
    llm_requests: int
    events_processed: int

