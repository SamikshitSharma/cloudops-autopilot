import os
from typing import List, Dict, Any
from datetime import datetime, timedelta
import logging

# Azure SDK Imports
from azure.identity import DefaultAzureCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.monitor import MonitorManagementClient
from azure.mgmt.web import WebSiteManagementClient

from cloud_adapter.interface import AzureClientAdapter
from shared.schemas.resources import VirtualMachineResource, UnattachedDiskResource, AppServicePlanResource
from shared.schemas.telemetry import TelemetryMetricPoint

logger = logging.getLogger("LiveAzureClient")

class LiveAzureClient(AzureClientAdapter):
    def __init__(self) -> None:
        self.subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID", "00000000-0000-0000-0000-000000000000")
        if self.subscription_id == "00000000-0000-0000-0000-000000000000":
            raise RuntimeError("AZURE_SUBSCRIPTION_ID must be configured when CLOUD_MODE=LIVE")
        
        self.credential = None
        self.compute_client = None
        self.resource_client = None
        self.monitor_client = None
        self.web_client = None
        self.last_error = None
        
        try:
            self.credential = DefaultAzureCredential()
            self.compute_client = ComputeManagementClient(self.credential, self.subscription_id)
            self.resource_client = ResourceManagementClient(self.credential, self.subscription_id)
            self.monitor_client = MonitorManagementClient(self.credential, self.subscription_id)
            self.web_client = WebSiteManagementClient(self.credential, self.subscription_id)
            logger.info("LiveAzureClient successfully initialized Azure clients.")
        except Exception as e:
            self.last_error = f"Azure SDK initialization failed: {e}"
            logger.error(self.last_error)
            raise RuntimeError(self.last_error) from e

    def _operation_failed(self, operation: str, error: Exception) -> RuntimeError:
        self.last_error = f"Azure {operation} failed: {error}"
        logger.error(self.last_error)
        return RuntimeError(self.last_error)

    async def list_virtual_machines(self) -> List[VirtualMachineResource]:
        if not self.compute_client:
            raise RuntimeError("Azure compute client is not initialized")
            
        vms: List[VirtualMachineResource] = []
        try:
            # Query SDK paged collection
            for vm in self.compute_client.virtual_machines.list_all():
                rg = self._extract_resource_group(vm.id)
                status_str = "Unknown"
                try:
                    instance_view = self.compute_client.virtual_machines.instance_view(rg, vm.name)
                    for status in instance_view.statuses:
                        if status.code.startswith("PowerState/"):
                            status_str = status.code.split("/")[-1] # Running, Stopped, Deallocated
                except Exception as e:
                    logger.warning(f"Could not retrieve instance view status for VM {vm.name}: {e}")
                    status_str = "Unknown"
                
                vms.append(VirtualMachineResource(
                    id=vm.name,
                    provider_id=vm.id,
                    name=vm.name,
                    type=vm.type,
                    region=vm.location,
                    status=status_str,
                    tags=vm.tags or {},
                    vm_size=vm.hardware_profile.vm_size if vm.hardware_profile else "Unknown",
                    os_type=vm.storage_profile.os_disk.os_type.value if vm.storage_profile and vm.storage_profile.os_disk and vm.storage_profile.os_disk.os_type else "Linux"
                ))
            return vms
        except Exception as e:
            raise self._operation_failed("virtual machine discovery", e) from e

    async def list_unattached_disks(self) -> List[UnattachedDiskResource]:
        if not self.compute_client:
            raise RuntimeError("Azure compute client is not initialized")
            
        disks: List[UnattachedDiskResource] = []
        try:
            for disk in self.compute_client.disks.list():
                is_unattached = disk.disk_state.value == "Unattached" if disk.disk_state else True
                if is_unattached:
                    disks.append(UnattachedDiskResource(
                        id=disk.name,
                        provider_id=disk.id,
                        name=disk.name,
                        type=disk.type,
                        region=disk.location,
                        status="Unattached",
                        tags=disk.tags or {},
                        size_gb=disk.disk_size_gb or 0,
                        disk_state="Unattached"
                    ))
            return disks
        except Exception as e:
            raise self._operation_failed("disk discovery", e) from e

    async def list_app_service_plans(self) -> List[AppServicePlanResource]:
        if not self.web_client:
            raise RuntimeError("Azure web client is not initialized")
            
        plans: List[AppServicePlanResource] = []
        try:
            for plan in self.web_client.app_service_plans.list(detailed=True):
                plans.append(AppServicePlanResource(
                    id=plan.name,
                    provider_id=plan.id,
                    name=plan.name,
                    type=plan.type,
                    region=plan.location,
                    status=plan.status.value if plan.status else "Running",
                    tags=plan.tags or {},
                    tier=plan.sku.tier if plan.sku else "Unknown",
                    sku_name=plan.sku.name if plan.sku else "Unknown"
                ))
            return plans
        except Exception as e:
            raise self._operation_failed("App Service plan discovery", e) from e

    async def get_resource_telemetry(self, resource_id: str, time_window_hours: int) -> List[TelemetryMetricPoint]:
        resolved_id = await self._resolve_provider_id(resource_id)
        if not self.monitor_client:
            raise RuntimeError("Azure Monitor client is not initialized")
        if not resolved_id.startswith("/"):
            raise ValueError(f"Resource '{resource_id}' could not be resolved to an Azure provider ID")
            
        metrics: List[TelemetryMetricPoint] = []
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=time_window_hours)
            timespan = f"{start_time.isoformat()}Z/{end_time.isoformat()}Z"
            
            metric_name = "Percentage CPU"
            if "serverfarms" in resolved_id.lower():
                metric_name = "CpuPercentage"

            metric_data = self.monitor_client.metrics.list(
                resolved_id,
                timespan=timespan,
                interval="PT1H",
                metricnames=metric_name,
                aggregation="Average"
            )
            
            for item in metric_data.value:
                for time_series in item.timeseries:
                    for data_point in time_series.data:
                        if data_point.average is None:
                            continue
                        metrics.append(TelemetryMetricPoint(
                            timestamp=data_point.time_stamp,
                            cpu_percent=data_point.average,
                            memory_bytes=0,
                            network_in_bytes=0,
                            network_out_bytes=0
                        ))
            return metrics
        except Exception as e:
            raise self._operation_failed(f"Monitor metrics query for '{resource_id}'", e) from e

    async def get_cost_recommendations(self) -> List[Dict[str, Any]]:
        if not self.resource_client:
            raise RuntimeError("Azure resource client is not initialized")
            
        recommendations: List[Dict[str, Any]] = []
        try:
            resources = self.resource_client.resources.list(
                filter="resourceType eq 'Microsoft.Advisor/recommendations'"
            )
            for res in resources:
                props = res.properties or {}
                recommendations.append({
                    "resourceId": props.get("resourceMetadata", {}).get("resourceId", res.id),
                    "category": props.get("category", "Cost"),
                    "impact": props.get("impact", "Medium"),
                    "recommendationName": res.name,
                    "savingsAmount": props.get("savingsAmount", 0.0),
                    "description": props.get("shortDescription", {}).get("problem", "Advisor recommendation")
                })
            return recommendations
        except Exception as e:
            raise self._operation_failed("Advisor recommendation query", e) from e

    async def stop_virtual_machine(self, resource_id: str) -> bool:
        resolved_id = await self._resolve_provider_id(resource_id)
        if not self.compute_client or not resolved_id.startswith("/"):
            raise ValueError(f"VM '{resource_id}' could not be resolved to an Azure provider ID")
        try:
            rg = self._extract_resource_group(resolved_id)
            vm_name = resolved_id.split("/")[-1]
            self.compute_client.virtual_machines.begin_deallocate(rg, vm_name).result()
            return True
        except Exception as e:
            raise self._operation_failed(f"VM deallocation for '{resource_id}'", e) from e

    async def start_virtual_machine(self, resource_id: str) -> bool:
        resolved_id = await self._resolve_provider_id(resource_id)
        if not self.compute_client or not resolved_id.startswith("/"):
            raise ValueError(f"VM '{resource_id}' could not be resolved to an Azure provider ID")
        try:
            rg = self._extract_resource_group(resolved_id)
            vm_name = resolved_id.split("/")[-1]
            self.compute_client.virtual_machines.begin_start(rg, vm_name).result()
            return True
        except Exception as e:
            raise self._operation_failed(f"VM start for '{resource_id}'", e) from e

    async def resize_virtual_machine(self, resource_id: str, vm_size: str) -> bool:
        resolved_id = await self._resolve_provider_id(resource_id)
        if not self.compute_client or not resolved_id.startswith("/"):
            raise ValueError(f"VM '{resource_id}' could not be resolved to an Azure provider ID")
        try:
            rg = self._extract_resource_group(resolved_id)
            vm_name = resolved_id.split("/")[-1]
            vm = self.compute_client.virtual_machines.get(rg, vm_name)
            vm.hardware_profile.vm_size = vm_size
            self.compute_client.virtual_machines.begin_create_or_update(rg, vm_name, vm).result()
            return True
        except Exception as e:
            raise self._operation_failed(f"VM resize for '{resource_id}'", e) from e

    async def stop_app_service_plan(self, resource_id: str) -> bool:
        raise NotImplementedError(
            "Azure App Service Plans cannot be stopped directly; stop hosted apps or scale the plan explicitly."
        )

    async def delete_unattached_disk(self, resource_id: str) -> bool:
        resolved_id = await self._resolve_provider_id(resource_id)
        if not self.compute_client or not resolved_id.startswith("/"):
            raise ValueError(f"Disk '{resource_id}' could not be resolved to an Azure provider ID")
            
        try:
            rg = self._extract_resource_group(resolved_id)
            disk_name = resolved_id.split("/")[-1]
            poller = self.compute_client.disks.begin_delete(rg, disk_name)
            poller.result()
            return True
        except Exception as e:
            raise self._operation_failed(f"disk deletion for '{resource_id}'", e) from e

    def _extract_resource_group(self, provider_id: str) -> str:
        parts = provider_id.split("/")
        try:
            rg_idx = parts.index("resourceGroups")
            return parts[rg_idx + 1]
        except (ValueError, IndexError) as e:
            raise ValueError(f"Azure provider ID does not contain a resource group: {provider_id}") from e

    async def _resolve_provider_id(self, resource_id: str) -> str:
        if not resource_id or resource_id.startswith("/"):
            return resource_id
            
        # Try to resolve against VMs
        vms = await self.list_virtual_machines()
        for vm in vms:
            if vm.name == resource_id or vm.id == resource_id:
                return vm.provider_id
                
        # Try to resolve against App Service Plans
        plans = await self.list_app_service_plans()
        for plan in plans:
            if plan.name == resource_id or plan.id == resource_id:
                return plan.provider_id
                
        # Resolve against the configured Azure subscription inventory.
        if self.resource_client:
            try:
                resources = self.resource_client.resources.list()
                for res in resources:
                    if res.name == resource_id:
                        return res.id
            except Exception as e:
                raise self._operation_failed(f"resource resolution for '{resource_id}'", e) from e
                
        return resource_id

    def get_mode(self) -> str:
        return "LIVE"
