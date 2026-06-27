import pytest
from cloud_adapter.mock_client import MockAzureClient

@pytest.mark.asyncio
async def test_mock_client_list_vms(mock_client):
    vms = await mock_client.list_virtual_machines()
    assert len(vms) == 3
    names = [vm.name for vm in vms]
    assert "vm-dev-idle-01" in names
    assert "vm-prod-active-02" in names
    
    # Verify properties
    vm1 = next(vm for vm in vms if vm.name == "vm-dev-idle-01")
    assert vm1.status == "Running"
    assert vm1.tags.get("Environment") == "Dev"

@pytest.mark.asyncio
async def test_mock_client_list_disks(mock_client):
    disks = await mock_client.list_unattached_disks()
    assert len(disks) == 2
    disk_names = [d.name for d in disks]
    assert "disk-temp-orphan-01" in disk_names

@pytest.mark.asyncio
async def test_mock_client_get_telemetry(mock_client):
    metrics = await mock_client.get_resource_telemetry("vm-dev-idle-01", 24)
    assert len(metrics) == 24
    
    # Check chronological ordering
    assert metrics[0].timestamp < metrics[-1].timestamp
    
    # Check range constraints
    for point in metrics:
        assert 0.0 <= point.cpu_percent <= 100.0
        assert point.cpu_percent < 10.0 # Idle VM should keep very low CPU values

@pytest.mark.asyncio
async def test_mock_client_stop_vm():
    # Instantiate new client to isolate state changes
    client = MockAzureClient()
    
    vms = await client.list_virtual_machines()
    vm = next(v for v in vms if v.name == "vm-dev-idle-01")
    assert vm.status == "Running"
    
    success = await client.stop_virtual_machine("vm-dev-idle-01")
    assert success is True
    
    vms_post = await client.list_virtual_machines()
    vm_post = next(v for v in vms_post if v.name == "vm-dev-idle-01")
    assert vm_post.status == "Deallocated"

@pytest.mark.asyncio
async def test_mock_client_delete_disk():
    client = MockAzureClient()
    
    disks = await client.list_unattached_disks()
    assert len(disks) == 2
    
    success = await client.delete_unattached_disk("disk-temp-orphan-01")
    assert success is True
    
    disks_post = await client.list_unattached_disks()
    assert len(disks_post) == 1
    disk_names = [d.name for d in disks_post]
    assert "disk-temp-orphan-01" not in disk_names
