from typing import Type, Tuple, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from agents.shared.base_agent import BaseAgent
from agents.shared.enums import MessageType
from agents.shared.message import AgentMessage
from agents.shared.context import AgentContext
from agents.shared.logger import AgentLogger

class ExecutionInputSchema(BaseModel):
    """Input parameters for execution agent."""
    action_id: str
    resource_id: str
    action_type: str
    approved: bool

class ExecutionOutputSchema(BaseModel):
    """Output parameters for execution agent."""
    status: str
    execution_plan_created: bool
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    explanation: dict

class ExecutionAgent(BaseAgent):
    """Prepares and tracks execution plans for approved cloud remediation actions."""
    
    def __init__(self) -> None:
        super().__init__(
            agent_id="execution_agent",
            name="Execution Agent",
            role="Action Planner and Skeleton Executor"
        )
        self.logger = AgentLogger(self.name)

    @property
    def input_schema(self) -> Type[BaseModel]:
        return ExecutionInputSchema

    @property
    def output_schema(self) -> Type[BaseModel]:
        return ExecutionOutputSchema

    async def execute(self, message: AgentMessage, context: AgentContext) -> Tuple[AgentMessage, AgentContext]:
        self.logger.log_thought("Preparing execution scheduling logs for approved plan.")
        
        input_data = self.input_schema(**message.payload)
        
        execution_plan_created = False
        execution_records = []
        
        if input_data.approved:
            execution_plan_created = True
            record = {
                "action_id": input_data.action_id,
                "resource_id": input_data.resource_id,
                "action_type": input_data.action_type,
                "status": "EXECUTED",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            execution_records.append(record)
        else:
            record = {
                "action_id": input_data.action_id,
                "resource_id": input_data.resource_id,
                "action_type": input_data.action_type,
                "status": "BLOCKED_ON_APPROVAL",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            execution_records.append(record)

        new_history = list(context.execution_history)
        new_history.extend(execution_records)
        updated_context = context.model_copy(update={"execution_history": new_history})

        upstream_conf = message.confidence_score if message.confidence_score is not None else 1.0
        local_conf = 1.0
        final_conf = upstream_conf * local_conf

        explanation = {
            "why": f"Action plan execution registered. Execution plan created: {execution_plan_created}.",
            "evidence": {"action_id": input_data.action_id, "approved": input_data.approved},
            "confidence_score": final_conf,
            "assumptions": ["Execution subsystem is active and connected"],
            "next_agent": "verification_agent"
        }
        
        output_payload = {
            "status": "COMPLETED" if execution_plan_created else "BLOCKED",
            "execution_plan_created": execution_plan_created,
            "confidence_score": final_conf,
            "explanation": explanation
        }
        
        self.logger.log_action("Execution plan generated", {"status": output_payload["status"]})
        
        out_msg = AgentMessage(
            sender=self.agent_id,
            message_type=MessageType.EXECUTION_RESPONSE,
            payload=output_payload,
            confidence_score=final_conf
        )
        
        return out_msg, updated_context
