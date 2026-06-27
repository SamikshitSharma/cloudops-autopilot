import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from agents.shared.enums import TraceStatus

class AgentExplanation(BaseModel):
    """Structured explainability fields showing why an agent made a decision."""
    why: str
    evidence: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    assumptions: List[str] = Field(default_factory=list)
    next_agent: Optional[str] = None

class ReasoningTrace(BaseModel):
    """Structured reasoning event emitted by an agent during execution."""
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parent_trace_id: Optional[str] = None  # To support hierarchical trace trees
    agent_id: str
    agent_name: str
    event_type: str  # e.g., "thought", "action", "verification", "error"
    description: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    execution_time_ms: float = Field(default=0.0)
    status: TraceStatus = Field(default=TraceStatus.SUCCESS)
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    explanation: Optional[AgentExplanation] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert trace to a JSON-compatible dictionary."""
        return {
            "trace_id": self.trace_id,
            "parent_trace_id": self.parent_trace_id,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "event_type": self.event_type,
            "description": self.description,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat() + "Z",
            "execution_time_ms": self.execution_time_ms,
            "status": self.status.value,
            "confidence_score": self.confidence_score,
            "explanation": self.explanation.model_dump() if self.explanation else None
        }
