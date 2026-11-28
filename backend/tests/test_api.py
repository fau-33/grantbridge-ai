"""Integration tests for public read endpoints (/api/health, /api/grants)."""

from __future__ import annotations

import main

SAMPLE_GRANTS = [
    {
        "id": 1,
        "title": "Amazon Community Resilience Fund",
        "funder": "Global Greengrants Fund",
        "country": "Brazil",
        "funding_amount": "USD 50,000",
        "deadline": "2026-12-31",
        "scope": "Community-led forest protection",
        "source_url": "https://www.greengrants.org/",
    },
    {
        "id": 2,
        "title": "Small Grants Programme",
        "funder": "UNDP",
        "country": "Global",
        "funding_amount": "USD 25,000",
        "deadline": "2027-03-01",
        "scope": "Biodiversity and climate adaptation",
        "source_url": "https://sgp.undp.org/",
    },
]


def test_health_reports_all_integrations(client, monkeypatch):
    monkeypatch.setattr(main, "check_db_health", lambda: {"status": "connected", "backend": "stub"})

    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "GrantBridge AI Backend"
    assert set(body["integrations"]) == {"neon_postgresql", "firecrawl_v2", "gemini_ai", "nvoip_v3"}
    assert body["integrations"]["neon_postgresql"] == {"status": "connected", "backend": "stub"}


def test_health_marks_missing_keys_as_not_configured(client, monkeypatch):
    monkeypatch.setattr(main, "check_db_health", lambda: {"status": "connected"})

    integrations = client.get("/api/health").json()["integrations"]

    for name in ("firecrawl_v2", "gemini_ai", "nvoip_v3"):
        assert integrations[name]["configured"] is False
        assert integrations[name]["status"] == "not_configured"
    assert integrations["gemini_ai"]["model"] == "gemini-2.5-flash"


def test_health_marks_present_keys_as_ready(client, monkeypatch):
    monkeypatch.setattr(main, "check_db_health", lambda: {"status": "connected"})
    monkeypatch.setenv("FIRECRAWL_API_KEY", "fc-test")
    monkeypatch.setenv("GEMINI_API_KEY", "gm-test")
    monkeypatch.setenv("NVOIP_API_KEY", "nv-test")

    integrations = client.get("/api/health").json()["integrations"]

    for name in ("firecrawl_v2", "gemini_ai", "nvoip_v3"):
        assert integrations[name] == {**integrations[name], "configured": True, "status": "ready"}


def test_health_sets_security_headers(client, monkeypatch):
    monkeypatch.setattr(main, "check_db_health", lambda: {"status": "connected"})

    response = client.get("/api/health")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_grants_returns_count_and_list(client, monkeypatch):
    monkeypatch.setattr(main, "list_grants", lambda: SAMPLE_GRANTS)

    response = client.get("/api/grants")

    assert response.status_code == 200
    assert response.json() == {"count": 2, "grants": SAMPLE_GRANTS}


def test_grants_empty_database(client, monkeypatch):
    monkeypatch.setattr(main, "list_grants", lambda: [])

    response = client.get("/api/grants")

    assert response.status_code == 200
    assert response.json() == {"count": 0, "grants": []}


def test_grants_database_failure_returns_safe_500(client, monkeypatch):
    def broken():
        raise RuntimeError("connection refused: postgres://user:secret@host/db")

    monkeypatch.setattr(main, "list_grants", broken)

    response = client.get("/api/grants")

    assert response.status_code == 500
    assert response.json() == {"detail": "Erro ao consultar editais no banco de dados."}
    assert "secret" not in response.text
