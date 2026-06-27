import logging
import sys
import json
from datetime import datetime
from typing import Any, Dict, Optional
from backend.app.core.config import settings

class StructuredFormatter(logging.Formatter):
    """Custom logging formatter outputting JSON or cleanly structured text logs."""
    
    def __init__(self, use_json: bool = False) -> None:
        super().__init__()
        self.use_json = use_json

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno
        }
        
        # Include exception information if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
            
        if self.use_json:
            return json.dumps(log_data)
        
        # Text fallback formatting for readable console output
        exception_str = f"\n{log_data['exception']}" if "exception" in log_data else ""
        return f"[{log_data['timestamp']}] {log_data['level']:<8} [{log_data['logger']}] {log_data['message']} (line {log_data['line']}){exception_str}"

def setup_logging() -> None:
    """Configures system-wide logging parameters based on central settings."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Clear existing handlers
    if root_logger.handlers:
        root_logger.handlers.clear()
        
    # Console output handler
    console_handler = logging.StreamHandler(sys.stdout)
    # Output JSON in production/docker; pretty-print locally in dev
    use_json = settings.ENV.lower() == "production"
    console_handler.setFormatter(StructuredFormatter(use_json=use_json))
    root_logger.addHandler(console_handler)

def get_logger(name: str) -> logging.Logger:
    """Factory function yielding a logger configured under standard settings."""
    logger = logging.getLogger(name)
    return logger

# Initialize system log configurations immediately on load
setup_logging()
