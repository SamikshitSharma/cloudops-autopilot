from typing import List, Callable, Dict, Any, Type, Optional
from pydantic import BaseModel, Field

class StageRetryPolicy(BaseModel):
    """Configuration-driven retry policy for a single stage execution."""
    max_retries: int = 3
    initial_delay_seconds: float = 1.0
    backoff_factor: float = 2.0

class WorkflowStageContract(BaseModel):
    """Enforces strict structural constraints, schema validations, and policies for a workflow stage."""
    stage_id: str
    stage_name: str
    version: str = "1.0.0"
    priority: int = 0
    dependencies: List[str] = Field(default_factory=list)
    timeout_seconds: float = 60.0
    retry_policy: StageRetryPolicy = Field(default_factory=StageRetryPolicy)
    recovery_strategy: str = "fail"  # fail, skip, fallback
    
    # Validation schemas
    input_schema: Optional[Type[BaseModel]] = None
    output_schema: Optional[Type[BaseModel]] = None

class AgentRegistry:
    """Central registry responsible for discovering, registering, and validating workflow stages."""
    
    def __init__(self) -> None:
        self._stages: Dict[str, WorkflowStageContract] = {}
        self._execute_fns: Dict[str, Callable[[Any, Any], Any]] = {}

    def register(self, contract: WorkflowStageContract, execute_fn: Callable[[Any, Any], Any]) -> None:
        """Registers a stage with its contract and execution wrapper."""
        self._stages[contract.stage_id] = contract
        self._execute_fns[contract.stage_id] = execute_fn

    def get_stage(self, stage_id: str) -> Optional[WorkflowStageContract]:
        """Looks up stage contract details."""
        return self._stages.get(stage_id)

    def list_stages_sorted(self) -> List[WorkflowStageContract]:
        """Lists registered stages sorted by execution priority."""
        return sorted(self._stages.values(), key=lambda s: s.priority)

    def validate_dependencies(self, stage_id: str, completed_stages: List[str]) -> bool:
        """Validates that all upstream dependencies for a stage are fully satisfied."""
        contract = self.get_stage(stage_id)
        if not contract:
            return False
        for dep in contract.dependencies:
            if dep not in completed_stages:
                return False
        return True

    def validate_inputs(self, stage_id: str, payload: Dict[str, Any]) -> bool:
        """Validates that incoming inputs satisfy the stage's input schema."""
        contract = self.get_stage(stage_id)
        if not contract or not contract.input_schema:
            return True
        try:
            contract.input_schema(**payload)
            return True
        except Exception:
            return False

    def validate_outputs(self, stage_id: str, payload: Dict[str, Any]) -> bool:
        """Validates that outgoing outputs satisfy the stage's output schema."""
        contract = self.get_stage(stage_id)
        if not contract or not contract.output_schema:
            return True
        try:
            contract.output_schema(**payload)
            return True
        except Exception:
            return False

    async def execute_stage(self, stage_id: str, message: Any, context: Any) -> Any:
        """Invokes the stage's registered execution function."""
        fn = self._execute_fns.get(stage_id)
        if not fn:
            raise ValueError(f"Execution function for stage '{stage_id}' not registered in registry.")
        return await fn(message, context)

# Singleton global instance
global_agent_registry = AgentRegistry()
