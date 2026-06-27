from abc import ABC, abstractmethod
from typing import Type, Tuple
from pydantic import BaseModel
from agents.shared.message import AgentMessage
from agents.shared.context import AgentContext

class GoogleADKAgentAdapter(ABC):
    """Adapter layer protecting individual agents from changes in Google ADK.
    
    If the underlying Google ADK framework updates or is replaced, only this 
    adapter class needs to be modified to align with the new specifications.
    """
    
    def __init__(self, agent_id: str, name: str, role: str) -> None:
        self.agent_id = agent_id
        self.name = name
        self.role = role

    @property
    @abstractmethod
    def input_schema(self) -> Type[BaseModel]:
        """The expected input schema class for validation."""
        pass

    @property
    @abstractmethod
    def output_schema(self) -> Type[BaseModel]:
        """The expected output schema class for validation."""
        pass

    @abstractmethod
    async def execute(self, message: AgentMessage, context: AgentContext) -> Tuple[AgentMessage, AgentContext]:
        """Executes the agent reasoning/action.
        
        Must return a tuple of (OutputMessage, UpdatedContext) to maintain immutability.
        """
        pass

    def validate(self, message: AgentMessage) -> bool:
        """Validates that the incoming message payload satisfies the input schema."""
        try:
            self.input_schema(**message.payload)
            return True
        except Exception:
            return False
