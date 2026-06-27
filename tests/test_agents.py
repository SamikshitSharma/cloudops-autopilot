import pytest
from datetime import datetime
from agents import (
    GoogleADKOrchestrator,
    TelemetryAgent,
    AnalysisAgent,
    FinOpsAgent,
    PolicyAgent,
    DecisionAgent,
    ExecutionAgent,
    VerificationAgent,
    AuditAgent
)
from agents.shared import (
    global_registry,
    AgentRegistry,
    AgentContext,
    AgentMessage,
    MessageType,
    TraceStatus
)

@pytest.mark.asyncio
async def test_agent_registration():
    """Verify registry supports registration, lookups, unregistration, and listing."""
    registry = AgentRegistry()
    agent = TelemetryAgent()
    
    registry.register(agent)
    assert registry.lookup(agent.agent_id) == agent
    assert agent in registry.list_agents()
    
    registry.unregister(agent.agent_id)
    assert registry.lookup(agent.agent_id) is None

@pytest.mark.asyncio
async def test_message_validation():
    """Verify schema-based message validation works for payloads."""
    agent = TelemetryAgent()
    
    # Valid payload matching TelemetryInputSchema
    valid_msg = AgentMessage(
        sender="test",
        message_type=MessageType.TELEMETRY_REQUEST,
        payload={"resource_group": "production-rg", "collect_metrics": True}
    )
    assert agent.validate(valid_msg) is True
    
    # Invalid payload (missing required field 'resource_group')
    invalid_msg = AgentMessage(
        sender="test",
        message_type=MessageType.TELEMETRY_REQUEST,
        payload={"collect_metrics": True}
    )
    assert agent.validate(invalid_msg) is False

@pytest.mark.asyncio
async def test_orchestrator_lifecycle():
    """Verify orchestrator correctly creates sessions, manages context, collects traces, and enforces schemas."""
    t_agent = TelemetryAgent()
    orchestrator = GoogleADKOrchestrator()
    session = orchestrator.create_session()
    
    assert session.session_id is not None
    assert session.context.telemetry == {}
    
    msg = AgentMessage(
        sender="client",
        message_type=MessageType.TELEMETRY_REQUEST,
        payload={"resource_group": "production-rg", "collect_metrics": True}
    )
    
    resp = await orchestrator.invoke_agent(session.session_id, t_agent.agent_id, msg)
    assert resp.payload["status"] == "COMPLETED"
    assert resp.payload["metrics_count"] == 3
    
    # Verify trace collection
    traces = orchestrator.get_session_traces(session.session_id)
    assert len(traces) == 2
    assert traces[0].event_type == "thought"
    assert traces[1].event_type == "success"
    assert traces[1].status == TraceStatus.SUCCESS
    assert traces[1].execution_time_ms >= 0.0
    assert traces[1].confidence_score == 1.0
    
    # Verify context updating (propagation)
    ctx = orchestrator.get_session_context(session.session_id)
    assert ctx.telemetry["resource_group"] == "production-rg"

@pytest.mark.asyncio
async def test_orchestrator_routing():
    """Verify orchestrator decouples agents by routing messages through the routing table."""
    t_agent = TelemetryAgent()
    orchestrator = GoogleADKOrchestrator()
    session = orchestrator.create_session()
    
    orchestrator.register_route(MessageType.TELEMETRY_REQUEST, t_agent.agent_id)
    
    msg = AgentMessage(
        sender="client",
        message_type=MessageType.TELEMETRY_REQUEST,
        payload={"resource_group": "routing-rg", "collect_metrics": False}
    )
    
    responses = await orchestrator.route_message(session.session_id, msg)
    assert len(responses) == 1
    assert responses[0].sender == t_agent.agent_id

@pytest.mark.asyncio
async def test_reasoning_chain():
    """Execute a complete end-to-end multi-agent scenario verifying context flow and explainability."""
    t_agent = TelemetryAgent()
    a_agent = AnalysisAgent()
    f_agent = FinOpsAgent()
    p_agent = PolicyAgent()
    d_agent = DecisionAgent()
    e_agent = ExecutionAgent()
    v_agent = VerificationAgent()
    ad_agent = AuditAgent()
    
    orchestrator = GoogleADKOrchestrator()
    session = orchestrator.create_session()
    
    # 1. Collect Telemetry
    t_msg = AgentMessage(
        sender="orchestrator",
        message_type=MessageType.TELEMETRY_REQUEST,
        payload={"resource_group": "autopilot-rg"}
    )
    t_resp = await orchestrator.invoke_agent(session.session_id, t_agent.agent_id, t_msg)
    assert t_resp.payload["status"] == "COMPLETED"
    
    # 2. Analyze Telemetry (identify VM with CPU under 10% or unattached disks)
    a_msg = AgentMessage(
        sender="orchestrator",
        message_type=MessageType.ANALYSIS_REQUEST,
        payload={"min_cpu_threshold": 10.0, "analysis_period_days": 7}
    )
    a_resp = await orchestrator.invoke_agent(session.session_id, a_agent.agent_id, a_msg)
    assert a_resp.payload["detected_anomalies_count"] == 2
    assert "vm-01" in a_resp.payload["underutilized_resources"]
    assert "disk-01" in a_resp.payload["underutilized_resources"]
    
    # 3. FinOps Savings Estimation
    f_msg = AgentMessage(
        sender="orchestrator",
        message_type=MessageType.FINOPS_REQUEST,
        payload={"underutilized_resources": a_resp.payload["underutilized_resources"], "currency": "USD"}
    )
    f_resp = await orchestrator.invoke_agent(session.session_id, f_agent.agent_id, f_msg)
    assert f_resp.payload["total_potential_savings"] == 89.28
    
    # 4. Check Governance Policy
    p_msg = AgentMessage(
        sender="orchestrator",
        message_type=MessageType.POLICY_REQUEST,
        payload={"resources_to_remediate": a_resp.payload["underutilized_resources"]}
    )
    p_resp = await orchestrator.invoke_agent(session.session_id, p_agent.agent_id, p_msg)
    assert p_resp.payload["requires_approval"] is True # disk-01 is a disk, so requires approval
    
    # 5. Evaluate Decision on VM (no approval required)
    d_msg = AgentMessage(
        sender="orchestrator",
        message_type=MessageType.DECISION_REQUEST,
        payload={
            "resource_id": "vm-01",
            "action_type": "stop",
            "risk_level": "low",
            "requires_approval": False
        }
    )
    d_resp = await orchestrator.invoke_agent(session.session_id, d_agent.agent_id, d_msg)
    assert d_resp.payload["approved"] is True
    
    # 6. Execute Plan Creation
    e_msg = AgentMessage(
        sender="orchestrator",
        message_type=MessageType.EXECUTION_REQUEST,
        payload={
            "action_id": "act-xyz-789",
            "resource_id": "vm-01",
            "action_type": "stop",
            "approved": d_resp.payload["approved"]
        }
    )
    e_resp = await orchestrator.invoke_agent(session.session_id, e_agent.agent_id, e_msg)
    assert e_resp.payload["execution_plan_created"] is True
    
    # 7. Verification of Resource State
    v_msg = AgentMessage(
        sender="orchestrator",
        message_type=MessageType.VERIFICATION_REQUEST,
        payload={"resource_id": "vm-01", "expected_state": "stopped"}
    )
    v_resp = await orchestrator.invoke_agent(session.session_id, v_agent.agent_id, v_msg)
    assert v_resp.payload["verified"] is True
    
    # 8. Post-Execution Audit Logging
    ad_msg = AgentMessage(
        sender="orchestrator",
        message_type=MessageType.AUDIT_REQUEST,
        payload={"action_id": "act-xyz-789", "verification_status": v_resp.payload["verified"]}
    )
    ad_resp = await orchestrator.invoke_agent(session.session_id, ad_agent.agent_id, ad_msg)
    assert ad_resp.payload["audit_logged"] is True

    # 9. Verify Context State & Immutability Integration
    final_ctx = orchestrator.get_session_context(session.session_id)
    
    assert final_ctx.telemetry["resource_group"] == "autopilot-rg"
    assert len(final_ctx.recommendations) == 2
    assert final_ctx.cost_estimates["total_savings"] == 89.28
    assert len(final_ctx.policies) == 2
    assert final_ctx.approval_status["approved"] is True
    
    # Confirm trace explainability metrics
    traces = orchestrator.get_session_traces(session.session_id)
    assert len(traces) == 16  # 8 agents * 2 traces each (thought, success)
    for trace in traces:
        assert trace.confidence_score >= 0.0
        assert trace.confidence_score <= 1.0
        assert trace.status in [TraceStatus.SUCCESS, TraceStatus.FAILURE, TraceStatus.SKIPPED]
        assert trace.execution_time_ms >= 0.0
