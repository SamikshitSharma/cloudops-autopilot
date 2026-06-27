from pydantic import BaseModel, Field
from typing import List
from datetime import datetime

class TelemetryMetricPoint(BaseModel):
    timestamp: datetime = Field(..., description="Timestamp of the metric capture")
    cpu_percent: float = Field(..., description="Percentage CPU utilization, range 0.0 - 100.0")
    memory_bytes: int = Field(..., description="Memory consumption in bytes")
    network_in_bytes: int = Field(..., description="Network input rate in bytes")
    network_out_bytes: int = Field(..., description="Network output rate in bytes")

class ResourceTelemetrySeries(BaseModel):
    resource_id: str = Field(..., description="Target resource identifier")
    metrics: List[TelemetryMetricPoint] = Field(default_factory=list, description="List of timeseries metric points")

class TelemetrySummary(BaseModel):
    resource_id: str = Field(..., description="Target resource identifier")
    avg_cpu: float = Field(..., description="Average CPU utilization over analyzed time frame")
    max_cpu: float = Field(..., description="Maximum CPU utilization recorded")
    avg_memory_bytes: float = Field(..., description="Average memory utilization in bytes")
    network_total_bytes: int = Field(..., description="Sum of network bytes processed (in + out)")
    is_idle: bool = Field(default=False, description="Flag indicating if the resource meets the idle threshold rules")
    confidence_score: float = Field(..., description="Reasoning confidence score between 0.0 and 1.0")
