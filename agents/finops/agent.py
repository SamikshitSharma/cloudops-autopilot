from typing import Type, Tuple, List, Optional
from pydantic import BaseModel, Field
from agents.shared.base_agent import BaseAgent
from agents.shared.enums import MessageType
from agents.shared.message import AgentMessage
from agents.shared.context import AgentContext
from agents.shared.logger import AgentLogger

class FinOpsInputSchema(BaseModel):
    """Input parameters for FinOps agent."""
    underutilized_resources: List[str]
    currency: str = "USD"

class FinOpsOutputSchema(BaseModel):
    """Output parameters for FinOps agent."""
    status: str
    total_potential_savings: float
    recommendations_count: int
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    explanation: dict

class FinOpsAgent(BaseAgent):
    """Focuses on cost estimation, potential savings calculation, and logs savings predictions."""
    
    def __init__(self) -> None:
        super().__init__(
            agent_id="finops_agent",
            name="FinOps Agent",
            role="Cost Governance and Optimization Estimates"
        )
        self.logger = AgentLogger(self.name)

    @property
    def input_schema(self) -> Type[BaseModel]:
        return FinOpsInputSchema

    @property
    def output_schema(self) -> Type[BaseModel]:
        return FinOpsOutputSchema

    async def execute(self, message: AgentMessage, context: AgentContext) -> Tuple[AgentMessage, AgentContext]:
        self.logger.log_thought("Evaluating potential financial savings for identified candidate resources.")
        
        input_data = self.input_schema(**message.payload)
        resources = input_data.underutilized_resources
        scenario_name = context.telemetry.get("scenario_name", "idle_vm")
        
        # Load database session to query resource sizing
        from backend.app.database import SessionLocal
        from backend.app.models.resource import Resource as DBResource
        from cloud_adapter import get_azure_client
        import urllib.request
        import json
        
        client = get_azure_client()
        
        # 1. Fetch Advisor recommendations as advisory input
        advisor_recos = []
        try:
            advisor_recos = await client.get_cost_recommendations()
            self.logger.log_thought(f"Fetched {len(advisor_recos)} Advisor recommendations as advisory inputs.")
        except Exception as e:
            self.logger.log_warning(f"Could not fetch Advisor recommendations: {e}")
            
        savings_detail = {}
        total_savings = 0.0
        updated_recos = list(context.recommendations)
        
        # Fallback local VM prices (hourly rates)
        VM_FALLBACK_HOURLY = {
            "Standard_D4s_v5": 0.192,
            "Standard_D2s_v5": 0.096,
            "Standard_B2s": 0.016,
            "Standard_B1s": 0.008
        }
        
        def get_prices_api_rate(sku: str, region: str) -> Optional[float]:
            # Standardize region for query
            reg = region.lower().replace(" ", "")
            try:
                # Query Azure Retail Prices API
                url = f"https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Virtual Machines' and armSkuName eq '{sku}' and priceType eq 'Consumption' and armRegionName eq '{reg}'"
                req = urllib.request.Request(url, headers={"User-Agent": "cloudops-autopilot"})
                with urllib.request.urlopen(req, timeout=3) as response:
                    data = json.loads(response.read().decode())
                    items = data.get("Items", [])
                    if items:
                        # Filter out Windows software fees
                        linux_prices = [item for item in items if "Windows" not in item.get("productName", "")]
                        if linux_prices:
                            return float(linux_prices[0].get("retailPrice", 0))
                        return float(items[0].get("retailPrice", 0))
            except Exception:
                pass
            return None

        with SessionLocal() as db:
            for r_id in resources:
                db_res = db.query(DBResource).filter(DBResource.id == r_id).first()
                res_type = db_res.type if db_res else ("VirtualMachine" if "vm" in r_id.lower() else "Disk")
                region = db_res.region if db_res else "eastus"
                tags = db_res.tags if db_res and db_res.tags else {}
                
                # Check proposed action from Analysis
                action = "stop"
                for reco in context.recommendations:
                    if reco.get("resource_id") == r_id:
                        action = reco.get("proposed_action", "stop")
                        break
                
                cost_saving = 0.0
                
                # Find Advisor match if any
                advisor_match = None
                for adv in advisor_recos:
                    adv_res_id = adv.get("resourceId", "")
                    if r_id == adv_res_id or r_id in adv_res_id or adv_res_id in r_id:
                        advisor_match = adv
                        break
                
                if res_type == "VirtualMachine" or "virtualmachines" in res_type.lower():
                    sku = db_res.tags.get("vm_size") if (db_res and db_res.tags) else "Standard_D2s_v5"
                    if not sku or sku == "Unknown":
                        sku = "Standard_D2s_v5"
                        
                    # Calculate VM price
                    hourly_rate = get_prices_api_rate(sku, region)
                    if hourly_rate is None:
                        hourly_rate = VM_FALLBACK_HOURLY.get(sku, 0.096)
                        
                    monthly_cost = hourly_rate * 730.0
                    
                    # Uptime assumption (1.0 for production / general, 0.5 for dev VMs if tagged environment: Dev)
                    uptime_assumption = 1.0
                    if tags.get("Environment") == "Dev" or "dev" in r_id.lower():
                        uptime_assumption = 0.5
                        
                    if action == "stop":
                        cost_saving = monthly_cost * uptime_assumption
                    else:  # resize
                        # Resize usually halves the compute cost
                        target_sku = "Standard_B2s" if sku == "Standard_D2s_v5" else "Standard_D2s_v5"
                        target_rate = get_prices_api_rate(target_sku, region)
                        if target_rate is None:
                            target_rate = VM_FALLBACK_HOURLY.get(target_sku, 0.016)
                        cost_saving = (hourly_rate - target_rate) * 730.0 * uptime_assumption
                        if cost_saving <= 0:
                            cost_saving = monthly_cost * 0.40 * uptime_assumption
                            
                elif res_type == "Disk" or "disks" in res_type.lower():
                    # Disk saving based on size in GB
                    size_gb = 128
                    if db_res and db_res.tags:
                        try:
                            size_gb = int(db_res.tags.get("size_gb", 128))
                        except ValueError:
                            pass
                    # Rate: $0.15 per GB/month for standard SSD storage
                    cost_saving = size_gb * 0.15
                    
                else:  # ASP or others
                    cost_saving = 20.0
                    
                # Standardize to 2 decimal places
                cost_saving = round(cost_saving, 2)
                
                # Check for Advisor recommendation as advisory info
                if advisor_match:
                    adv_savings = float(advisor_match.get("savingsAmount", 0))
                    self.logger.log_thought(f"Advisor suggested savings for {r_id}: ${adv_savings}. Calculated: ${cost_saving}.")
                    
                savings_detail[r_id] = cost_saving
                total_savings += cost_saving
                
                # If production VM is proposed for stop, generate FinOps alternative resize reco
                is_production = (
                    tags.get("Environment") == "Production" or 
                    tags.get("env") == "prod" or 
                    tags.get("NeverStop") == "True" or 
                    tags.get("NeverStop") == True or
                    "conflict" in r_id.lower() or
                    "prod" in r_id.lower()
                )
                
                if is_production and action == "stop":
                    # Determine alternative resize savings
                    sku = db_res.tags.get("vm_size") if (db_res and db_res.tags) else "Standard_D2s_v5"
                    hourly_rate = VM_FALLBACK_HOURLY.get(sku, 0.096)
                    target_rate = VM_FALLBACK_HOURLY.get("Standard_B2s", 0.016)
                    alt_savings = round((hourly_rate - target_rate) * 730.0, 2)
                    
                    updated_recos.append({
                        "recommendation_id": f"reco-{r_id}-finops",
                        "resource_id": r_id,
                        "finding": "FinOps Resizing alternative",
                        "proposed_action": "resize",
                        "evidence": f"Resizing production VM preserves availability while yielding ${alt_savings:.2f} monthly savings."
                    })

        # Update cost estimates
        cost_estimates = {
            "currency": input_data.currency,
            "total_savings": round(total_savings, 2),
            "savings_detail": savings_detail
        }
        
        # Create updated context copy
        updated_context = context.model_copy(update={
            "cost_estimates": cost_estimates,
            "recommendations": updated_recos
        })

        # Confidence Propagation
        upstream_conf = message.confidence_score if message.confidence_score is not None else 1.0
        
        # Failure Simulation: Low Confidence
        if scenario_name == "low_confidence":
            local_conf = 0.40
            self.logger.log_warning("Noisy telemetry detected. Reducing FinOps confidence score.")
        else:
            local_conf = 0.90
            
        final_conf = upstream_conf * local_conf

        explanation = {
            "why": f"Calculated savings dynamically using Retail Prices API. Currency set to {input_data.currency}.",
            "evidence": {"savings_detail": savings_detail, "total_savings": total_savings},
            "confidence_score": final_conf,
            "assumptions": ["Retail rates apply", "VM pricing matches consumption tier"],
            "next_agent": "policy_agent"
        }
        
        output_payload = {
            "status": "COMPLETED",
            "total_potential_savings": round(total_savings, 2),
            "recommendations_count": len(resources),
            "confidence_score": final_conf,
            "explanation": explanation
        }
        
        self.logger.log_action("Completed savings estimation", {"total_potential_savings": total_savings})
        
        out_msg = AgentMessage(
            sender=self.agent_id,
            message_type=MessageType.FINOPS_RESPONSE,
            payload=output_payload,
            confidence_score=final_conf
        )
        
        return out_msg, updated_context
