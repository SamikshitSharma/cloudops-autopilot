from typing import List, Dict, Any
from datetime import datetime, timedelta
import random
from cloud_adapter.interface import AzureClientAdapter
from shared.schemas.resources import VirtualMachineResource, UnattachedDiskResource, AppServicePlanResource
from shared.schemas.telemetry import TelemetryMetricPoint

class MockAzureClient(AzureClientAdapter):
    def __init__(self) -> None:
        # In-memory database representing simulated Azure resources
        self._vms: Dict[str, VirtualMachineResource] = {
            "vm-dev-idle-01": VirtualMachineResource(
                id="vm-dev-idle-01",
                provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-dev/providers/Microsoft.Compute/virtualMachines/vm-dev-idle-01",
                name="vm-dev-idle-01",
                type="Microsoft.Compute/virtualMachines",
                region="eastus",
                status="Running",
                tags={"Environment": "Dev", "Owner": "Sam"},
                vm_size="Standard_D2s_v5",
                os_type="Linux"
            ),
            "vm-prod-active-02": VirtualMachineResource(
                id="vm-prod-active-02",
                provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-prod-active-02",
                name="vm-prod-active-02",
                type="Microsoft.Compute/virtualMachines",
                region="eastus2",
                status="Running",
                tags={"Environment": "Production", "Owner": "Admin", "NeverStop": "True"},
                vm_size="Standard_D4s_v5",
                os_type="Linux"
            ),
            "vm-test-idle-03": VirtualMachineResource(
                id="vm-test-idle-03",
                provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Compute/virtualMachines/vm-test-idle-03",
                name="vm-test-idle-03",
                type="Microsoft.Compute/virtualMachines",
                region="westus",
                status="Running",
                tags={"Environment": "Test"},
                vm_size="Standard_B2s",
                os_type="Windows"
            )
        }

        self._disks: Dict[str, UnattachedDiskResource] = {
            "disk-temp-orphan-01": UnattachedDiskResource(
                id="disk-temp-orphan-01",
                provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-dev/providers/Microsoft.Compute/disks/disk-temp-orphan-01",
                name="disk-temp-orphan-01",
                type="Microsoft.Compute/disks",
                region="eastus",
                status="Unattached",
                tags={"Environment": "Dev", "CleanUp": "True"},
                size_gb=128,
                disk_state="Unattached"
            ),
            "disk-prod-backup-02": UnattachedDiskResource(
                id="disk-prod-backup-02",
                provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/disks/disk-prod-backup-02",
                name="disk-prod-backup-02",
                type="Microsoft.Compute/disks",
                region="eastus2",
                status="Unattached",
                tags={"Environment": "Production", "Backup": "True"},
                size_gb=512,
                disk_state="Unattached"
            )
        }

        self._plans: Dict[str, AppServicePlanResource] = {
            "asp-dev-idle-01": AppServicePlanResource(
                id="asp-dev-idle-01",
                provider_id="/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-dev/providers/Microsoft.Web/serverfarms/asp-dev-idle-01",
                name="asp-dev-idle-01",
                type="Microsoft.Web/serverfarms",
                region="eastus",
                status="Running",
                tags={"Environment": "Dev"},
                tier="Standard",
                sku_name="S1"
            )
        }

    async def list_virtual_machines(self) -> List[VirtualMachineResource]:
        return list(self._vms.values())

    async def list_unattached_disks(self) -> List[UnattachedDiskResource]:
        return list(self._disks.values())

    async def list_app_service_plans(self) -> List[AppServicePlanResource]:
        return list(self._plans.values())

    async def get_resource_telemetry(self, resource_id: str, time_window_hours: int) -> List[TelemetryMetricPoint]:
        # Generate metrics every hour backwards from now
        now = datetime.utcnow()
        metrics: List[TelemetryMetricPoint] = []
        
        is_idle_target = "idle" in resource_id or "orphan" in resource_id
        
        # Seed values based on whether the resource is intended to be idle
        base_cpu = 1.2 if is_idle_target else 45.0
        cpu_variance = 0.5 if is_idle_target else 15.0
        base_mem = 1024 * 1024 * 512 if is_idle_target else 1024 * 1024 * 2048
        
        for i in range(time_window_hours):
            timestamp = now - timedelta(hours=i)
            # Add randomized variance
            cpu = max(0.1, min(100.0, base_cpu + random.uniform(-cpu_variance, cpu_variance)))
            mem = int(max(0, base_mem + random.randint(-10000000, 10000000)))
            net_in = random.randint(100, 2000) if is_idle_target else random.randint(50000, 500000)
            net_out = random.randint(100, 2000) if is_idle_target else random.randint(50000, 500000)
            
            metrics.append(TelemetryMetricPoint(
                timestamp=timestamp,
                cpu_percent=round(cpu, 2),
                memory_bytes=mem,
                network_in_bytes=net_in,
                network_out_bytes=net_out
            ))
            
        # Keep metrics in chronological order
        metrics.reverse()
        return metrics

    async def get_cost_recommendations(self) -> List[Dict[str, Any]]:
        # Return mock recommendations matching our idle resources
        return [
            {
                "resourceId": "vm-dev-idle-01",
                "category": "Cost",
                "impact": "High",
                "recommendationName": "Shutdown idle virtual machines",
                "savingsAmount": 75.0,
                "description": "Virtual machine vm-dev-idle-01 has been identified as idle. Shutdown to save $75.00/month."
            },
            {
                "resourceId": "disk-temp-orphan-01",
                "category": "Cost",
                "impact": "Medium",
                "recommendationName": "Delete unattached disks",
                "savingsAmount": 18.5,
                "description": "Storage disk disk-temp-orphan-01 is unattached. Delete to save $18.50/month."
            },
            {
                "resourceId": "asp-dev-idle-01",
                "category": "Cost",
                "impact": "Low",
                "recommendationName": "Scale down underutilized App Service Plans",
                "savingsAmount": 22.0,
                "description": "App Service Plan asp-dev-idle-01 is underutilized. Scale down from Standard (S1) to Free/Shared to save $22.00/month."
            }
        ]

    async def stop_virtual_machine(self, resource_id: str) -> bool:
        if resource_id in self._vms:
            self._vms[resource_id].status = "Deallocated"
            return True
        return False

    async def start_virtual_machine(self, resource_id: str) -> bool:
        if resource_id in self._vms:
            self._vms[resource_id].status = "Running"
            return True
        return False

    async def resize_virtual_machine(self, resource_id: str, vm_size: str) -> bool:
        if resource_id in self._vms:
            self._vms[resource_id].vm_size = vm_size
            return True
        return False

    async def stop_app_service_plan(self, resource_id: str) -> bool:
        if resource_id in self._plans:
            self._plans[resource_id].status = "Stopped"
            return True
        return False

    async def delete_unattached_disk(self, resource_id: str) -> bool:
        if resource_id in self._disks:
            del self._disks[resource_id]
            return True
        return False

    def get_mode(self) -> str:
        return "MOCK"
