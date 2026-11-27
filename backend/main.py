"""GrantBridge AI — FastAPI Backend Entry Point.

Hack Brasil 2026 (Trilha: Meio ambiente & economia verde)
Connects Brazilian grassroots environmental organizations to international climate
grants using Neon PostgreSQL, Firecrawl v2, Google Gemini 2.5 Flash, and Nvoip v3.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from config import settings
from db import (
    check_db_health,
    init_db,
    insert_grant,
    insert_proposal,
    list_grants,
    list_proposals,
)
from services import (
    ServiceError,
    extract_grant_from_markdown,
    match_and_draft_proposal,
    scrape_with_firecrawl,
    send_nvoip_alert,
    validate_public_url,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("grantbridge.api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize Neon PostgreSQL tables and seed international climate grants on startup."""
    try:
        info = init_db()
        logger.info("Startup DB init complete: %s", info)
    except Exception:
        logger.exception("Database initialization failed during startup.")
    yield


app = FastAPI(
    title="GrantBridge AI API",
    description="API para conectar ONGs e cooperativas ambientais do Brasil a fundos climáticos internacionais.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS enabled for Vercel frontend & local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(ServiceError)
async def service_error_handler(_request: Request, exc: ServiceError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------


class IngestUrlRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2048, description="URL pública do edital internacional")


class MatchRequest(BaseModel):
    ong_profile: str = Field(
        ...,
        min_length=15,
        max_length=4000,
        description="Descrição do projeto ou organização ambiental brasileira",
    )
    whatsapp_phone: str | None = Field(
        default="",
        max_length=30,
        description="Telefone/WhatsApp opcional com DDD para alerta via Nvoip v3",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health_check() -> dict[str, Any]:
    """Report live connectivity and configuration status for each integration."""
    db_status = check_db_health()
    return {
        "status": "ok",
        "service": "GrantBridge AI Backend",
        "version": "1.0.0",
        "integrations": {
            "neon_postgresql": db_status,
            "firecrawl_v2": {
                "configured": bool(settings.firecrawl_api_key),
                "status": "ready" if settings.firecrawl_api_key else "not_configured",
            },
            "gemini_ai": {
                "configured": bool(settings.gemini_api_key),
                "model": settings.gemini_model,
                "status": "ready" if settings.gemini_api_key else "not_configured",
            },
            "nvoip_v3": {
                "configured": bool(settings.nvoip_api_key),
                "status": "ready" if settings.nvoip_api_key else "not_configured",
            },
        },
    }


@app.get("/api/grants")
async def get_grants() -> dict[str, Any]:
    """List all international climate grants stored in Neon PostgreSQL."""
    try:
        grants = list_grants()
    except Exception as exc:
        logger.exception("Failed to list grants.")
        raise HTTPException(status_code=500, detail="Erro ao consultar editais no banco de dados.") from exc

    return {
        "count": len(grants),
        "grants": grants,
    }


@app.post("/api/ingest-url", status_code=201)
async def ingest_grant_url(payload: IngestUrlRequest) -> dict[str, Any]:
    """Scrape a grant URL live with Firecrawl v2, extract metadata via Gemini, and save to Neon."""
    safe_url = validate_public_url(payload.url)
    markdown = await scrape_with_firecrawl(safe_url)
    extracted = extract_grant_from_markdown(markdown, safe_url)

    try:
        saved_grant = insert_grant(extracted)
    except Exception as exc:
        logger.exception("Failed to save ingested grant.")
        raise HTTPException(status_code=500, detail="Erro ao salvar o edital raspado no banco de dados.") from exc

    return {
        "message": "Edital raspado com sucesso via Firecrawl v2 e indexado no Neon PostgreSQL.",
        "grant": saved_grant,
    }


@app.post("/api/match")
async def match_organization(payload: MatchRequest) -> dict[str, Any]:
    """Match a Brazilian NGO profile to the best grant, draft an English Concept Note, and alert via Nvoip."""
    try:
        grants = list_grants()
    except Exception as exc:
        logger.exception("Failed to load grants for matching.")
        raise HTTPException(status_code=500, detail="Erro ao carregar editais para análise.") from exc

    if not grants:
        raise HTTPException(status_code=404, detail="Nenhum edital cadastrado no momento.")

    match_result = match_and_draft_proposal(payload.ong_profile.strip(), grants)
    selected_grant = next(
        (g for g in grants if g["id"] == match_result["grant_id"]),
        grants[0],
    )

    notification = await send_nvoip_alert(
        phone=(payload.whatsapp_phone or "").strip(),
        grant_title=selected_grant["title"],
        match_score=match_result["match_score"],
        funding_amount=selected_grant["funding_amount"],
    )

    try:
        saved_proposal = insert_proposal(
            {
                "ong_profile": payload.ong_profile.strip(),
                "grant_id": selected_grant["id"],
                "match_score": match_result["match_score"],
                "generated_proposal_en": match_result["generated_proposal_en"],
                "phone_notified": notification["phone"],
                "notification_status": notification["status"],
            }
        )
    except Exception as exc:
        logger.exception("Failed to persist proposal.")
        raise HTTPException(status_code=500, detail="Erro ao salvar proposta gerada no banco de dados.") from exc

    return {
        "proposal_id": saved_proposal["id"],
        "match_score": match_result["match_score"],
        "match_reasoning_pt": match_result["match_reasoning_pt"],
        "ai_mode": match_result["ai_mode"],
        "matched_grant": selected_grant,
        "generated_proposal_en": match_result["generated_proposal_en"],
        "notification": notification,
        "created_at": saved_proposal["created_at"],
    }


@app.get("/api/proposals")
async def get_proposals(limit: int = 10) -> dict[str, Any]:
    """List recently generated proposals for transparency and demo verification."""
    try:
        proposals = list_proposals(limit=limit)
    except Exception as exc:
        logger.exception("Failed to list proposals.")
        raise HTTPException(status_code=500, detail="Erro ao listar propostas.") from exc
    return {"count": len(proposals), "proposals": proposals}
