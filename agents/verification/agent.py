from typing import Type, Tuple, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from agents.shared.base_agent import BaseAgent
from agents.shared.enums import MessageType
from agents.shared.message import AgentMessage
from agents.shared.context import AgentContext
from agents.shared.logger import AgentLogger

class VerificationInputSchema(BaseModel):
    """Input parameters for verification agent."""
    resource_id: str
    expected_state: str

class VerificationOutputSchema(BaseModel):
    """Output parameters for verification agent."""
    status: str
    verified: bool
    actual_state: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    explanation: dict

class VerificationAgent(BaseAgent):
    """Confirms the resource state after optimization execution has run."""
    
    def __init__(self) -> None:
        super().__init__(
            agent_id="verification_agent",
            name="Verification Agent",
            role="Post-Execution State Verifier"
        )
        self.logger = AgentLogger(self.name)

    @property
    def input_schema(self) -> Type[BaseModel]:
        return VerificationInputSchema

    @property
    def output_schema(self) -> Type[BaseModel]:
        return VerificationOutputSchema

    async def execute(self, message: AgentMessage, context: AgentContext) -> Tuple[AgentMessage, AgentContext]:
        self.logger.log_thought("Validating post-remediation resource configuration status.")
        
        input_data = self.input_schema(**message.payload)
        scenario_name = context.telemetry.get("scenario_name", "idle_vm")

        # Failure Simulation: Verification Failure
        if scenario_name == "verification_failure":
            self.logger.log_error(f"Verification Failure: Resource '{input_data.resource_id}' failed to transition to state '{input_data.expected_state}'.")
            raise ValueError("Verification Failure: Target resource failed to reach expected state.")
        
        verified = True
        actual_state = input_data.expected_state
        
        verification_record = {
            "resource_id": input_data.resource_id,
            "expected_state": input_data.expected_state,
            "actual_state": actual_state,
            "verified": verified,
            "verified_at": datetime.utcnow().isoformat() + "Z"
        }
        
        new_history = list(context.execution_history)
        new_history.append(verification_record)
        updated_context = context.model_copy(update={"execution_history": new_history})

        # Confidence Propagation
        upstream_conf = message.confidence_score if message.confidence_score is not None else 1.0
        local_conf = 0.99
        final_conf = upstream_conf * local_conf

        explanation = {
            "why": f"Successfully verified that resource '{input_data.resource_id}' state matches the expected '{input_data.expected_state}'.",
            "evidence": {"resource_id": input_data.resource_id, "verified": verified, "actual_state": actual_state},
            "confidence_score": final_conf,
            "assumptions": ["Cloud API inventory reflects actual resource state"],
            "next_agent": "audit_agent"
        }
        
        output_payload = {
            "status": "COMPLETED",
            "verified": verified,
            "actual_state": actual_state,
            "confidence_score": final_conf,
            "explanation": explanation
        }
        
        self.logger.log_verification(input_data.resource_id, verified, f"Verified matches expected state: {actual_state}")
        
        out_msg = AgentMessage(
            sender=self.agent_id,
            message_type=MessageType.VERIFICATION_RESPONSE,
            payload=output_payload,
            confidence_score=final_conf
        )
        
        return out_msg, updated_context
