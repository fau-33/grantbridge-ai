import { type ZodType } from "zod";

import {
  GrantsListResponseSchema,
  HealthResponseSchema,
  IngestUrlInputSchema,
  IngestUrlResponseSchema,
  MatchRequestSchema,
  MatchResponseSchema,
  ProposalsListResponseSchema,
  type GrantsListResponse,
  type HealthResponse,
  type IngestUrlInput,
  type IngestUrlResponse,
  type MatchRequest,
  type MatchResponse,
  type ProposalsListResponse,
} from "./schemas";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://grantbridge-ai.onrender.com"
).replace(/\/+$/, "");

/**
 * 60s default timeout to accommodate Render free-tier cold starts.
 */
export const DEFAULT_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly isTimeout: boolean;

  constructor(
    message: string,
    options?: { status?: number; detail?: string; isTimeout?: boolean },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status ?? 0;
    this.detail = options?.detail ?? message;
    this.isTimeout = options?.isTimeout ?? false;
  }
}

interface RequestOptions<TResponse> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  schema: ZodType<TResponse>;
  signal?: AbortSignal;
}

async function requestJson<TResponse>(
  path: string,
  options: RequestOptions<TResponse>,
): Promise<TResponse> {
  const {
    method = "GET",
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    schema,
    signal,
  } = options;

  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsedJson: unknown = null;

    if (rawText) {
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        parsedJson = null;
      }
    }

    if (!response.ok) {
      const detail =
        typeof parsedJson === "object" &&
        parsedJson !== null &&
        "detail" in parsedJson &&
        typeof (parsedJson as { detail: unknown }).detail === "string"
          ? (parsedJson as { detail: string }).detail
          : `Erro na API (HTTP ${response.status}).`;

      throw new ApiError(detail, {
        status: response.status,
        detail,
      });
    }

    const validated = schema.safeParse(parsedJson);
    if (!validated.success) {
      throw new ApiError("Resposta inválida recebida da API.", {
        status: response.status,
        detail: validated.error.issues.map((issue) => issue.message).join("; "),
      });
    }

    return validated.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (timedOut) {
      throw new ApiError(
        "Tempo limite excedido ao conectar com a plataforma (o servidor pode estar iniciando). Tente novamente.",
        { status: 408, isTimeout: true },
      );
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Requisição cancelada.", { status: 0 });
    }

    throw new ApiError(
      "Não foi possível conectar à API do GrantBridge AI. Verifique sua conexão e tente novamente.",
      {
        status: 0,
        detail: error instanceof Error ? error.message : String(error),
      },
    );
  } finally {
    clearTimeout(timer);
    if (signal) {
      signal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export async function getHealth(options?: {
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<HealthResponse> {
  return requestJson("/api/health", {
    method: "GET",
    schema: HealthResponseSchema,
    timeoutMs: options?.timeoutMs,
    signal: options?.signal,
  });
}

export async function getGrants(options?: {
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<GrantsListResponse> {
  return requestJson("/api/grants", {
    method: "GET",
    schema: GrantsListResponseSchema,
    timeoutMs: options?.timeoutMs,
    signal: options?.signal,
  });
}

export async function ingestGrantUrl(
  input: IngestUrlInput,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<IngestUrlResponse> {
  const validatedInput = IngestUrlInputSchema.parse(input);
  return requestJson("/api/ingest-url", {
    method: "POST",
    body: validatedInput,
    schema: IngestUrlResponseSchema,
    timeoutMs: options?.timeoutMs,
    signal: options?.signal,
  });
}

export async function matchOrganization(
  input: MatchRequest,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<MatchResponse> {
  const validatedInput = MatchRequestSchema.parse(input);
  return requestJson("/api/match", {
    method: "POST",
    body: validatedInput,
    schema: MatchResponseSchema,
    timeoutMs: options?.timeoutMs,
    signal: options?.signal,
  });
}

export async function getProposals(
  limit = 10,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<ProposalsListResponse> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return requestJson(`/api/proposals?limit=${safeLimit}`, {
    method: "GET",
    schema: ProposalsListResponseSchema,
    timeoutMs: options?.timeoutMs,
    signal: options?.signal,
  });
}
