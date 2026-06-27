from pydantic import BaseModel, Field
from typing import Dict, Optional, Any
from datetime import datetime

class AzureResourceBase(BaseModel):
    id: str = Field(..., description="Normalized resource identifier")
    provider_id: str = Field(..., description="Native Azure Provider Resource ID")
    name: str = Field(..., description="Resource name")
    type: str = Field(..., description="Azure Resource Type e.g., Microsoft.Compute/virtualMachines")
    region: str = Field(..., description="Azure Region location")
    status: str = Field(..., description="Execution status, e.g., Running, Stopped, Deallocated")
    tags: Dict[str, str] = Field(default_factory=dict, description="Resource tag dictionary")
    last_seen: datetime = Field(default_factory=datetime.utcnow, description="Timestamp resource was analyzed")

class VirtualMachineResource(AzureResourceBase):
    vm_size: str = Field(..., description="Compute size profile, e.g., Standard_D2s_v5")
    os_type: str = Field(..., description="Operating System platform, Linux or Windows")

class AppServicePlanResource(AzureResourceBase):
    tier: str = Field(..., description="App Service Plan tier, e.g., Standard, PremiumV3")
    sku_name: str = Field(..., description="SKU size profile, e.g., S1, P1v3")

class UnattachedDiskResource(AzureResourceBase):
    size_gb: int = Field(..., description="Storage size allocated in Gigabytes")
    disk_state: str = Field(..., description="Disk operational state, e.g., Unattached")
