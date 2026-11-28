"""Tests for the in-memory per-IP sliding-window rate limiter."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import main
from main import enforce_rate_limit


def _request(client_ip: str = "203.0.113.10", forwarded_for: str | None = None) -> Request:
    headers = []
    if forwarded_for is not None:
        headers.append((b"x-forwarded-for", forwarded_for.encode()))
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/match",
        "headers": headers,
        "client": (client_ip, 12345),
    }
    return Request(scope)


class FakeClock:
    def __init__(self, start: float = 1000.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock(monkeypatch):
    fake = FakeClock()
    monkeypatch.setattr(main.time, "monotonic", fake)
    return fake


def test_allows_requests_up_to_limit(clock):
    for _ in range(3):
        enforce_rate_limit(_request(), bucket="t", max_requests=3)


def test_blocks_request_over_limit_with_429(clock):
    for _ in range(3):
        enforce_rate_limit(_request(), bucket="t", max_requests=3)

    with pytest.raises(HTTPException) as exc_info:
        enforce_rate_limit(_request(), bucket="t", max_requests=3)

    assert exc_info.value.status_code == 429


def test_window_slides_and_releases_quota(clock):
    for _ in range(2):
        enforce_rate_limit(_request(), bucket="t", max_requests=2, window_seconds=60)
    with pytest.raises(HTTPException):
        enforce_rate_limit(_request(), bucket="t", max_requests=2, window_seconds=60)

    clock.now += 61
    enforce_rate_limit(_request(), bucket="t", max_requests=2, window_seconds=60)


def test_limits_are_isolated_per_ip(clock):
    for _ in range(2):
        enforce_rate_limit(_request("198.51.100.1"), bucket="t", max_requests=2)
    with pytest.raises(HTTPException):
        enforce_rate_limit(_request("198.51.100.1"), bucket="t", max_requests=2)

    enforce_rate_limit(_request("198.51.100.2"), bucket="t", max_requests=2)


def test_limits_are_isolated_per_bucket(clock):
    for _ in range(2):
        enforce_rate_limit(_request(), bucket="ingest-url", max_requests=2)
    with pytest.raises(HTTPException):
        enforce_rate_limit(_request(), bucket="ingest-url", max_requests=2)

    enforce_rate_limit(_request(), bucket="match", max_requests=2)


def test_uses_first_x_forwarded_for_hop(clock):
    proxy_ip = "10.0.0.1"
    enforce_rate_limit(_request(proxy_ip, "203.0.113.7, 10.0.0.1"), bucket="t", max_requests=1)

    with pytest.raises(HTTPException):
        enforce_rate_limit(_request(proxy_ip, "203.0.113.7"), bucket="t", max_requests=1)

    enforce_rate_limit(_request(proxy_ip, "203.0.113.8, 10.0.0.1"), bucket="t", max_requests=1)
    assert "t:203.0.113.7" in main._RATE_BUCKETS
    assert "t:203.0.113.8" in main._RATE_BUCKETS
    assert f"t:{proxy_ip}" not in main._RATE_BUCKETS


def test_match_endpoint_returns_429_after_ten_requests(client, monkeypatch):
    monkeypatch.setattr(main, "list_grants", lambda: [])
    headers = {"X-Forwarded-For": "203.0.113.50"}
    payload = {"ong_profile": "Cooperativa de reciclagem no interior de Minas Gerais"}

    statuses = [client.post("/api/match", json=payload, headers=headers).status_code for _ in range(10)]
    assert statuses == [404] * 10

    blocked = client.post("/api/match", json=payload, headers=headers)
    assert blocked.status_code == 429
    assert "Aguarde" in blocked.json()["detail"]

    other_ip = client.post("/api/match", json=payload, headers={"X-Forwarded-For": "203.0.113.51"})
    assert other_ip.status_code == 404


def test_ingest_endpoint_returns_429_after_five_requests(client):
    headers = {"X-Forwarded-For": "203.0.113.60"}
    payload = {"url": "http://127.0.0.1/blocked"}

    statuses = [client.post("/api/ingest-url", json=payload, headers=headers).status_code for _ in range(5)]
    assert statuses == [422] * 5

    assert client.post("/api/ingest-url", json=payload, headers=headers).status_code == 429
