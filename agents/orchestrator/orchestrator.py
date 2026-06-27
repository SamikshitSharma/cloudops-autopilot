import uuid
import time
from datetime import datetime
from typing import Dict, List, Any, Optional

from agents.shared.enums import MessageType, TraceStatus
from agents.shared.context import AgentContext
from agents.shared.message import AgentMessage
from agents.shared.trace import ReasoningTrace, AgentExplanation
from agents.shared.registry import AgentRegistry, global_registry

class AgentSession:
    """Manages the state, message history, and reasoning traces for an orchestrator run."""
    
    def __init__(self, session_id: str, context: AgentContext) -> None:
        self.session_id = session_id
        self.context = context
        self.traces: List[ReasoningTrace] = []
        self.message_history: List[AgentMessage] = []

class GoogleADKOrchestrator:
    """The main orchestrator for creating sessions, invoking agents, and routing messages.
    
    Decouples agent invocations and aggregates explainability/reasoning trace trees.
    """
    
    def __init__(self, registry: Optional[AgentRegistry] = None) -> None:
        self.registry = registry or global_registry
        self.sessions: Dict[str, AgentSession] = {}
        self.routing_table: Dict[MessageType, List[str]] = {}

    def create_session(self, initial_context: Optional[AgentContext] = None) -> AgentSession:
        """Creates and tracks a new execution session."""
        session_id = str(uuid.uuid4())
        context = initial_context or AgentContext()
        session = AgentSession(session_id, context)
        self.sessions[session_id] = session
        return session

    def register_route(self, message_type: MessageType, agent_id: str) -> None:
        """Configures routing rules for message types."""
        if message_type not in self.routing_table:
            self.routing_table[message_type] = []
        if agent_id not in self.routing_table[message_type]:
            self.routing_table[message_type].append(agent_id)

    async def invoke_agent(self, session_id: str, agent_id: str, message: AgentMessage) -> AgentMessage:
        """Invokes a single agent, tracks telemetry, and updates immutable context."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found.")

        agent = self.registry.lookup(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found.")

        # Step 1: Validate input message against schema
        if not agent.validate(message):
            raise ValueError(f"Input message payload does not match schema for agent '{agent_id}'")

        start_time = time.time()
        
        # Determine parent trace for hierarchical tracking
        parent_id = None
        if session.traces:
            parent_id = session.traces[-1].trace_id

        # Step 2: Create invocation trace
        init_trace = ReasoningTrace(
            parent_trace_id=parent_id,
            agent_id=agent_id,
            agent_name=agent.name,
            event_type="thought",
            description=f"Agent '{agent.name}' invoked with message type '{message.message_type}'",
            payload={"message_id": message.message_id},
            confidence_score=message.confidence_score if message.confidence_score is not None else 1.0,
            status=TraceStatus.SUCCESS
        )
        session.traces.append(init_trace)
        
        # Copy trace into history in immutable context
        current_reasoning = list(session.context.reasoning_history)
        current_reasoning.append(init_trace.to_dict())
        session.context = session.context.model_copy(update={"reasoning_history": current_reasoning})

        try:
            # Step 3: Execute Agent
            output_message, updated_context = await agent.execute(message, session.context)
            
            execution_time_ms = (time.time() - start_time) * 1000.0

            # Extract structured explanation from output payload if present
            explanation = None
            raw_explanation = output_message.payload.get("explanation")
            if raw_explanation:
                explanation = AgentExplanation(**raw_explanation)

            # Step 4: Create completion trace
            success_trace = ReasoningTrace(
                parent_trace_id=init_trace.trace_id,
                agent_id=agent_id,
                agent_name=agent.name,
                event_type="success",
                description=f"Agent '{agent.name}' execution completed successfully.",
                payload={"output_message_id": output_message.message_id},
                execution_time_ms=execution_time_ms,
                status=TraceStatus.SUCCESS,
                confidence_score=output_message.confidence_score if output_message.confidence_score is not None else 1.0,
                explanation=explanation
            )
            session.traces.append(success_trace)

            # Step 5: Update session context with execution results
            exec_record = {
                "agent_id": agent_id,
                "input_message_id": message.message_id,
                "output_message_id": output_message.message_id,
                "timestamp": output_message.timestamp.isoformat() + "Z",
                "execution_time_ms": execution_time_ms,
                "status": "SUCCESS"
            }
            
            new_exec_history = list(updated_context.execution_history)
            new_exec_history.append(exec_record)
            
            new_reasoning_history = list(updated_context.reasoning_history)
            new_reasoning_history.append(success_trace.to_dict())

            session.context = updated_context.model_copy(update={
                "execution_history": new_exec_history,
                "reasoning_history": new_reasoning_history
            })

            # Record message history
            session.message_history.append(message)
            session.message_history.append(output_message)

            return output_message

        except Exception as e:
            execution_time_ms = (time.time() - start_time) * 1000.0
            
            # Record execution failure trace
            failure_trace = ReasoningTrace(
                parent_trace_id=init_trace.trace_id,
                agent_id=agent_id,
                agent_name=agent.name,
                event_type="error",
                description=f"Agent '{agent.name}' failed: {str(e)}",
                payload={"error": str(e)},
                execution_time_ms=execution_time_ms,
                status=TraceStatus.FAILURE,
                confidence_score=0.0
            )
            session.traces.append(failure_trace)

            new_exec_history = list(session.context.execution_history)
            new_exec_history.append({
                "agent_id": agent_id,
                "input_message_id": message.message_id,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "execution_time_ms": execution_time_ms,
                "status": "FAILURE",
                "error": str(e)
            })

            new_reasoning_history = list(session.context.reasoning_history)
            new_reasoning_history.append(failure_trace.to_dict())

            session.context = session.context.model_copy(update={
                "execution_history": new_exec_history,
                "reasoning_history": new_reasoning_history
            })
            raise e

    async def route_message(self, session_id: str, message: AgentMessage) -> List[AgentMessage]:
        """Routes message dynamically to matching registered subscriber agents."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found.")

        agent_ids = self.routing_table.get(message.message_type, [])
        outputs = []
        for agent_id in agent_ids:
            output = await self.invoke_agent(session_id, agent_id, message)
            outputs.append(output)
        return outputs

    def get_session_context(self, session_id: str) -> AgentContext:
        """Retrieves the context associated with a session."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found.")
        return session.context

    def get_session_traces(self, session_id: str) -> List[ReasoningTrace]:
        """Retrieves the reasoning traces collected in a session."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found.")
        return session.traces
