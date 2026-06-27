from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.models.base import Base, generate_uuid

class Run(Base):
    """Represents a single optimization sweep execution run."""
    __tablename__ = "runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    status = Column(String(50), nullable=False, default="running")  # running, completed, failed
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    log_file_path = Column(String(500), nullable=True)

    recommendations = relationship("Recommendation", back_populates="run", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="run", cascade="all, delete-orphan")

class AuditLog(Base):
    """Represents an audit entry tracking actions of agents during a scan run."""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    agent_name = Column(String(100), nullable=False)
    step_name = Column(String(100), nullable=False)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False, default=dict)
    status = Column(String(50), nullable=False)  # success, warning, failure

    run = relationship("Run", back_populates="audit_logs")
