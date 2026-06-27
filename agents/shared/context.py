from typing import Dict, List, Any
from pydantic import BaseModel, Field, ConfigDict

class AgentContext(BaseModel):
    """Immutable context traveling between agents.
    
    Modified elements should be created by generating a new copy with updates.
    """
    model_config = ConfigDict(frozen=True)

    telemetry: Dict[str, Any] = Field(default_factory=dict)
    recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    policies: List[Dict[str, Any]] = Field(default_factory=list)
    cost_estimates: Dict[str, Any] = Field(default_factory=dict)
    approval_status: Dict[str, Any] = Field(default_factory=dict)
    execution_history: List[Dict[str, Any]] = Field(default_factory=list)
    reasoning_history: List[Dict[str, Any]] = Field(default_factory=list)
