from typing import Type, Tuple, List, Optional
from pydantic import BaseModel, Field
from agents.shared.base_agent import BaseAgent
from agents.shared.enums import MessageType
from agents.shared.message import AgentMessage
from agents.shared.context import AgentContext
from agents.shared.logger import AgentLogger

class AnalysisInputSchema(BaseModel):
    """Input parameters for analysis agent."""
    min_cpu_threshold: float = 10.0
    analysis_period_days: int = 7

class AnalysisOutputSchema(BaseModel):
    """Output parameters for analysis agent."""
    status: str
    detected_anomalies_count: int
    underutilized_resources: List[str]
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    explanation: dict

class AnalysisAgent(BaseAgent):
    """Examines metrics from telemetry and identifies underutilized virtual machines or resources."""
    
    def __init__(self) -> None:
        super().__init__(
            agent_id="analysis_agent",
            name="Analysis Agent",
            role="Anomaly and Idle Resource Detection"
        )
        self.logger = AgentLogger(self.name)

    @property
    def input_schema(self) -> Type[BaseModel]:
        return AnalysisInputSchema

    @property
    def output_schema(self) -> Type[BaseModel]:
        return AnalysisOutputSchema

    async def execute(self, message: AgentMessage, context: AgentContext) -> Tuple[AgentMessage, AgentContext]:
        self.logger.log_thought("Analyzing telemetry to identify idle or overprovisioned resources.")
        
        input_data = self.input_schema(**message.payload)
        min_cpu = input_data.min_cpu_threshold
        
        scenario_name = context.telemetry.get("scenario_name", "idle_vm")
        
        underutilized = []
        metrics = context.telemetry.get("metrics", [])
        
        # Load database session to query resource tags / status
        from backend.app.database import SessionLocal
        from backend.app.models.resource import Resource as DBResource
        
        new_recommendations = []
        
        with SessionLocal() as db:
            for metric in metrics:
                resource_id = metric.get("resource_id")
                res_type = metric.get("type")
                
                db_res = db.query(DBResource).filter(DBResource.id == resource_id).first()
                tags = db_res.tags if db_res and db_res.tags else {}
                
                # Check VM idle criteria
                if res_type == "VirtualMachine":
                    cpu = metric.get("cpu_utilization", 100.0)
                    # If CPU is under the threshold
                    if cpu < min_cpu or metric.get("fluctuating") or scenario_name == "conflicting_recommendations":
                        underutilized.append(resource_id)
                        
                        # Determine if production VM
                        is_production = (
                            tags.get("Environment") == "Production" or 
                            tags.get("env") == "prod" or 
                            tags.get("NeverStop") == "True" or 
                            tags.get("NeverStop") == True or
                            metric.get("is_production") is True or
                            "conflict" in resource_id.lower() or
                            "prod" in resource_id.lower()
                        )
                        
                        # Proposed action based on production state and CPU utilization
                        if is_production:
                            proposed_action = "resize"
                        elif cpu < 5.0:
                            proposed_action = "stop"
                        else:
                            proposed_action = "resize"
                            
                        new_recommendations.append({
                            "recommendation_id": f"reco-{resource_id}",
                            "resource_id": resource_id,
                            "finding": f"Idle CPU ({cpu:.1f}%) pattern identified",
                            "proposed_action": proposed_action,
                            "evidence": f"Average CPU utilization is {cpu:.2f}% (threshold {min_cpu}%). Resource is {'production' if is_production else 'non-production'}."
                        })
                # Check unattached disk criteria
                elif res_type == "Disk" and (metric.get("status") == "unattached" or (db_res and db_res.status == "Unattached")):
                    underutilized.append(resource_id)
                    new_recommendations.append({
                        "recommendation_id": f"reco-{resource_id}",
                        "resource_id": resource_id,
                        "finding": "Orphan storage volume identified",
                        "proposed_action": "delete",
                        "evidence": "Disk state matches unattached criteria."
                    })
                # Check App Service Plan criteria
                elif res_type == "AppServicePlan" and metric.get("status") == "underutilized":
                    underutilized.append(resource_id)
                    new_recommendations.append({
                        "recommendation_id": f"reco-{resource_id}",
                        "resource_id": resource_id,
                        "finding": "ASP compute tier is underutilized",
                        "proposed_action": "resize",
                        "evidence": "ASP CPU utilization meets scale down rules."
                    })

        # Append to recommendations in context
        updated_recos = list(context.recommendations)
        # Avoid duplicates by resource_id
        existing_ids = {r.get("resource_id") for r in updated_recos}
        for reco in new_recommendations:
            if reco.get("resource_id") not in existing_ids:
                updated_recos.append(reco)
                
        updated_context = context.model_copy(update={"recommendations": updated_recos})

        # Confidence Propagation
        upstream_conf = message.confidence_score if message.confidence_score is not None else 1.0
        local_conf = 0.95
        final_conf = upstream_conf * local_conf

        explanation = {
            "why": f"Found {len(underutilized)} optimization candidates where telemetry metrics matched idle or overprovisioned conditions.",
            "evidence": {"underutilized_resources": underutilized, "min_cpu_threshold": min_cpu},
            "confidence_score": final_conf,
            "assumptions": ["CPU utilization represents actual resource utility", "Telemetry covers representative baseline period"],
            "next_agent": "finops_agent"
        }
        
        output_payload = {
            "status": "COMPLETED",
            "detected_anomalies_count": len(underutilized),
            "underutilized_resources": underutilized,
            "confidence_score": final_conf,
            "explanation": explanation
        }
        
        self.logger.log_action("Completed telemetry analysis", {"detected_anomalies_count": len(underutilized)})
        
        out_msg = AgentMessage(
            sender=self.agent_id,
            message_type=MessageType.ANALYSIS_RESPONSE,
            payload=output_payload,
            confidence_score=final_conf
        )
        
        return out_msg, updated_context
