from enum import Enum

class MessageType(str, Enum):
    """Types of messages passed between agents."""
    TELEMETRY_REQUEST = "telemetry_request"
    TELEMETRY_RESPONSE = "telemetry_response"
    ANALYSIS_REQUEST = "analysis_request"
    ANALYSIS_RESPONSE = "analysis_response"
    FINOPS_REQUEST = "finops_request"
    FINOPS_RESPONSE = "finops_response"
    POLICY_REQUEST = "policy_request"
    POLICY_RESPONSE = "policy_response"
    DECISION_REQUEST = "decision_request"
    DECISION_RESPONSE = "decision_response"
    EXECUTION_REQUEST = "execution_request"
    EXECUTION_RESPONSE = "execution_response"
    VERIFICATION_REQUEST = "verification_request"
    VERIFICATION_RESPONSE = "verification_response"
    AUDIT_REQUEST = "audit_request"
    AUDIT_RESPONSE = "audit_response"
    ERROR = "error"

class AgentStatus(str, Enum):
    """Current state of an individual agent."""
    IDLE = "idle"
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"

class TraceStatus(str, Enum):
    """Outcome status of an agent reasoning trace."""
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    SKIPPED = "SKIPPED"
