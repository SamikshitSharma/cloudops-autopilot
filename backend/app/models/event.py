from sqlalchemy import Column, String, DateTime, JSON, Integer
from datetime import datetime
from backend.app.models.base import Base

class EventLedger(Base):
    """Immutable log of published events across the system's lightweight event bus."""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    event_name = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False, default=dict)
