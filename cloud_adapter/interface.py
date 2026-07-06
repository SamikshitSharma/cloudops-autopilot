from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from shared.schemas.resources import VirtualMachineResource, UnattachedDiskResource, AppServicePlanResource
from shared.schemas.telemetry import TelemetryMetricPoint

class AzureClientAdapter(ABC):
    @abstractmethod
    async def list_virtual_machines(self) -> List[VirtualMachineResource]:
        """Query and list VM resources with metadata."""
        pass

    @abstractmethod
    async def list_unattached_disks(self) -> List[UnattachedDiskResource]:
        """Query and list orphan / unattached storage volumes."""
        pass

    @abstractmethod
    async def list_app_service_plans(self) -> List[AppServicePlanResource]:
        """Query and list active App Service compute tiers."""
        pass

    @abstractmethod
    async def get_resource_telemetry(self, resource_id: str, time_window_hours: int) -> List[TelemetryMetricPoint]:
        """Retrieve metrics timeseries from Monitor."""
        pass

    @abstractmethod
    async def get_cost_recommendations(self) -> List[Dict[str, Any]]:
        """Retrieve cost optimization proposals from Advisor."""
        pass

    @abstractmethod
    async def stop_virtual_machine(self, resource_id: str) -> bool:
        """Execute deallocation on a target VM. Returns True if execution succeeded."""
        pass

    @abstractmethod
    async def start_virtual_machine(self, resource_id: str) -> bool:
        """Start a target VM. Used for explicit actions and rollback."""
        pass

    @abstractmethod
    async def resize_virtual_machine(self, resource_id: str, vm_size: str) -> bool:
        """Resize a target VM to an explicitly selected Azure SKU."""
        pass

    @abstractmethod
    async def stop_app_service_plan(self, resource_id: str) -> bool:
        """Deallocate / Suspend App Service Plan instances. Returns True if succeeded."""
        pass

    @abstractmethod
    async def delete_unattached_disk(self, resource_id: str) -> bool:
        """Permanently delete storage volume. Returns True if succeeded."""
        pass

    @abstractmethod
    def get_mode(self) -> str:
        """Retrieve the adapter's operating mode (MOCK or LIVE)."""
        pass
