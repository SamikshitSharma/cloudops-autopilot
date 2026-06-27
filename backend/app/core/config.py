import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Compute project root directory (4 levels up from this file)
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Manually load .env file into os.environ if not already present
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                parts = line.split("=", 1)
                key = parts[0].strip()
                val = parts[1].strip()
                os.environ.setdefault(key, val)


class Settings(BaseSettings):
    """Centralized configuration settings for the CloudOps Autopilot system.
    
    Loads values from environment variables and an optional .env file at the project root.
    """
    
    APP_NAME: str = "CloudOps-Autopilot"
    ENV: str = "development"
    
    # Cloud execution mode: "MOCK" or "LIVE"
    CLOUD_MODE: str = "MOCK"
    
    # Database configuration path (defaults to project-relative SQLite database)
    DATABASE_URL: Optional[str] = None
    
    # JWT authentication parameters (strictly required in environment)
    JWT_SECRET_KEY: str = Field(description="Secret key for signing JWT tokens. Required in environment.")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    
    # AI/LLM models configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # Operations settings
    IDLE_CPU_THRESHOLD_PERCENT: float = 5.0
    IDLE_TIME_WINDOW_HOURS: int = 24
    APPROVAL_TOKEN_ISSUER: str = "cloudops-autopilot-backend"
    
    # Log configuration level
    LOG_LEVEL: str = "INFO"

    # Enforce Pydantic Settings Config to parse env files
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: Optional[str]) -> str:
        """Fallback to project-relative default SQLite path if DATABASE_URL is not set."""
        if v:
            return v
        db_path = PROJECT_ROOT / "cloudops_autopilot.db"
        return f"sqlite:///{db_path.as_posix()}"

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """Enforces that JWT_SECRET_KEY is present and not empty."""
        if not v or v.strip() == "":
            raise ValueError("JWT_SECRET_KEY must be provided and cannot be empty.")
        return v

@lru_cache()
def get_settings() -> Settings:
    """Returns a cached instance of the system settings."""
    return Settings()

# Exposed for backward compatibility and simple imports
settings = get_settings()
