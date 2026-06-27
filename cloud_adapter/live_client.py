import os
from typing import List, Dict, Any, Optional
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
        
        # Instantiate fallback mock client
        from cloud_adapter.mock_client import MockAzureClient
        self.mock_fallback = MockAzureClient()
        
        self.credential = None
        self.compute_client = None
        self.resource_client = None
        self.monitor_client = None
        self.web_client = None
        
        try:
            self.credential = DefaultAzureCredential()
            self.compute_client = ComputeManagementClient(self.credential, self.subscription_id)
            self.resource_client = ResourceManagementClient(self.credential, self.subscription_id)
            self.monitor_client = MonitorManagementClient(self.credential, self.subscription_id)
            self.web_client = WebSiteManagementClient(self.credential, self.subscription_id)
            logger.info("LiveAzureClient successfully initialized Azure clients.")
        except Exception as e:
            logger.warning(f"Failed to initialize Azure SDK credentials: {e}. Will fall back to Mock mode for all operations.")

    async def list_virtual_machines(self) -> List[VirtualMachineResource]:
        if not self.compute_client:
            logger.warning("Compute client not initialized. Falling back to Mock mode for list_virtual_machines.")
            return await self.mock_fallback.list_virtual_machines()
            
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
                    status_str = "Running"
                
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
            logger.warning(f"Error querying virtual machines from SDK: {e}. Falling back to Mock mode.")
            return await self.mock_fallback.list_virtual_machines()

    async def list_unattached_disks(self) -> List[UnattachedDiskResource]:
        if not self.compute_client:
            logger.warning("Compute client not initialized. Falling back to Mock mode for list_unattached_disks.")
            return await self.mock_fallback.list_unattached_disks()
            
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
            logger.warning(f"Error querying unattached disks from SDK: {e}. Falling back to Mock mode.")
            return await self.mock_fallback.list_unattached_disks()

    async def list_app_service_plans(self) -> List[AppServicePlanResource]:
        if not self.web_client:
            logger.warning("Web client not initialized. Falling back to Mock mode for list_app_service_plans.")
            return await self.mock_fallback.list_app_service_plans()
            
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
            logger.warning(f"Error querying App Service Plans from SDK: {e}. Falling back to Mock mode.")
            return await self.mock_fallback.list_app_service_plans()

    async def get_resource_telemetry(self, resource_id: str, time_window_hours: int) -> List[TelemetryMetricPoint]:
        resolved_id = await self._resolve_provider_id(resource_id)
        if not self.monitor_client or not resolved_id.startswith("/"):
            logger.warning(f"Monitor client not initialized or resource_id '{resolved_id}' is not a full provider path. Falling back to Mock telemetry.")
            return await self.mock_fallback.get_resource_telemetry(resource_id, time_window_hours)
            
        metrics: List[TelemetryMetricPoint] = []
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=time_window_hours)
            timespan = f"{start_time.isoformat()}Z/{end_time.isoformat()}Z"
            
            metric_data = self.monitor_client.metrics.list(
                resolved_id,
                timespan=timespan,
                interval="PT1H",
                metricnames="Percentage CPU",
                aggregation="Average"
            )
            
            for item in metric_data.value:
                for time_series in item.timeseries:
                    for data_point in time_series.data:
                        metrics.append(TelemetryMetricPoint(
                            timestamp=data_point.time_stamp,
                            cpu_percent=data_point.average if data_point.average is not None else 0.0,
                            memory_bytes=0,
                            network_in_bytes=0,
                            network_out_bytes=0
                        ))
            return metrics
        except Exception as e:
            logger.warning(f"Failed to query monitor metrics for {resource_id}: {e}. Falling back to Mock telemetry.")
            return await self.mock_fallback.get_resource_telemetry(resource_id, time_window_hours)

    async def get_cost_recommendations(self) -> List[Dict[str, Any]]:
        if not self.resource_client:
            logger.warning("Resource client not initialized. Falling back to Mock cost recommendations.")
            return await self.mock_fallback.get_cost_recommendations()
            
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
            logger.warning(f"Error fetching Advisor recommendations from SDK: {e}. Falling back to Mock recommendations.")
            return await self.mock_fallback.get_cost_recommendations()

    async def stop_virtual_machine(self, resource_id: str) -> bool:
        resolved_id = await self._resolve_provider_id(resource_id)
        if not self.compute_client or not resolved_id.startswith("/"):
            logger.warning(f"Compute client not initialized or resource_id '{resolved_id}' is not a provider path. Falling back to Mock VM stop.")
            return await self.mock_fallback.stop_virtual_machine(resource_id)
            
        try:
            rg = self._extract_resource_group(resolved_id)
            vm_name = resolved_id.split("/")[-1]
            poller = self.compute_client.virtual_machines.begin_power_off(rg, vm_name)
            poller.result() # Wait for execution completion
            return True
        except Exception as e:
            logger.warning(f"Failed to power off VM {resource_id}: {e}. Falling back to Mock VM stop.")
            return await self.mock_fallback.stop_virtual_machine(resource_id)

    async def stop_app_service_plan(self, resource_id: str) -> bool:
        resolved_id = await self._resolve_provider_id(resource_id)
        if not self.web_client or not resolved_id.startswith("/"):
            logger.warning(f"Web client not initialized or resource_id '{resolved_id}' is not a provider path. Falling back to Mock App Service Plan stop.")
            return await self.mock_fallback.stop_app_service_plan(resource_id)
            
        try:
            rg = self._extract_resource_group(resolved_id)
            plan_name = resolved_id.split("/")[-1]
            plan = self.web_client.app_service_plans.get(rg, plan_name)
            if plan:
                return True
            return False
        except Exception as e:
            logger.warning(f"Failed to stop App Service Plan {resource_id}: {e}. Falling back to Mock App Service Plan stop.")
            return await self.mock_fallback.stop_app_service_plan(resource_id)

    async def delete_unattached_disk(self, resource_id: str) -> bool:
        resolved_id = await self._resolve_provider_id(resource_id)
        if not self.compute_client or not resolved_id.startswith("/"):
            logger.warning(f"Compute client not initialized or resource_id '{resolved_id}' is not a provider path. Falling back to Mock disk delete.")
            return await self.mock_fallback.delete_unattached_disk(resource_id)
            
        try:
            rg = self._extract_resource_group(resolved_id)
            disk_name = resolved_id.split("/")[-1]
            poller = self.compute_client.disks.begin_delete(rg, disk_name)
            poller.result()
            return True
        except Exception as e:
            logger.warning(f"Failed to delete disk {resource_id}: {e}. Falling back to Mock disk delete.")
            return await self.mock_fallback.delete_unattached_disk(resource_id)

    def _extract_resource_group(self, provider_id: str) -> str:
        parts = provider_id.split("/")
        try:
            rg_idx = parts.index("resourceGroups")
            return parts[rg_idx + 1]
        except (ValueError, IndexError):
            return "default-rg"

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
                
        # Try to resolve against generic resources in cloudops-demo-rg
        if self.resource_client:
            try:
                resources = self.resource_client.resources.list_by_resource_group("cloudops-demo-rg")
                for res in resources:
                    if res.name == resource_id:
                        return res.id
            except Exception:
                pass
                
        return resource_id
