from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Float, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.models.base import Base, generate_uuid

class SequentialWorkflow(Base):
    """Represents a sequential multi-agent workflow execution (competition-grade)."""
    __tablename__ = "sequential_workflows"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, running, completed, failed, blocked_on_approval
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    objective = Column(String(255), nullable=True)
    scenario_name = Column(String(100), nullable=True)
    execution_mode = Column(String(20), nullable=False, default="MOCK")  # MOCK or LIVE
    correlation_id = Column(String(50), nullable=False)
    
    # Shared Workflow Context (Single source of truth)
    context = Column(JSON, nullable=False, default=dict)
    
    # Final Output Summaries
    reasoning_chain = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=True)
    evidence = Column(JSON, nullable=True)
    errors = Column(JSON, nullable=True)
    azure_actions = Column(JSON, nullable=True)
    duration = Column(Float, nullable=True)  # total duration in seconds
    
    # Performance & Aggregated Metrics
    metrics = Column(JSON, nullable=True)
    
    # Rendering visualization graph structure
    visualization_model = Column(JSON, nullable=True)
    
    # Versioning metadata
    version_info = Column(JSON, nullable=True)

    stages = relationship("WorkflowStage", back_populates="workflow", cascade="all, delete-orphan")
    events = relationship("WorkflowEventLog", back_populates="workflow", cascade="all, delete-orphan")
    run = relationship("Run")

    __table_args__ = (
        Index("idx_wf_run_id", "run_id"),
        Index("idx_wf_correlation_id", "correlation_id"),
        Index("idx_wf_status", "status"),
    )

class WorkflowStage(Base):
    """Represents a single stage execution tracking inside a sequential workflow."""
    __tablename__ = "workflow_stages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workflow_id = Column(String(36), ForeignKey("sequential_workflows.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(String(100), nullable=False)  # e.g. "inventory_agent"
    stage_name = Column(String(100), nullable=False)  # e.g. "Inventory Agent"
    status = Column(String(50), nullable=False, default="pending")  # pending, running, success, failed, skipped
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration = Column(Float, nullable=True)  # duration in seconds

    # Lifecycle outputs
    input_summary = Column(JSON, nullable=True)
    output_summary = Column(JSON, nullable=True)
    reasoning_summary = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=True)
    errors = Column(JSON, nullable=True)
    
    # LLM Traceability Info
    llm_trace = Column(JSON, nullable=True)

    workflow = relationship("SequentialWorkflow", back_populates="stages")

    __table_args__ = (
        Index("idx_wf_stage_wfid", "workflow_id"),
        Index("idx_wf_stage_id", "stage_id"),
    )

class WorkflowEventLog(Base):
    """Persistent store for all events emitted during workflow execution."""
    __tablename__ = "workflow_event_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workflow_id = Column(String(36), ForeignKey("sequential_workflows.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(100), nullable=False)  # WorkflowStarted, StageStarted, etc.
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    stage_id = Column(String(100), nullable=True)
    correlation_id = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=False, default=dict)

    workflow = relationship("SequentialWorkflow", back_populates="events")

    __table_args__ = (
        Index("idx_wf_event_wfid", "workflow_id"),
        Index("idx_wf_event_type", "event_type"),
    )
