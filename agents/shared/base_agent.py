from agents.shared.adk_adapter import GoogleADKAgentAdapter
from agents.shared.registry import global_registry

class BaseAgent(GoogleADKAgentAdapter):
    """Base class for all cognitive agents in the system.
    
    Provides standard capabilities for schema validation and lifecycle management.
    Every subclass automatically registers itself with the global AgentRegistry.
    """
    
    def __init__(self, agent_id: str, name: str, role: str) -> None:
        super().__init__(agent_id, name, role)
        # Automatically register the agent instance on instantiation
        global_registry.register(self)
