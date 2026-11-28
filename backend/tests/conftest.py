"""Shared pytest fixtures for the GrantBridge AI backend."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_SECRET_ENV_VARS = (
    "DATABASE_URL",
    "FIRECRAWL_API_KEY",
    "GEMINI_API_KEY",
    "NVOIP_API_KEY",
)


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch):
    """Never let tests reach real Neon/Firecrawl/Gemini/Nvoip credentials."""
    for name in _SECRET_ENV_VARS:
        monkeypatch.setenv(name, "")


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    import main

    main._RATE_BUCKETS.clear()
    yield
    main._RATE_BUCKETS.clear()


@pytest.fixture
def client(monkeypatch):
    """FastAPI TestClient with startup DB initialization stubbed out."""
    from fastapi.testclient import TestClient

    import main

    monkeypatch.setattr(main, "init_db", lambda: {"backend": "stub"})
    with TestClient(main.app) as test_client:
        yield test_client
