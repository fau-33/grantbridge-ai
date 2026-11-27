"""Database layer for GrantBridge AI.

Primary backend: Neon Serverless PostgreSQL (via psycopg 3 with SSL).
Fallback backend: Local ephemeral SQLite ONLY when DATABASE_URL is unset so
local smoke tests can still exercise the API while /api/health transparently
reports Neon DB as not configured.
"""

from __future__ import annotations

import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg
from psycopg.rows import dict_row

from config import settings
from seed_data import SEED_GRANTS

logger = logging.getLogger("grantbridge.db")

_SQLITE_PATH = Path(__file__).resolve().parent / ".local_fallback.db"


def _ensure_sslmode(url: str) -> str:
    """Guarantee sslmode=require for Neon PostgreSQL connections."""
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if "sslmode" not in query:
        query["sslmode"] = "require"
    return urlunparse(parsed._replace(query=urlencode(query)))


def _is_postgres_configured() -> bool:
    return bool(settings.database_url)


@contextmanager
def _pg_connection():
    conn_str = _ensure_sslmode(settings.database_url)
    with psycopg.connect(conn_str, row_factory=dict_row, connect_timeout=10) as conn:
        yield conn


@contextmanager
def _sqlite_connection():
    conn = sqlite3.connect(_SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _serialize_row(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def init_db() -> dict[str, Any]:
    """Create grants and proposals tables and seed 6 real grants if empty."""
    if _is_postgres_configured():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS grants (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        organization TEXT NOT NULL,
                        country TEXT NOT NULL,
                        funding_amount TEXT NOT NULL,
                        deadline TEXT NOT NULL,
                        description TEXT NOT NULL,
                        source_url TEXT NOT NULL,
                        raw_markdown TEXT DEFAULT '',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS proposals (
                        id SERIAL PRIMARY KEY,
                        ong_profile TEXT NOT NULL,
                        grant_id INTEGER REFERENCES grants(id) ON DELETE SET NULL,
                        match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
                        generated_proposal_en TEXT NOT NULL,
                        phone_notified TEXT DEFAULT '',
                        notification_status TEXT NOT NULL DEFAULT 'skipped',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    """
                )
                cur.execute("SELECT COUNT(*) AS count FROM grants;")
                row = cur.fetchone()
                count = row["count"] if row else 0
                seeded = 0
                if count == 0:
                    for g in SEED_GRANTS:
                        cur.execute(
                            """
                            INSERT INTO grants (
                                title, organization, country, funding_amount,
                                deadline, description, source_url, raw_markdown
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                            """,
                            (
                                g["title"],
                                g["organization"],
                                g["country"],
                                g["funding_amount"],
                                g["deadline"],
                                g["description"],
                                g["source_url"],
                                g["raw_markdown"],
                            ),
                        )
                        seeded += 1
            conn.commit()
        logger.info("Neon PostgreSQL initialized (seeded=%d).", seeded)
        return {"provider": "neon_postgresql", "seeded": seeded}

    # Local SQLite fallback when DATABASE_URL is not configured
    with _sqlite_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS grants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                organization TEXT NOT NULL,
                country TEXT NOT NULL,
                funding_amount TEXT NOT NULL,
                deadline TEXT NOT NULL,
                description TEXT NOT NULL,
                source_url TEXT NOT NULL,
                raw_markdown TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ong_profile TEXT NOT NULL,
                grant_id INTEGER REFERENCES grants(id) ON DELETE SET NULL,
                match_score INTEGER NOT NULL,
                generated_proposal_en TEXT NOT NULL,
                phone_notified TEXT DEFAULT '',
                notification_status TEXT NOT NULL DEFAULT 'skipped',
                created_at TEXT NOT NULL
            );
            """
        )
        count = cur.execute("SELECT COUNT(*) FROM grants;").fetchone()[0]
        seeded = 0
        if count == 0:
            now = datetime.now(timezone.utc).isoformat()
            for g in SEED_GRANTS:
                cur.execute(
                    """
                    INSERT INTO grants (
                        title, organization, country, funding_amount,
                        deadline, description, source_url, raw_markdown, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        g["title"],
                        g["organization"],
                        g["country"],
                        g["funding_amount"],
                        g["deadline"],
                        g["description"],
                        g["source_url"],
                        g["raw_markdown"],
                        now,
                    ),
                )
                seeded += 1
    logger.warning(
        "DATABASE_URL not set; running with local SQLite fallback (seeded=%d).",
        seeded,
    )
    return {"provider": "sqlite_local_fallback", "seeded": seeded}


def check_db_health() -> dict[str, Any]:
    if not _is_postgres_configured():
        return {
            "connected": False,
            "provider": "sqlite_local_fallback",
            "status": "not_configured",
            "detail": "DATABASE_URL is not set; using local SQLite fallback.",
        }
    try:
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS count FROM grants;")
                grants_count = cur.fetchone()["count"]
        return {
            "connected": True,
            "provider": "neon_postgresql",
            "status": "ok",
            "grants_count": grants_count,
        }
    except Exception:
        logger.exception("Neon PostgreSQL health check failed.")
        return {
            "connected": False,
            "provider": "neon_postgresql",
            "status": "error",
            "detail": "Unable to reach Neon PostgreSQL database.",
        }


def list_grants() -> list[dict[str, Any]]:
    query = """
        SELECT id, title, organization, country, funding_amount,
               deadline, description, source_url, created_at
        FROM grants
        ORDER BY created_at DESC, id DESC;
    """
    if _is_postgres_configured():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                rows = cur.fetchall()
        return [_serialize_row(dict(r)) for r in rows]

    with _sqlite_connection() as conn:
        rows = conn.execute(query).fetchall()
    return [_serialize_row(dict(r)) for r in rows]


def insert_grant(grant: dict[str, Any]) -> dict[str, Any]:
    if _is_postgres_configured():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO grants (
                        title, organization, country, funding_amount,
                        deadline, description, source_url, raw_markdown
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, title, organization, country, funding_amount,
                              deadline, description, source_url, created_at;
                    """,
                    (
                        grant["title"],
                        grant["organization"],
                        grant["country"],
                        grant["funding_amount"],
                        grant["deadline"],
                        grant["description"],
                        grant["source_url"],
                        grant.get("raw_markdown", ""),
                    ),
                )
                row = cur.fetchone()
            conn.commit()
        return _serialize_row(dict(row))

    now = datetime.now(timezone.utc).isoformat()
    with _sqlite_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO grants (
                title, organization, country, funding_amount,
                deadline, description, source_url, raw_markdown, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                grant["title"],
                grant["organization"],
                grant["country"],
                grant["funding_amount"],
                grant["deadline"],
                grant["description"],
                grant["source_url"],
                grant.get("raw_markdown", ""),
                now,
            ),
        )
        new_id = cur.lastrowid
        row = cur.execute(
            """
            SELECT id, title, organization, country, funding_amount,
                   deadline, description, source_url, created_at
            FROM grants WHERE id = ?;
            """,
            (new_id,),
        ).fetchone()
    return _serialize_row(dict(row))


def insert_proposal(proposal: dict[str, Any]) -> dict[str, Any]:
    if _is_postgres_configured():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO proposals (
                        ong_profile, grant_id, match_score,
                        generated_proposal_en, phone_notified, notification_status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, ong_profile, grant_id, match_score,
                              generated_proposal_en, phone_notified,
                              notification_status, created_at;
                    """,
                    (
                        proposal["ong_profile"],
                        proposal["grant_id"],
                        proposal["match_score"],
                        proposal["generated_proposal_en"],
                        proposal.get("phone_notified", ""),
                        proposal.get("notification_status", "skipped"),
                    ),
                )
                row = cur.fetchone()
            conn.commit()
        return _serialize_row(dict(row))

    now = datetime.now(timezone.utc).isoformat()
    with _sqlite_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO proposals (
                ong_profile, grant_id, match_score,
                generated_proposal_en, phone_notified, notification_status, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (
                proposal["ong_profile"],
                proposal["grant_id"],
                proposal["match_score"],
                proposal["generated_proposal_en"],
                proposal.get("phone_notified", ""),
                proposal.get("notification_status", "skipped"),
                now,
            ),
        )
        new_id = cur.lastrowid
        row = cur.execute(
            """
            SELECT id, ong_profile, grant_id, match_score,
                   generated_proposal_en, phone_notified,
                   notification_status, created_at
            FROM proposals WHERE id = ?;
            """,
            (new_id,),
        ).fetchone()
    return _serialize_row(dict(row))


def list_proposals(limit: int = 20) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    if _is_postgres_configured():
        with _pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT p.id, p.ong_profile, p.grant_id, p.match_score,
                           p.generated_proposal_en, p.phone_notified,
                           p.notification_status, p.created_at,
                           g.title AS grant_title, g.organization AS grant_organization
                    FROM proposals p
                    LEFT JOIN grants g ON g.id = p.grant_id
                    ORDER BY p.created_at DESC, p.id DESC
                    LIMIT %s;
                    """,
                    (limit,),
                )
                rows = cur.fetchall()
        return [_serialize_row(dict(r)) for r in rows]

    with _sqlite_connection() as conn:
        rows = conn.execute(
            """
            SELECT p.id, p.ong_profile, p.grant_id, p.match_score,
                   p.generated_proposal_en, p.phone_notified,
                   p.notification_status, p.created_at,
                   g.title AS grant_title, g.organization AS grant_organization
            FROM proposals p
            LEFT JOIN grants g ON g.id = p.grant_id
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT ?;
            """,
            (limit,),
        ).fetchall()
    return [_serialize_row(dict(r)) for r in rows]
