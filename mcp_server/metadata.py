from typing import Optional
from pydantic import BaseModel, Field

class ToolMetadata(BaseModel):
    """Metadata detailing the capabilities, safety limits, and execution metrics of an MCP Tool."""
    tool_name: str
    description: str
    version: str = "1.0.0"
    category: str  # e.g., "telemetry", "recommendations", "execution", "audit"
    permission_level: str  # e.g., "READ", "WRITE", "ADMIN"
    risk_level: str  # e.g., "low", "high"
    supports_rollback: bool = False
    estimated_runtime_ms: int = 100
