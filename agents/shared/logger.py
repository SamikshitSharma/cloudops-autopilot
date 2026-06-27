import logging
from typing import Any, Dict, Optional
from backend.app.core.logging import get_logger

class AgentLogger:
    """Specialized structured logging helper shared by all Google ADK agents."""
    
    def __init__(self, agent_name: str) -> None:
        self.agent_name = agent_name
        self._logger = get_logger(f"Agent.{agent_name}")

    def log_thought(self, thought: str, context: Optional[Dict[str, Any]] = None) -> None:
        """Logs an agent internal thought process or reasoning step."""
        extra_ctx = f" | Context: {context}" if context else ""
        self._logger.info(f"[THOUGHT] {thought}{extra_ctx}")

    def log_action(self, action: str, details: Optional[Dict[str, Any]] = None) -> None:
        """Logs a tool call execution or database writing action."""
        extra_details = f" | Details: {details}" if details else ""
        self._logger.info(f"[ACTION] {action}{extra_details}")

    def log_verification(self, resource_id: str, success: bool, reason: str) -> None:
        """Logs the outcome of a post-execution state verification."""
        status = "SUCCESS" if success else "FAILURE"
        self._logger.info(f"[VERIFY] Resource: {resource_id} | Status: {status} | Reason: {reason}")

    def log_warning(self, message: str, context: Optional[Dict[str, Any]] = None) -> None:
        """Logs a warning policy check or retry event."""
        extra_ctx = f" | Context: {context}" if context else ""
        self._logger.warning(f"[WARN] {message}{extra_ctx}")

    def log_error(self, error_msg: str, exception: Optional[Exception] = None) -> None:
        """Logs an agent execution crash or remote SDK API failure."""
        if exception:
            self._logger.error(f"[ERROR] {error_msg} | Exception: {exception}", exc_info=True)
        else:
            self._logger.error(f"[ERROR] {error_msg}")
