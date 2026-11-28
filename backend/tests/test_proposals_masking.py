"""Tests for phone masking (LGPD/PII guard) in GET /api/proposals."""

from __future__ import annotations

import pytest

import main
from main import _mask_phone


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("5511987654321", "5511*****21"),
        ("11987654321", "1198*****21"),
        ("  5521912345678  ", "5521*****78"),
        ("12345", "1234*****45"),
        ("1234", ""),
        ("", ""),
        (None, ""),
    ],
)
def test_mask_phone(raw, expected):
    assert _mask_phone(raw) == expected


def test_mask_phone_never_leaks_middle_digits():
    raw = "5511987654321"
    masked = _mask_phone(raw)
    assert raw not in masked
    assert "987654" not in masked


def test_proposals_endpoint_masks_phone_numbers(client, monkeypatch):
    captured = {}

    def fake_list_proposals(limit=20):
        captured["limit"] = limit
        return [
            {
                "id": 2,
                "ong_profile": "Cooperativa de manejo sustentável no Pará",
                "grant_id": 1,
                "match_score": 88,
                "phone_notified": "5591987654321",
                "notification_status": "sent",
            },
            {
                "id": 1,
                "ong_profile": "Viveiro comunitário de mudas nativas",
                "grant_id": 2,
                "match_score": 74,
                "phone_notified": None,
                "notification_status": "skipped",
            },
            {
                "id": 0,
                "ong_profile": "Projeto sem telefone válido",
                "grant_id": 2,
                "match_score": 60,
                "phone_notified": "123",
                "notification_status": "skipped",
            },
        ]

    monkeypatch.setattr(main, "list_proposals", fake_list_proposals)

    response = client.get("/api/proposals?limit=5")

    assert response.status_code == 200
    body = response.json()
    assert captured["limit"] == 5
    assert body["count"] == 3
    phones = [p["phone_notified"] for p in body["proposals"]]
    assert phones == ["5591*****21", "", ""]
    assert "5591987654321" not in response.text
    assert body["proposals"][0]["match_score"] == 88


def test_proposals_database_failure_returns_safe_500(client, monkeypatch):
    def broken(limit=20):
        raise RuntimeError("boom")

    monkeypatch.setattr(main, "list_proposals", broken)

    response = client.get("/api/proposals")

    assert response.status_code == 500
    assert response.json() == {"detail": "Erro ao listar propostas."}
