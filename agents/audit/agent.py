from typing import Type, Tuple, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from agents.shared.base_agent import BaseAgent
from agents.shared.enums import MessageType
from agents.shared.message import AgentMessage
from agents.shared.context import AgentContext
from agents.shared.logger import AgentLogger

class AuditInputSchema(BaseModel):
    """Input parameters for audit agent."""
    action_id: str
    verification_status: bool

class AuditOutputSchema(BaseModel):
    """Output parameters for audit agent."""
    status: str
    audit_logged: bool
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    explanation: dict

class AuditAgent(BaseAgent):
    """Records the final action plan details, verification outcome, and logs the reasoning trace."""
    
    def __init__(self) -> None:
        super().__init__(
            agent_id="audit_agent",
            name="Audit Agent",
            role="Compliance Auditor and Logger"
        )
        self.logger = AgentLogger(self.name)

    @property
    def input_schema(self) -> Type[BaseModel]:
        return AuditInputSchema

    @property
    def output_schema(self) -> Type[BaseModel]:
        return AuditOutputSchema

    async def execute(self, message: AgentMessage, context: AgentContext) -> Tuple[AgentMessage, AgentContext]:
        self.logger.log_thought("Writing final compliance audit log for session logs.")
        
        input_data = self.input_schema(**message.payload)
        
        audit_record = {
            "action_id": input_data.action_id,
            "verification_status": "SUCCESS" if input_data.verification_status else "FAILURE",
            "audited_at": datetime.utcnow().isoformat() + "Z",
            "log": f"Remediation action '{input_data.action_id}' audited. Verification success: {input_data.verification_status}"
        }
        
        new_history = list(context.execution_history)
        new_history.append({"audit_trail": audit_record})
        updated_context = context.model_copy(update={"execution_history": new_history})

        upstream_conf = message.confidence_score if message.confidence_score is not None else 1.0
        local_conf = 1.0
        final_conf = upstream_conf * local_conf

        explanation = {
            "why": f"Action audit successfully compiled. Action ID: {input_data.action_id}.",
            "evidence": {"audit_record": audit_record},
            "confidence_score": final_conf,
            "assumptions": ["Log database is writeable and synced"],
            "next_agent": None
        }
        
        output_payload = {
            "status": "COMPLETED",
            "audit_logged": True,
            "confidence_score": final_conf,
            "explanation": explanation
        }
        
        self.logger.log_action("Audit entry logged", {"action_id": input_data.action_id})
        
        out_msg = AgentMessage(
            sender=self.agent_id,
            message_type=MessageType.AUDIT_RESPONSE,
            payload=output_payload,
            confidence_score=final_conf
        )
        
        return out_msg, updated_context
