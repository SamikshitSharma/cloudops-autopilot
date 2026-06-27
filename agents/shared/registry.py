from typing import Dict, List, Optional, Any

class AgentRegistry:
    """Registry to manage and look up active agent instances."""
    
    def __init__(self) -> None:
        self._agents: Dict[str, Any] = {}

    def register(self, agent: Any) -> None:
        """Register an agent instance in the registry."""
        self._agents[agent.agent_id] = agent

    def unregister(self, agent_id: str) -> None:
        """Remove an agent from the registry."""
        if agent_id in self._agents:
            del self._agents[agent_id]

    def lookup(self, agent_id: str) -> Optional[Any]:
        """Look up an agent by its unique identifier."""
        return self._agents.get(agent_id)

    def list_agents(self) -> List[Any]:
        """List all registered agents."""
        return list(self._agents.values())

# Singleton registry instance
global_registry = AgentRegistry()
