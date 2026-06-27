from typing import List, Dict, Any
from pydantic import BaseModel, Field

class ActionStep(BaseModel):
    """A single discrete step within a structured ActionPlan."""
    step_id: str
    description: str
    action_type: str  # e.g., "stop", "delete", "resize"
    resource_id: str
    dependencies: List[str] = Field(default_factory=list)  # step_ids that must complete first
    expected_outcome: str
    rollback_step: Dict[str, Any] = Field(default_factory=dict)  # placeholder instructions for revert

class StructuredActionPlan(BaseModel):
    """Targeted plan containing ordered steps, dependencies, cost savings, and risk profiles."""
    plan_id: str
    recommendation_id: str
    steps: List[ActionStep]
    requires_approval: bool
    risk_level: str  # e.g., "low", "high"
    estimated_cost_saving: float = 0.0
    estimated_execution_time: float = 0.0  # expected duration in seconds
    risk_score: float = Field(0.0, ge=0.0, le=1.0)
