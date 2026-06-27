from typing import Type, Tuple, List, Optional
from pydantic import BaseModel, Field
from agents.shared.base_agent import BaseAgent
from agents.shared.enums import MessageType
from agents.shared.message import AgentMessage
from agents.shared.context import AgentContext
from agents.shared.logger import AgentLogger

class PolicyInputSchema(BaseModel):
    """Input parameters for policy agent."""
    resources_to_remediate: List[str]
    strict_mode: bool = True

class PolicyOutputSchema(BaseModel):
    """Output parameters for policy agent."""
    status: str
    compliant: bool
    requires_approval: bool
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    explanation: dict

class PolicyAgent(BaseAgent):
    """Evaluates proposed actions against organizational rules to determine compliance and approvals."""
    
    def __init__(self) -> None:
        super().__init__(
            agent_id="policy_agent",
            name="Policy Agent",
            role="Governance and Compliance Checks"
        )
        self.logger = AgentLogger(self.name)

    @property
    def input_schema(self) -> Type[BaseModel]:
        return PolicyInputSchema

    @property
    def output_schema(self) -> Type[BaseModel]:
        return PolicyOutputSchema

    async def execute(self, message: AgentMessage, context: AgentContext) -> Tuple[AgentMessage, AgentContext]:
        self.logger.log_thought("Evaluating remediation compliance against governance policies.")
        
        input_data = self.input_schema(**message.payload)
        resources = input_data.resources_to_remediate
        scenario_name = context.telemetry.get("scenario_name", "idle_vm")
        
        # Load database session to query resource tags
        from backend.app.database import SessionLocal
        from backend.app.models.resource import Resource as DBResource
        
        policies_checked = []
        requires_approval = False
        compliant = True

        with SessionLocal() as db:
            for r_id in resources:
                db_res = db.query(DBResource).filter(DBResource.id == r_id).first()
                tags = db_res.tags if db_res and db_res.tags else {}
                
                # Retrieve the proposed action from the recommendations list in context
                proposed_action = "stop"
                for reco in context.recommendations:
                    if reco.get("resource_id") == r_id:
                        proposed_action = reco.get("proposed_action", "stop")
                        break
                
                never_stop_tagged = (
                    tags.get("NeverStop") == "True" or 
                    tags.get("NeverStop") == True or 
                    tags.get("policy") == "no-stop" or
                    "strict" in r_id.lower()
                )
                
                if never_stop_tagged and proposed_action == "stop":
                    compliant = False
                    self.logger.log_warning(f"Policy rule violated: {r_id} is marked as NeverStop, but a stop action was proposed.")
                    policies_checked.append({
                        "resource_id": r_id,
                        "policy_name": "NeverStopProtected",
                        "compliant": False,
                        "requires_approval": False,
                        "reason": "Policy rejects stopping resources flagged with NeverStop"
                    })
                else:
                    # Determine if manual approval is required
                    # Rule 1: Disk deletion always requires manual approval
                    is_disk = "disk" in r_id.lower() or (db_res and "disks" in db_res.type.lower())
                    needs_approval = (is_disk and proposed_action == "delete")
                    
                    # Rule 2: Production or staging resources always require approval for stopping or resizing
                    is_production = (
                        tags.get("Environment") == "Production" or 
                        tags.get("env") == "prod" or 
                        tags.get("env") == "staging" or
                        never_stop_tagged or
                        "conflict" in r_id.lower() or
                        "prod" in r_id.lower()
                    )
                    
                    if is_production:
                        needs_approval = True
                    
                    if needs_approval:
                        requires_approval = True
                    
                    policies_checked.append({
                        "resource_id": r_id,
                        "policy_name": "GovernanceApprovalGate",
                        "compliant": True,
                        "requires_approval": needs_approval,
                        "reason": f"Remediation requires approval due to {'production status' if is_production else 'destructive action'}"
                    })

        # Append checked policies to context
        updated_policies = list(context.policies)
        updated_policies.extend(policies_checked)
        updated_context = context.model_copy(update={"policies": updated_policies})

        # Confidence Propagation
        upstream_conf = message.confidence_score if message.confidence_score is not None else 1.0
        local_conf = 0.98
        final_conf = upstream_conf * local_conf

        explanation = {
            "why": f"Policy check completed. Compliant: {compliant}. Requires Approval: {requires_approval}.",
            "evidence": {"policies_checked": policies_checked},
            "confidence_score": final_conf,
            "assumptions": ["Governance policy list is up-to-date", "Metadata flags (is_production) are correct"],
            "next_agent": "decision_agent"
        }
        
        output_payload = {
            "status": "COMPLETED" if compliant else "FAILED",
            "compliant": compliant,
            "requires_approval": requires_approval,
            "confidence_score": final_conf,
            "explanation": explanation
        }
        
        self.logger.log_action("Completed policy assessment", {"compliant": compliant, "requires_approval": requires_approval})
        
        out_msg = AgentMessage(
            sender=self.agent_id,
            message_type=MessageType.POLICY_RESPONSE,
            payload=output_payload,
            confidence_score=final_conf
        )
        
        return out_msg, updated_context
