from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Float, Integer, BigInteger
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.models.base import Base

class Resource(Base):
    """Represents a discovered cloud resource in inventory."""
    __tablename__ = "resources"

    id = Column(String(200), primary_key=True)  # Normalized name / path
    provider_id = Column(String(500), nullable=False)  # Azure provider path
    name = Column(String(200), nullable=False)
    type = Column(String(100), nullable=False)  # Microsoft.Compute/virtualMachines, etc.
    region = Column(String(100), nullable=False)
    status = Column(String(100), nullable=False)  # Running, Stopped, etc.
    tags = Column(JSON, nullable=False, default=dict)
    last_seen = Column(DateTime, nullable=False, default=datetime.utcnow)

    telemetry = relationship("TelemetryHistory", back_populates="resource", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="resource", cascade="all, delete-orphan")

class TelemetryHistory(Base):
    """Represents raw performance metrics recorded for a resource."""
    __tablename__ = "telemetry_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(String(200), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    cpu_percent = Column(Float, nullable=False)
    memory_bytes = Column(BigInteger, nullable=False)
    network_in_bytes = Column(BigInteger, nullable=False)
    network_out_bytes = Column(BigInteger, nullable=False)

    resource = relationship("Resource", back_populates="telemetry")
