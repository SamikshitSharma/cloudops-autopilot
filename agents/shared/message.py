import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from agents.shared.enums import MessageType

class AgentMessage(BaseModel):
    """Structured message payload for agent communication."""
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender: str
    recipient: Optional[str] = None
    message_type: MessageType
    payload: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
