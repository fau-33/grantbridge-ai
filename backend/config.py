"""Configuration loader for GrantBridge AI backend.

Reads all secrets strictly from environment variables (optionally loaded from
backend/.env or root .env during local development). Never hardcode secrets.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend/ first, then project root (existing env vars win)
_BACKEND_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _BACKEND_DIR.parent
load_dotenv(_BACKEND_DIR / ".env", override=False)
load_dotenv(_ROOT_DIR / ".env", override=False)


class Settings:
    """Runtime settings sourced exclusively from environment variables."""

    @property
    def database_url(self) -> str:
        return os.getenv("DATABASE_URL", "").strip()

    @property
    def firecrawl_api_key(self) -> str:
        return os.getenv("FIRECRAWL_API_KEY", "").strip()

    @property
    def gemini_api_key(self) -> str:
        return os.getenv("GEMINI_API_KEY", "").strip()

    @property
    def nvoip_api_key(self) -> str:
        return os.getenv("NVOIP_API_KEY", "").strip()

    @property
    def nvoip_api_url(self) -> str:
        return os.getenv("NVOIP_API_URL", "https://api.nvoip.com.br/v3/sms").strip()

    @property
    def gemini_model(self) -> str:
        return os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

    @property
    def allowed_origins(self) -> list[str]:
        raw = os.getenv(
            "ALLOWED_ORIGINS",
            "https://grantbridge-ai-theta.vercel.app,http://localhost:3000",
        )
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


settings = Settings()
