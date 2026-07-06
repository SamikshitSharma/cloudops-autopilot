from sqlalchemy import Column, String, DateTime, JSON
from datetime import datetime
from backend.app.models.base import Base, generate_uuid

class AgentReasoningPath(Base):
    """Logs the step-by-step logic of an agent evaluating a resource."""
    __tablename__ = "agent_reasoning_paths"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    resource_id = Column(String(200), nullable=True) # Optional association with an Azure resource
    agent_name = Column(String(100), nullable=False)
    trigger_event = Column(String(200), nullable=False)
    observations = Column(JSON, nullable=False, default=dict)
    hypotheses = Column(JSON, nullable=False, default=list)
    policy_check_status = Column(String(100), nullable=False)
    recommended_action = Column(String(200), nullable=False)
