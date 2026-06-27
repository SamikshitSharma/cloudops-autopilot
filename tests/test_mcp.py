import pytest
import asyncio
from typing import Dict, Any
from mcp_server.server import get_registered_tool_functions
from mcp_server.exceptions import (
    ApprovalRequiredError,
    InvalidApprovalTokenError,
    ToolValidationError,
    ExecutionDeniedError,
    RollbackFailedError
)
from backend.app.events.event_bus import event_bus

@pytest.mark.asyncio
async def test_mcp_tool_registration():
    """Verify all 13 required MCP tools are present in the function registry."""
    tools = get_registered_tool_functions()
    required = [
        "list_resources", "get_resource", "get_telemetry",
        "recommend_resize", "recommend_stop", "recommend_delete_disk",
        "estimate_cost", "request_approval", "create_execution_plan",
        "execute_plan", "verify_execution", "rollback_execution",
        "audit_run"
    ]
    for r in required:
        assert r in tools
        assert callable(tools[r])

@pytest.mark.asyncio
async def test_mcp_tool_metadata():
    """Verify that MCP tool invocations return valid metadata details."""
    tools = get_registered_tool_functions()
    
    # Query list_resources
    res = await tools["list_resources"](workflow_id="wf-test-meta", agent_id="telemetry_agent")
    assert "metadata" in res
    meta = res["metadata"]
    assert meta["tool_name"] == "list_resources"
    assert meta["version"] == "1.0.0"
    assert meta["category"] == "telemetry"
    assert meta["permission_level"] == "READ"
    assert meta["risk_level"] == "low"
    assert meta["supports_rollback"] is False
    assert meta["estimated_runtime_ms"] > 0

@pytest.mark.asyncio
async def test_mcp_tool_validation():
    """Verify validation triggers ToolValidationError for invalid parameters."""
    tools = get_registered_tool_functions()
    
    # Missing workflow_id (empty string) should fail validation
    with pytest.raises(ToolValidationError):
        await tools["list_resources"](workflow_id="", agent_id="telemetry_agent")

    # Resource not found should raise validation error
    with pytest.raises(ToolValidationError):
        await tools["get_resource"](resource_id="non-existent-vm", workflow_id="wf-test", agent_id="telemetry_agent")

@pytest.mark.asyncio
async def test_mcp_permission_gates():
    """Verify write tools enforce approval tokens and raise custom exceptions."""
    tools = get_registered_tool_functions()
    
    # 1. Calling execute_plan without a token should raise ApprovalRequiredError
    with pytest.raises(ApprovalRequiredError):
        await tools["execute_plan"](
            plan_id="plan-auto-777",
            token="",
            workflow_id="wf-test",
            agent_id="execution_agent"
        )
        
    # 2. Calling execute_plan with invalid token should raise InvalidApprovalTokenError
    with pytest.raises(InvalidApprovalTokenError):
        await tools["execute_plan"](
            plan_id="plan-auto-777",
            token="invalid-token-123",
            workflow_id="wf-test",
            agent_id="execution_agent"
        )

@pytest.mark.asyncio
async def test_mcp_approval_flow_and_execution():
    """Verify request_approval yields a token that allows execution plan creation and run."""
    tools = get_registered_tool_functions()
    
    # 1. Request approval to get a token
    app_res = await tools["request_approval"](
        resource_id="vm-dev-idle-01",
        action="stop",
        workflow_id="wf-test",
        agent_id="decision_agent"
    )
    token = app_res["output"]["token"]
    assert token.startswith("token-")
    
    # 2. Create execution plan with valid token
    plan_dict = {
        "plan_id": "plan-mcp-test-1",
        "steps": [
            {"action_type": "stop", "resource_id": "vm-dev-idle-01"}
        ]
    }
    create_res = await tools["create_execution_plan"](
        action_plan=plan_dict,
        token=token,
        workflow_id="wf-test",
        agent_id="execution_agent"
    )
    assert create_res["output"]["status"] == "REGISTERED"
    
    # 3. Execute plan
    exec_res = await tools["execute_plan"](
        plan_id="plan-mcp-test-1",
        token=token,
        workflow_id="wf-test",
        agent_id="execution_agent"
    )
    assert exec_res["output"]["status"] == "COMPLETED"
    assert exec_res["output"]["success"] is True

@pytest.mark.asyncio
async def test_mcp_dry_run_mode():
    """Verify dry-run mode validates token but avoids modifying cloud state."""
    tools = get_registered_tool_functions()
    
    # Get a valid token
    app_res = await tools["request_approval"](
        resource_id="vm-dev-idle-01",
        action="stop",
        workflow_id="wf-test",
        agent_id="decision_agent"
    )
    token = app_res["output"]["token"]
    
    # Register plan in dry run mode
    plan_dict = {
        "plan_id": "plan-dry-run",
        "steps": [
            {"action_type": "stop", "resource_id": "vm-dev-idle-01"}
        ]
    }
    
    # Execute create_execution_plan with dry_run = True
    dry_plan = await tools["create_execution_plan"](
        action_plan=plan_dict,
        token=token,
        workflow_id="wf-test",
        agent_id="execution_agent",
        dry_run=True
    )
    assert dry_plan["output"]["status"] == "DRY_RUN_SUCCESS"
    assert dry_plan["output"]["dry_run"] is True

@pytest.mark.asyncio
async def test_mcp_event_bus_lifecycle():
    """Verify tool execution publishes ToolStarted, ToolCompleted, and ToolFailed to the event bus."""
    tools = get_registered_tool_functions()
    
    started_events = []
    completed_events = []
    failed_events = []
    
    async def started_cb(payload: Dict[str, Any]):
        started_events.append(payload)
        
    async def completed_cb(payload: Dict[str, Any]):
        completed_events.append(payload)
        
    async def failed_cb(payload: Dict[str, Any]):
        failed_events.append(payload)
        
    event_bus.subscribe("ToolStarted", started_cb)
    event_bus.subscribe("ToolCompleted", completed_cb)
    event_bus.subscribe("ToolFailed", failed_cb)
    
    try:
        # Call list_resources (should succeed and publish ToolStarted, ToolCompleted)
        await tools["list_resources"](workflow_id="wf-events-test", agent_id="telemetry_agent")
        
        assert len(started_events) == 1
        assert started_events[0]["tool_name"] == "list_resources"
        assert started_events[0]["workflow_id"] == "wf-events-test"
        
        assert len(completed_events) == 1
        assert completed_events[0]["tool_name"] == "list_resources"
        assert completed_events[0]["duration_ms"] >= 0
        
        # Trigger validation failure (should publish ToolStarted, ToolFailed)
        with pytest.raises(ToolValidationError):
            await tools["list_resources"](workflow_id="", agent_id="telemetry_agent")
            
        assert len(started_events) == 2
        assert len(failed_events) == 1
        assert failed_events[0]["tool_name"] == "list_resources"
        assert "ValidationError" in failed_events[0]["error"]
        
    finally:
        event_bus.unsubscribe("ToolStarted", started_cb)
        event_bus.unsubscribe("ToolCompleted", completed_cb)
        event_bus.unsubscribe("ToolFailed", failed_cb)
