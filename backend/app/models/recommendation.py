from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.models.base import Base, generate_uuid

class Recommendation(Base):
    """Represents a suggested optimization action produced by the agents."""
    __tablename__ = "recommendations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    resource_id = Column(String(200), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String(50), nullable=False)  # stop, resize, delete
    saving_amount = Column(Float, nullable=False)
    rationale = Column(String(1000), nullable=False)
    risk_level = Column(String(50), nullable=False)  # low, high
    status = Column(String(50), nullable=False, default="pending")  # pending, auto_executed, escalated, approved, denied, executed, rolled_back
    confidence_score = Column(Float, nullable=True, default=1.0)
    evidence = Column(String(1000), nullable=True)
    reasoning_chain = Column(JSON, nullable=True)

    run = relationship("Run", back_populates="recommendations")
    resource = relationship("Resource", back_populates="recommendations")
    approval = relationship("Approval", uselist=False, back_populates="recommendation", cascade="all, delete-orphan")

class Approval(Base):
    """Tracks human-in-the-loop decisions for high-risk recommendations."""
    __tablename__ = "approvals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    recommendation_id = Column(String(36), ForeignKey("recommendations.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(1000), nullable=True)  # Signed token generated when approved
    status = Column(String(50), nullable=False, default="pending")  # pending, approved, rejected
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    operator_id = Column(String(100), nullable=True)

    recommendation = relationship("Recommendation", back_populates="approval")
