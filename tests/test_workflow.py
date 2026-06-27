import pytest
import asyncio
from typing import Dict, Any
from backend.app.events.event_bus import EventBus
from backend.app.workflow.models import ActionPlan, ApprovalRequest, WorkflowStatus, StepStatus
from backend.app.workflow.queue import ExecutionQueue
from backend.app.workflow.policy import RetryPolicy
from backend.app.workflow.coordinator import WorkflowCoordinator

# --- EVENT BUS TESTS ---

@pytest.mark.asyncio
async def test_event_bus_pub_sub():
    bus = EventBus()
    events_received = []

    async def test_handler(payload: Dict[str, Any]) -> None:
        events_received.append(payload)

    bus.subscribe("TelemetryCollected", test_handler)
    
    # Publish event
    await bus.publish("TelemetryCollected", {"resource_id": "vm-01", "cpu": 1.5})
    
    assert len(events_received) == 1
    assert events_received[0]["resource_id"] == "vm-01"
    assert events_received[0]["cpu"] == 1.5
    assert "timestamp" in events_received[0]

@pytest.mark.asyncio
async def test_event_bus_unsubscribe():
    bus = EventBus()
    events_received = []

    async def test_handler(payload: Dict[str, Any]) -> None:
        events_received.append(payload)

    bus.subscribe("AnalysisCompleted", test_handler)
    await bus.publish("AnalysisCompleted", {"data": 1})
    assert len(events_received) == 1

    bus.unsubscribe("AnalysisCompleted", test_handler)
    await bus.publish("AnalysisCompleted", {"data": 2})
    # Count should still be 1 after unsubscribe
    assert len(events_received) == 1

# --- EXECUTION QUEUE TESTS ---

@pytest.mark.asyncio
async def test_execution_queue_operations():
    queue = ExecutionQueue()
    assert await queue.size() == 0
    assert await queue.pop() is None

    action1 = ActionPlan(
        id="act-01",
        recommendation_id="reco-01",
        action_type="stop",
        resource_id="vm-01",
        risk_level="low",
        approval_required=False
    )
    action2 = ActionPlan(
        id="act-02",
        recommendation_id="reco-02",
        action_type="delete",
        resource_id="disk-01",
        risk_level="high",
        approval_required=True
    )

    await queue.push(action1)
    await queue.push(action2)
    
    assert await queue.size() == 2
    assert (await queue.peek()).id == "act-01"
    
    # Pop first item
    popped = await queue.pop()
    assert popped.id == "act-01"
    assert await queue.size() == 1
    
    # Peek next
    assert (await queue.peek()).id == "act-02"
    
    # Clear
    await queue.clear()
    assert await queue.size() == 0
    assert await queue.pop() is None

# --- RETRY POLICY TESTS ---

def test_retry_policy_logic():
    policy = RetryPolicy(max_retries=3, initial_delay_seconds=1.0, backoff_factor=2.0)
    
    # First and second attempts should be retryable
    assert policy.should_retry(attempt_count=0) is True
    assert policy.should_retry(attempt_count=1) is True
    assert policy.should_retry(attempt_count=2) is True
    
    # Exceeded attempt count should not be retryable
    assert policy.should_retry(attempt_count=3) is False

    # Delay calculations: initial_delay * (backoff_factor ** attempt)
    assert policy.calculate_delay(attempt_count=0) == 1.0  # 1.0 * (2.0 ** 0)
    assert policy.calculate_delay(attempt_count=1) == 2.0  # 1.0 * (2.0 ** 1)
    assert policy.calculate_delay(attempt_count=2) == 4.0  # 1.0 * (2.0 ** 2)

def test_retry_policy_with_error_filters():
    policy = RetryPolicy(
        max_retries=2,
        retryable_errors=["throttled", "timeout"]
    )
    
    assert policy.should_retry(0, "Request was throttled by Azure API") is True
    assert policy.should_retry(0, "Connection timeout encountered") is True
    assert policy.should_retry(0, "Authentication error: Invalid credentials") is False

# --- WORKFLOW COORDINATOR TESTS ---

@pytest.mark.asyncio
async def test_coordinator_workflow_lifecycle():
    bus = EventBus()
    coordinator = WorkflowCoordinator(bus=bus)
    
    steps = ["telemetry_collection", "cost_analysis", "execution"]
    wf_run = await coordinator.create_workflow(run_id="job-100", step_ids=steps)
    
    assert wf_run.id == "wf-run-job-100"
    assert wf_run.status == WorkflowStatus.PENDING
    assert len(wf_run.steps) == 3
    assert wf_run.steps[0].id == "telemetry_collection"
    assert wf_run.steps[0].status == StepStatus.PENDING
    assert wf_run.steps[0].name == "Telemetry Collection"

    # Track start
    await coordinator.start_workflow(wf_run.id)
    assert wf_run.status == WorkflowStatus.RUNNING

    # Step transitions
    await coordinator.start_step(wf_run.id, "telemetry_collection")
    assert wf_run.steps[0].status == StepStatus.RUNNING
    assert wf_run.steps[0].started_at is not None

    await coordinator.complete_step(wf_run.id, "telemetry_collection")
    assert wf_run.steps[0].status == StepStatus.COMPLETED
    assert wf_run.steps[0].completed_at is not None

    # Step Failure and Retry evaluation
    policy = RetryPolicy(max_retries=2)
    
    # Fail step first time (should schedule retry)
    retry_allowed = await coordinator.fail_step(
        run_id=wf_run.id,
        step_id="cost_analysis",
        error_message="Advisor API offline",
        retry_policy=policy
    )
    assert retry_allowed is True
    assert wf_run.steps[1].status == StepStatus.PENDING
    assert wf_run.steps[1].retries_attempted == 1
    assert wf_run.status == WorkflowStatus.RUNNING # Workflow is still active
    
    # Fail step second time (should schedule retry #2)
    retry_allowed = await coordinator.fail_step(
        run_id=wf_run.id,
        step_id="cost_analysis",
        error_message="Advisor API offline",
        retry_policy=policy
    )
    assert retry_allowed is True
    assert wf_run.steps[1].retries_attempted == 2
    assert wf_run.status == WorkflowStatus.RUNNING

    # Fail step third time (exceeds max_retries = 2)
    retry_allowed = await coordinator.fail_step(
        run_id=wf_run.id,
        step_id="cost_analysis",
        error_message="Advisor API offline",
        retry_policy=policy
    )
    assert retry_allowed is False
    assert wf_run.steps[1].status == StepStatus.FAILED
    assert wf_run.status == WorkflowStatus.FAILED

@pytest.mark.asyncio
async def test_coordinator_approval_blocking():
    bus = EventBus()
    coordinator = WorkflowCoordinator(bus=bus)
    wf_run = await coordinator.create_workflow(run_id="job-200", step_ids=["execution"])
    
    await coordinator.start_workflow(wf_run.id)
    
    app_req = ApprovalRequest(
        id="app-99",
        recommendation_id="reco-99",
        resource_id="vm-dev",
        action_type="delete"
    )
    
    await coordinator.block_on_approval(wf_run.id, app_req)
    
    assert wf_run.status == WorkflowStatus.BLOCKED_ON_APPROVAL
    assert wf_run.approval_request.id == "app-99"
    assert wf_run.approval_request.status == "pending"

    # Grant approval
    await coordinator.grant_approval(wf_run.id, token="token-xyz-123")
    
    assert wf_run.status == WorkflowStatus.RUNNING
    assert wf_run.approval_request.status == "approved"
    assert wf_run.approval_request.token == "token-xyz-123"
