from datetime import datetime
from typing import Type, Tuple, Optional
from pydantic import BaseModel, Field
from agents.shared.base_agent import BaseAgent
from agents.shared.enums import MessageType
from agents.shared.message import AgentMessage
from agents.shared.context import AgentContext
from agents.shared.logger import AgentLogger
from agents.shared.scenarios import SCENARIOS

class TelemetryInputSchema(BaseModel):
    """Input parameters for telemetry agent."""
    resource_group: str
    collect_metrics: bool = True
    scenario_name: Optional[str] = None

class TelemetryOutputSchema(BaseModel):
    """Output parameters for telemetry agent."""
    status: str
    collected_at: datetime
    metrics_count: int
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    explanation: dict

class TelemetryAgent(BaseAgent):
    """Gathers resource utilization metrics from cloud integration plane based on active scenario."""
    
    def __init__(self) -> None:
        super().__init__(
            agent_id="telemetry_agent",
            name="Telemetry Agent",
            role="Telemetry Collection"
        )
        self.logger = AgentLogger(self.name)

    @property
    def input_schema(self) -> Type[BaseModel]:
        return TelemetryInputSchema

    @property
    def output_schema(self) -> Type[BaseModel]:
        return TelemetryOutputSchema

    async def execute(self, message: AgentMessage, context: AgentContext) -> Tuple[AgentMessage, AgentContext]:
        self.logger.log_thought("Gathers resource utilization metrics based on scenario parameters.")
        
        # Parse inputs
        input_data = self.input_schema(**message.payload)
        resource_group = input_data.resource_group
        
        # Get scenario name from payload, falling back to context
        scenario_name = input_data.scenario_name or context.telemetry.get("scenario_name")
        
        from shared.config import settings
        if settings.CLOUD_MODE.upper() == "LIVE":
            self.logger.log_thought("CLOUD_MODE is LIVE. Gathering live telemetry from Azure...")
            from cloud_adapter import get_azure_client
            client = get_azure_client()
            
            try:
                vms = await client.list_virtual_machines()
                disks = await client.list_unattached_disks()
                plans = await client.list_app_service_plans()
                
                metrics_list = []
                for vm in vms:
                    points = await client.get_resource_telemetry(vm.provider_id, 1)
                    metric = {
                        "resource_id": vm.provider_id,
                        "name": vm.name,
                        "type": vm.type,
                        "status": vm.status,
                        "metric_source": "Azure Monitor"
                    }
                    if points:
                        metric["cpu_utilization"] = points[-1].cpu_percent
                    metrics_list.append(metric)
                    
                for disk in disks:
                    metrics_list.append({
                        "resource_id": disk.provider_id,
                        "name": disk.name,
                        "type": disk.type,
                        "status": disk.status,
                        "metric_source": "Azure inventory"
                    })
                    
                for plan in plans:
                    metrics_list.append({
                        "resource_id": plan.provider_id,
                        "name": plan.name,
                        "type": plan.type,
                        "status": plan.status,
                        "metric_source": "Azure inventory"
                    })
                    
                telemetry_data = {
                    "resource_group": resource_group,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "metrics": metrics_list
                }
            except Exception as e:
                self.logger.log_error(f"Failed to fetch live telemetry: {e}")
                raise RuntimeError(f"LIVE telemetry collection failed: {e}") from e
        else:
            # Failure simulation applies only in MOCK scenario mode.
            if scenario_name == "missing_telemetry":
                self.logger.log_error("Critical error: Telemetry metrics are missing on the target host.")
                raise ValueError("Critical: Telemetry collection failed. No metrics found.")

            if scenario_name is None:
                # Default backward-compatible telemetry with 3 metrics (2 anomalies)
                telemetry_data = {
                    "resource_group": resource_group,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "metrics": [
                        {"resource_id": "vm-01", "type": "VirtualMachine", "cpu_utilization": 4.5, "memory_utilization": 20.0, "status": "running"},
                        {"resource_id": "vm-02", "type": "VirtualMachine", "cpu_utilization": 85.0, "memory_utilization": 70.0, "status": "running"},
                        {"resource_id": "disk-01", "type": "Disk", "status": "unattached"}
                    ]
                }
            else:
                # Get preset data
                scenario_info = SCENARIOS.get(scenario_name, SCENARIOS["idle_vm"])
                telemetry_data = scenario_info.get("telemetry_data", {})
        
        # Update telemetry data with scenario name so downstream agents can inspect it
        telemetry_data_updated = dict(telemetry_data)
        if scenario_name:
            telemetry_data_updated["scenario_name"] = scenario_name
        
        updated_context = context.model_copy(update={"telemetry": telemetry_data_updated})
        
        # Confidence calculation (Telemetry is clean, so confidence is 1.0)
        upstream_conf = message.confidence_score if message.confidence_score is not None else 1.0
        local_conf = 1.0
        final_conf = upstream_conf * local_conf

        metrics = telemetry_data_updated.get("metrics", [])
        
        explanation = {
            "why": f"Successfully fetched telemetry for resource group '{input_data.resource_group}' matching scenario '{scenario_name}'.",
            "evidence": {"metrics_count": len(metrics), "scenario": scenario_name},
            "confidence_score": final_conf,
            "assumptions": ["Metrics source endpoints are healthy", "Resource mapping matches subscriptions"],
            "next_agent": "analysis_agent"
        }
        
        output_payload = {
            "status": "COMPLETED",
            "collected_at": datetime.utcnow(),
            "metrics_count": len(metrics),
            "confidence_score": final_conf,
            "explanation": explanation
        }
        
        self.logger.log_action("Telemetry collected", {"metrics_count": len(metrics), "scenario": scenario_name})
        
        out_msg = AgentMessage(
            sender=self.agent_id,
            message_type=MessageType.TELEMETRY_RESPONSE,
            payload=output_payload,
            confidence_score=final_conf
        )
        
        return out_msg, updated_context
