import pytest
from unittest.mock import MagicMock
from cloud_adapter import get_azure_client
from cloud_adapter.live_client import LiveAzureClient
from cloud_adapter.mock_client import MockAzureClient
from shared.config import settings

class MockVM:
    def __init__(self, name, location, vm_size):
        self.id = f"/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/live-rg/providers/Microsoft.Compute/virtualMachines/{name}"
        self.name = name
        self.type = "Microsoft.Compute/virtualMachines"
        self.location = location
        self.tags = {"env": "live"}
        
        class HardwareProfile:
            def __init__(self, size):
                self.vm_size = size
        self.hardware_profile = HardwareProfile(vm_size)
        
        class StorageProfile:
            def __init__(self):
                class OSDisk:
                    def __init__(self):
                        class OSType:
                            value = "Linux"
                        self.os_type = OSType()
                self.os_disk = OSDisk()
        self.storage_profile = StorageProfile()

class MockInstanceView:
    def __init__(self, power_state):
        class Status:
            def __init__(self, ps):
                self.code = f"PowerState/{ps}"
        self.statuses = [Status(power_state)]

class MockDisk:
    def __init__(self, name, location, size_gb, state):
        self.id = f"/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/live-rg/providers/Microsoft.Compute/disks/{name}"
        self.name = name
        self.type = "Microsoft.Compute/disks"
        self.location = location
        self.tags = {"owner": "live-team"}
        self.disk_size_gb = size_gb
        
        class DiskState:
            def __init__(self, st):
                self.value = st
        self.disk_state = DiskState(state)

class MockAppServicePlan:
    def __init__(self, name, location, tier, sku_name, status):
        self.id = f"/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/live-rg/providers/Microsoft.Web/serverfarms/{name}"
        self.name = name
        self.type = "Microsoft.Web/serverfarms"
        self.location = location
        self.tags = {}
        
        class Sku:
            def __init__(self, t, n):
                self.tier = t
                self.name = n
        self.sku = Sku(tier, sku_name)
        
        class PlanStatus:
            def __init__(self, st):
                self.value = st
        self.status = PlanStatus(status)

@pytest.mark.asyncio
async def test_get_azure_client_live_mode_factory(monkeypatch):
    """Verify that CLOUD_MODE=LIVE initializes LiveAzureClient or gracefully falls back to Mock."""
    monkeypatch.setattr(settings, "CLOUD_MODE", "LIVE")
    
    # Force client cache refresh
    import cloud_adapter
    monkeypatch.setattr(cloud_adapter, "_cached_client", None)
    
    client = get_azure_client()
    assert isinstance(client, (LiveAzureClient, MockAzureClient))
    
    # Restore mock mode
    monkeypatch.setattr(cloud_adapter, "_cached_client", None)
    monkeypatch.setattr(settings, "CLOUD_MODE", "MOCK")

@pytest.mark.asyncio
async def test_live_client_success_query(monkeypatch):
    """Verify LiveAzureClient parses Azure SDK responses correctly when SDK calls succeed."""
    client = LiveAzureClient()
    
    # Mock compute client and lists
    mock_compute = MagicMock()
    mock_compute.virtual_machines.list_all.return_type = None
    mock_compute.virtual_machines.list_all.return_value = [
        MockVM("vm-live-01", "eastus", "Standard_D2s_v5")
    ]
    mock_compute.virtual_machines.instance_view.return_value = MockInstanceView("Running")
    
    mock_compute.disks.list.return_value = [
        MockDisk("disk-live-01", "eastus", 256, "Unattached"),
        MockDisk("disk-live-attached", "eastus", 128, "Attached") # Should be filtered out
    ]
    
    # Mock web client
    mock_web = MagicMock()
    mock_web.app_service_plans.list.return_value = [
        MockAppServicePlan("asp-live-01", "eastus", "Premium", "P1v2", "Ready")
    ]
    
    # Inject mocked clients
    client.compute_client = mock_compute
    client.web_client = mock_web
    
    # 1. Test VMs
    vms = await client.list_virtual_machines()
    assert len(vms) == 1
    assert vms[0].name == "vm-live-01"
    assert vms[0].status == "Running"
    assert vms[0].vm_size == "Standard_D2s_v5"
    assert vms[0].tags == {"env": "live"}
    
    # 2. Test Disks (unattached only)
    disks = await client.list_unattached_disks()
    assert len(disks) == 1
    assert disks[0].name == "disk-live-01"
    assert disks[0].status == "Unattached"
    
    # 3. Test App Service Plans
    plans = await client.list_app_service_plans()
    assert len(plans) == 1
    assert plans[0].name == "asp-live-01"
    assert plans[0].tier == "Premium"
    assert plans[0].sku_name == "P1v2"

@pytest.mark.asyncio
async def test_live_client_fallback_on_exception(monkeypatch):
    """Verify that any exception raised by the SDK client triggers automatic fallback to MockAzureClient."""
    client = LiveAzureClient()
    
    # Mock compute_client to throw error on call
    mock_compute = MagicMock()
    mock_compute.virtual_machines.list_all.side_effect = Exception("Subscription authentication failed")
    mock_compute.disks.list.side_effect = Exception("Resource group not found")
    client.compute_client = mock_compute
    
    # Mock web_client to throw error
    mock_web = MagicMock()
    mock_web.app_service_plans.list.side_effect = Exception("Service offline")
    client.web_client = mock_web

    # Mock resource_client to throw error
    mock_resource = MagicMock()
    mock_resource.resources.list.side_effect = Exception("Advisor service unavailable")
    client.resource_client = mock_resource

    
    # 1. list_virtual_machines should fallback and return mock VMs (3 of them)
    vms = await client.list_virtual_machines()
    assert len(vms) == 3
    names = [v.name for v in vms]
    assert "vm-dev-idle-01" in names
    
    # 2. list_unattached_disks should fallback and return mock disks (2 of them)
    disks = await client.list_unattached_disks()
    assert len(disks) == 2
    
    # 3. list_app_service_plans should fallback
    plans = await client.list_app_service_plans()
    assert len(plans) == 1
    
    # 4. telemetry should fallback
    telemetry = await client.get_resource_telemetry("/subscriptions/.../virtualMachines/vm-dev-idle-01", 12)
    assert len(telemetry) == 12

    # 5. cost recommendations should fallback
    recos = await client.get_cost_recommendations()
    assert len(recos) == 3

    # 6. stop vm should fallback
    stop_success = await client.stop_virtual_machine("/subscriptions/.../virtualMachines/vm-dev-idle-01")
    assert stop_success is True

    # 7. stop asp should fallback
    stop_asp_success = await client.stop_app_service_plan("/subscriptions/.../serverfarms/asp-dev-idle-01")
    assert stop_asp_success is True

    # 8. delete disk should fallback
    delete_success = await client.delete_unattached_disk("/subscriptions/.../disks/disk-temp-orphan-01")
    assert delete_success is True
