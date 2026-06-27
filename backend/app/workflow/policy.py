from typing import List, Optional

class RetryPolicy:
    """Configurable policy defining parameters for retrying failed workflow actions."""
    
    def __init__(
        self,
        max_retries: int = 3,
        initial_delay_seconds: float = 1.0,
        backoff_factor: float = 2.0,
        retryable_errors: Optional[List[str]] = None
    ) -> None:
        self.max_retries = max_retries
        self.initial_delay_seconds = initial_delay_seconds
        self.backoff_factor = backoff_factor
        self.retryable_errors = retryable_errors or []

    def should_retry(self, attempt_count: int, error_message: Optional[str] = None) -> bool:
        """Determines if a retry should be executed based on attempt count and error properties."""
        if attempt_count >= self.max_retries:
            return False
            
        if not self.retryable_errors or not error_message:
            return True
            
        # Check if the error matches any of the registered retryable errors
        error_msg_lower = error_message.lower()
        return any(err.lower() in error_msg_lower for err in self.retryable_errors)

    def calculate_delay(self, attempt_count: int) -> float:
        """Computes the backoff delay in seconds for the next retry attempt (attempt_count is 0-indexed)."""
        return self.initial_delay_seconds * (self.backoff_factor ** attempt_count)
