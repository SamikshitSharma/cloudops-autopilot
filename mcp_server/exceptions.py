class MCPError(Exception):
    """Base exception class for all Model Context Protocol (MCP) tool errors."""
    pass

class ApprovalRequiredError(MCPError):
    """Raised when a write operation requires human approval before execution."""
    pass

class InvalidApprovalTokenError(MCPError):
    """Raised when the provided approval token is missing, expired, or invalid."""
    pass

class ToolValidationError(MCPError):
    """Raised when tool arguments fail schema validation or semantic checks."""
    pass

class ExecutionDeniedError(MCPError):
    """Raised when execution is blocked due to insufficient permissions or safety levels."""
    pass

class RollbackFailedError(MCPError):
    """Raised when a state rollback operation fails during recovery."""
    pass
