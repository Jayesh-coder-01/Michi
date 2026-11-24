"""
MICHI Backend Configuration Management
Aligned with docs/ARCHITECTURE.md and docs/SECURITY.md
Supabase Auth is the Single Source of Truth for Identity
"""

from pathlib import Path
from typing import List, Union, Optional
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application Mode
    PROJECT_NAME: str = "MICHI API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Server Host / Port
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Supabase Auth Configuration (Authoritative Identity Provider)
    SUPABASE_URL: str = "https://your-project-id.supabase.co"
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_JWKS_URL: Optional[str] = None

    @model_validator(mode="after")
    def derive_jwks_url(self) -> "Settings":
        if not self.SUPABASE_JWKS_URL and self.SUPABASE_URL:
            self.SUPABASE_JWKS_URL = f"{self.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        return self

    # Test & Offline Fallback JWT Secret (Only used in test environment)
    TEST_JWT_SECRET: str = "michi-test-jwt-secret-for-offline-pytest-min-32-chars"

    # Database URL (Postgres in production / SQLite for local/test)
    DATABASE_URL: str = "sqlite:///./michi_dev.db"

    # CORS Allowed Origins
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=(
            ".env",
            ".env.local",
            str(Path(__file__).resolve().parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent / ".env.local"),
        ),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
