"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  Check,
  Clock,
  Compass,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Flame,
  Loader2,
  MessageSquare,
  PlusCircle,
  Radar,
  Recycle,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Trees,
  Waves,
  WifiOff,
} from "lucide-react";

import {
  API_BASE_URL,
  ApiError,
  getGrants,
  getHealth,
  matchOrganization,
} from "@/lib/api";
import {
  MatchRequestSchema,
  type Grant,
  type HealthResponse,
  type MatchResponse,
} from "@/lib/schemas";
import { BrandMark } from "./BrandMark";
import { BrazilGlobeSvg } from "./BrazilGlobeSvg";
import { IngestModal } from "./IngestModal";
import { MatchScoreRing } from "./MatchScoreRing";

const QUICK_PRESETS = [
  {
    id: "manguezais",
    label: "Restauração de Manguezais — BA",
    tag: "Costeiro & Clima",
    icon: "waves" as const,
    text: "Associação comunitária de marisqueiras e pescadores artesanais em Salvador (BA) buscando financiamento para restauração de 18 hectares de manguezais degradados, viveiro comunitário de mudas nativas e monitoramento ambiental participativo com geração de renda verde para 45 famílias.",
  },
  {
    id: "reciclagem",
    label: "Cooperativa de Reciclagem Urbana",
    tag: "Economia Circular",
    icon: "recycle" as const,
    text: "Cooperativa de catadores e catadoras de materiais recicláveis atuando na coleta seletiva solidária e economia circular em bairros periféricos urbanos do Brasil, precisando de equipamentos de triagem, prensa hidráulica e capacitação para aumentar a taxa de reciclagem e reduzir emissões de metano em aterros.",
  },
  {
    id: "agrofloresta",
    label: "Agrofloresta e Bioeconomia — Amazônia",
    tag: "Floresta em Pé",
    icon: "trees" as const,
    text: "Iniciativa comunitária de agrofloresta, sistemas agroflorestais sintrópicos e bioeconomia de floresta em pé na Amazônia brasileira, reunindo 60 pequenos produtores rurais e lideranças locais na recuperação de nascentes e cadeias sustentáveis de açaí, cacau nativo e castanha.",
  },
];

type GrantCategoryFilter =
  | "all"
  | "rolling"
  | "latam"
  | "coastal"
  | "forest"
  | "circular";

const GRANT_FILTERS: { id: GrantCategoryFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "rolling", label: "Fluxo Contínuo" },
  { id: "latam", label: "Brasil / América Latina" },
  { id: "coastal", label: "Costeiro & Marinho" },
  { id: "forest", label: "Floresta & Bioeconomia" },
  { id: "circular", label: "Economia Circular" },
];

type IntegrationState = "loading" | "online" | "warning" | "offline";

interface IntegrationStatusItem {
  key: string;
  label: string;
  detail: string;
  state: IntegrationState;
}

function safeExternalHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    // ignore malformed URLs
  }
  return "#";
}

function matchesCategory(grant: Grant, category: GrantCategoryFilter): boolean {
  if (category === "all") return true;
  const text =
    `${grant.title} ${grant.organization} ${grant.country} ${grant.deadline} ${grant.description}`.toLowerCase();

  switch (category) {
    case "rolling":
      return (
        text.includes("rolling") ||
        text.includes("year-round") ||
        text.includes("contínuo") ||
        text.includes("quarterly")
      );
    case "latam":
      return (
        text.includes("brazil") ||
        text.includes("brasil") ||
        text.includes("latin america") ||
        text.includes("amazon") ||
        text.includes("amazônia")
      );
    case "coastal":
      return (
        text.includes("coastal") ||
        text.includes("marine") ||
        text.includes("mangrove") ||
        text.includes("coral") ||
        text.includes("fish")
      );
    case "forest":
      return (
        text.includes("forest") ||
        text.includes("amazon") ||
        text.includes("agroforestry") ||
        text.includes("bioeconomy") ||
        text.includes("biodiversity")
      );
    case "circular":
      return (
        text.includes("circular") ||
        text.includes("waste") ||
        text.includes("recycl") ||
        text.includes("adaptation")
      );
  }
}

export function GrantBridgeDashboard() {
  // Health state
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Grants Radar state
  const [grants, setGrants] = useState<Grant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [grantsError, setGrantsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<GrantCategoryFilter>("all");

  // Cold-start detection (> 4 seconds on initial load or match)
  const [initialColdStart, setInitialColdStart] = useState(false);
  const [coldStartSeconds, setColdStartSeconds] = useState(0);

  // Match Engine state
  const [ongProfile, setOngProfile] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchSlowNotice, setMatchSlowNotice] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);
  const [copiedProposal, setCopiedProposal] = useState(false);

  // Firecrawl Modal state
  const [ingestModalOpen, setIngestModalOpen] = useState(false);

  const resultRef = useRef<HTMLDivElement | null>(null);

  const fetchAllInitialData = useCallback(async () => {
    setHealthLoading(true);
    setGrantsLoading(true);
    setHealthError(null);
    setGrantsError(null);
    setInitialColdStart(false);
    setColdStartSeconds(0);

    const startedAt = Date.now();
    const slowTimer = window.setTimeout(() => {
      setInitialColdStart(true);
    }, 4000);
    const tickInterval = window.setInterval(() => {
      setColdStartSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    const [healthOutcome, grantsOutcome] = await Promise.allSettled([
      getHealth(),
      getGrants(),
    ]);

    window.clearTimeout(slowTimer);
    window.clearInterval(tickInterval);
    setInitialColdStart(false);

    if (healthOutcome.status === "fulfilled") {
      setHealth(healthOutcome.value);
      setHealthError(null);
    } else {
      setHealth(null);
      const err = healthOutcome.reason;
      setHealthError(
        err instanceof ApiError
          ? err.detail || err.message
          : "Não foi possível consultar /api/health.",
      );
    }
    setHealthLoading(false);

    if (grantsOutcome.status === "fulfilled") {
      setGrants(grantsOutcome.value.grants);
      setGrantsError(null);
    } else {
      const err = grantsOutcome.reason;
      setGrantsError(
        err instanceof ApiError
          ? err.detail || err.message
          : "Não foi possível carregar os editais do Neon PostgreSQL.",
      );
    }
    setGrantsLoading(false);
  }, []);

  const refreshGrantsOnly = useCallback(async () => {
    setGrantsLoading(true);
    setGrantsError(null);
    try {
      const data = await getGrants();
      setGrants(data.grants);
    } catch (err) {
      setGrantsError(
        err instanceof ApiError
          ? err.detail || err.message
          : "Falha ao atualizar lista de editais.",
      );
    } finally {
      setGrantsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllInitialData();
  }, [fetchAllInitialData]);

  // Derive honest integration status items strictly from GET /api/health
  const integrationStatuses: IntegrationStatusItem[] = useMemo(() => {
    if (healthLoading) {
      return [
        { key: "neon", label: "Neon DB", detail: "Verificando...", state: "loading" },
        { key: "firecrawl", label: "Firecrawl v2", detail: "Verificando...", state: "loading" },
        { key: "gemini", label: "Gemini 2.5", detail: "Verificando...", state: "loading" },
        { key: "nvoip", label: "Nvoip v3", detail: "Verificando...", state: "loading" },
      ];
    }

    if (!health) {
      return [
        { key: "neon", label: "Neon DB", detail: "Offline", state: "offline" },
        { key: "firecrawl", label: "Firecrawl v2", detail: "Offline", state: "offline" },
        { key: "gemini", label: "Gemini 2.5", detail: "Offline", state: "offline" },
        { key: "nvoip", label: "Nvoip v3", detail: "Offline", state: "offline" },
      ];
    }

    const { neon_postgresql, firecrawl_v2, gemini_ai, nvoip_v3 } =
      health.integrations;

    const neonState: IntegrationState =
      neon_postgresql.connected && neon_postgresql.status === "ok"
        ? "online"
        : neon_postgresql.status === "not_configured"
          ? "warning"
          : "offline";

    const firecrawlState: IntegrationState =
      firecrawl_v2.configured && firecrawl_v2.status === "ready"
        ? "online"
        : "offline";

    const geminiState: IntegrationState =
      gemini_ai.configured && gemini_ai.status === "ready"
        ? "online"
        : "offline";

    const nvoipState: IntegrationState =
      nvoip_v3.configured && nvoip_v3.status === "ready"
        ? "online"
        : "offline";

    return [
      {
        key: "neon",
        label: "Neon DB",
        detail:
          neonState === "online"
            ? "Conectado"
            : neonState === "warning"
              ? "Fallback"
              : "Offline",
        state: neonState,
      },
      {
        key: "firecrawl",
        label: "Firecrawl v2",
        detail: firecrawlState === "online" ? "Pronto" : "Indisponível",
        state: firecrawlState,
      },
      {
        key: "gemini",
        label: "Gemini 2.5",
        detail:
          geminiState === "online"
            ? gemini_ai.model || "Ativo"
            : "Indisponível",
        state: geminiState,
      },
      {
        key: "nvoip",
        label: "Nvoip v3",
        detail: nvoipState === "online" ? "Ativo" : "Indisponível",
        state: nvoipState,
      },
    ];
  }, [health, healthLoading]);

  const filteredGrants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return grants.filter((grant) => {
      if (!matchesCategory(grant, activeFilter)) return false;
      if (!query) return true;
      const haystack =
        `${grant.title} ${grant.organization} ${grant.country} ${grant.description} ${grant.funding_amount} ${grant.deadline}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [grants, searchQuery, activeFilter]);

  async function handleRunMatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMatchError(null);

    const parsed = MatchRequestSchema.safeParse({
      ong_profile: ongProfile,
      whatsapp_phone: whatsappPhone,
    });

    if (!parsed.success) {
      setMatchError(
        parsed.error.issues[0]?.message ||
          "Revise os campos antes de calcular o match.",
      );
      return;
    }

    setMatchLoading(true);
    setMatchSlowNotice(false);
    setPipelineLogs([
      "Validando perfil da organização com Zod...",
      `Consultando editais reais no Neon PostgreSQL (${API_BASE_URL})...`,
      "Calculando Match Score e redigindo Project Concept Note em inglês com Gemini 2.5 Flash...",
      ...(parsed.data.whatsapp_phone
        ? [`Acionando alerta Nvoip v3 para ${parsed.data.whatsapp_phone}...`]
        : []),
    ]);

    const slowTimer = window.setTimeout(() => {
      setMatchSlowNotice(true);
    }, 4000);

    try {
      const response = await matchOrganization(parsed.data);
      setMatchResult(response);
      setPipelineLogs((prev) => [
        ...prev,
        `Match concluído (${response.match_score}%)! Proposta #${response.proposal_id} persistida no Neon DB.`,
      ]);
      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail || err.message
          : "Erro inesperado ao executar o motor de match.";
      setMatchError(msg);
      setPipelineLogs((prev) => [...prev, `Erro: ${msg}`]);
    } finally {
      window.clearTimeout(slowTimer);
      setMatchLoading(false);
      setMatchSlowNotice(false);
    }
  }

  async function handleCopyProposal() {
    if (!matchResult?.generated_proposal_en) return;
    try {
      await navigator.clipboard.writeText(matchResult.generated_proposal_en);
      setCopiedProposal(true);
      window.setTimeout(() => setCopiedProposal(false), 2000);
    } catch {
      setMatchError(
        "Não foi possível copiar automaticamente. Selecione o texto manualmente.",
      );
    }
  }

  function handleDownloadProposal(extension: "md" | "txt") {
    if (!matchResult?.generated_proposal_en) return;
    const slug = matchResult.matched_grant.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const mime =
      extension === "md"
        ? "text/markdown;charset=utf-8"
        : "text/plain;charset=utf-8";
    const blob = new Blob([matchResult.generated_proposal_en], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `GrantBridge-Concept-Note-${slug || "proposal"}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function renderPresetIcon(icon: "waves" | "recycle" | "trees") {
    if (icon === "waves") return <Waves className="w-4 h-4 text-[#57DCA0]" />;
    if (icon === "recycle")
      return <Recycle className="w-4 h-4 text-[#57DCA0]" />;
    return <Trees className="w-4 h-4 text-[#57DCA0]" />;
  }

  function renderStatusDot(state: IntegrationState) {
    if (state === "loading") {
      return (
        <span className="w-2 h-2 rounded-full bg-[#E7BD71] animate-pulse shrink-0" />
      );
    }
    if (state === "online") {
      return (
        <span className="w-2 h-2 rounded-full bg-[#20BD80] shadow-[0_0_8px_#20BD80] shrink-0" />
      );
    }
    if (state === "warning") {
      return <span className="w-2 h-2 rounded-full bg-[#E7BD71] shrink-0" />;
    }
    return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />;
  }

  function getNvoipBadgeStyle(status: string) {
    if (status === "sent") {
      return {
        label: "ENVIADO",
        className:
          "bg-[#20BD80]/20 text-[#57DCA0] border border-[#20BD80]/40",
      };
    }
    if (status === "skipped") {
      return {
        label: "OPCIONAL",
        className: "bg-[#050B08] text-[#8EA396] border border-[#1A2F24]",
      };
    }
    return {
      label: "FALLBACK SEGURO",
      className:
        "bg-[#E7BD71]/15 text-[#E7BD71] border border-[#E7BD71]/35",
    };
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#050B08] text-[#F3F7F4]">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#1A2F24] bg-[#050B08]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tight text-[#F3F7F4]">
                  GrantBridge{" "}
                  <span className="text-[#57DCA0]">AI</span>
                </span>
                <span className="hidden sm:inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0B1611] border border-[#1A2F24] text-[#57DCA0]">
                  Hack Brasil 2026
                </span>
              </div>
              <p className="text-[11px] text-[#8EA396] hidden sm:block">
                Meio Ambiente &amp; Economia Verde
              </p>
            </div>
          </div>

          {/* Live Health Integrations Bar (GET /api/health) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0B1611] border border-[#1A2F24]">
              {integrationStatuses.map((item) => (
                <div
                  key={item.key}
                  title={`${item.label}: ${item.detail}`}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#050B08]/80 border border-[#1A2F24]/80 text-[11px] font-mono"
                >
                  {renderStatusDot(item.state)}
                  <span className="text-[#F3F7F4]">{item.label}</span>
                  <span
                    className={
                      item.state === "online"
                        ? "text-[#57DCA0]"
                        : item.state === "warning" || item.state === "loading"
                          ? "text-[#E7BD71]"
                          : "text-red-400"
                    }
                  >
                    {item.detail}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void fetchAllInitialData()}
              disabled={healthLoading || grantsLoading}
              title="Atualizar status da API e editais"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8EA396] hover:text-[#F3F7F4] bg-[#0B1611] border border-[#1A2F24] hover:border-[#20BD80]/50 px-3 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${healthLoading || grantsLoading ? "animate-spin text-[#57DCA0]" : ""}`}
              />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>

            <button
              type="button"
              onClick={() => setIngestModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-display font-bold bg-[#20BD80] hover:bg-[#29D18F] text-[#050B08] px-3.5 py-2 rounded-xl transition cursor-pointer shadow-[0_8px_24px_-10px_rgba(32,189,128,0.65)]"
            >
              <Flame className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Adicionar Edital (Firecrawl)</span>
              <span className="md:hidden">+ Edital</span>
            </button>
          </div>
        </div>

        {/* Compact Integration Pills on Mobile/Tablet */}
        <div className="xl:hidden border-t border-[#1A2F24]/70 px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto gb-scroll">
          {integrationStatuses.map((item) => (
            <div
              key={item.key}
              className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-[#0B1611] border border-[#1A2F24] text-[11px] font-mono"
            >
              {renderStatusDot(item.state)}
              <span className="text-[#F3F7F4]">{item.label}:</span>
              <span
                className={
                  item.state === "online"
                    ? "text-[#57DCA0]"
                    : item.state === "warning" || item.state === "loading"
                      ? "text-[#E7BD71]"
                      : "text-red-400"
                }
              >
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* Cold-Start Friendly Banner (shown when initial Render request takes > 4s) */}
      {initialColdStart && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-2xl bg-[#0B1611] border border-[#E7BD71]/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-[#E7BD71]">
              <Clock className="w-4 h-4 shrink-0 animate-pulse" />
              <span>
                <strong className="text-[#F3F7F4]">
                  Acordando o servidor no Render...
                </strong>{" "}
                A primeira requisição no plano gratuito pode levar cerca de 30 a
                50 segundos. Aguarde enquanto conectamos ao Neon PostgreSQL.
              </span>
            </div>
            <span className="font-mono text-[#E7BD71] shrink-0">
              {coldStartSeconds}s
            </span>
          </div>
        </div>
      )}

      {/* Backend Unreachable Banner (never fakes online state) */}
      {!healthLoading && healthError && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-2xl bg-red-950/35 border border-red-500/35 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-red-200">
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                <strong>API temporariamente indisponível:</strong> {healthError}{" "}
                (<code className="font-mono text-red-100">{API_BASE_URL}</code>)
              </span>
            </div>
            <button
              type="button"
              onClick={() => void fetchAllInitialData()}
              className="font-mono text-[11px] underline text-red-100 hover:text-white cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Hero Section with Vector Globe SVG */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="gb-card rounded-3xl p-6 sm:p-8 lg:p-10 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#050B08] border border-[#1A2F24] text-[11px] font-mono text-[#57DCA0]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#20BD80]" />
                <span>Ponte Inteligente • Financiamento Climático Global</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.1] text-[#F3F7F4]">
                Conecte iniciativas ambientais brasileiras a{" "}
                <span className="text-[#57DCA0]">
                  fundos climáticos internacionais.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-[#8EA396] max-w-2xl leading-relaxed">
                Raspamos editais globais ao vivo com{" "}
                <strong className="text-[#F3F7F4]">Firecrawl v2</strong>,
                calculamos o{" "}
                <strong className="text-[#57DCA0]">Match Score</strong> real com
                sua ONG ou cooperativa, redigimos a{" "}
                <strong className="text-[#F3F7F4]">
                  Project Concept Note em inglês
                </strong>{" "}
                via Gemini 2.5 Flash e disparamos alerta no celular via Nvoip
                v3.
              </p>

              {/* Telemetry Strip */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-2xl bg-[#050B08]/90 border border-[#1A2F24] p-3.5">
                  <div className="flex items-center justify-between text-[#57DCA0] mb-1.5">
                    <Database className="w-4 h-4" />
                    <span className="font-mono text-[10px] uppercase text-[#8EA396]">
                      Neon DB
                    </span>
                  </div>
                  <div className="font-display text-2xl sm:text-3xl font-bold text-[#F3F7F4]">
                    {grantsLoading ? (
                      <span className="text-[#8EA396]">—</span>
                    ) : (
                      grants.length
                    )}
                  </div>
                  <p className="text-[11px] text-[#8EA396] mt-0.5">
                    Editais Reais
                  </p>
                </div>

                <div className="rounded-2xl bg-[#050B08]/90 border border-[#1A2F24] p-3.5">
                  <div className="flex items-center justify-between text-[#E7BD71] mb-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-mono text-[10px] uppercase text-[#8EA396]">
                      Gemini
                    </span>
                  </div>
                  <div className="font-display text-2xl sm:text-3xl font-bold text-[#E7BD71]">
                    PT→EN
                  </div>
                  <p className="text-[11px] text-[#8EA396] mt-0.5">
                    Concept Note
                  </p>
                </div>

                <div className="rounded-2xl bg-[#050B08]/90 border border-[#1A2F24] p-3.5">
                  <div className="flex items-center justify-between text-[#57DCA0] mb-1.5">
                    <MessageSquare className="w-4 h-4" />
                    <span className="font-mono text-[10px] uppercase text-[#8EA396]">
                      Nvoip v3
                    </span>
                  </div>
                  <div className="font-display text-2xl sm:text-3xl font-bold text-[#57DCA0]">
                    SMS
                  </div>
                  <p className="text-[11px] text-[#8EA396] mt-0.5">
                    Alerta Direto
                  </p>
                </div>
              </div>
            </div>

            {/* Vector Globe SVG */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <BrazilGlobeSvg
                activeGrantsCount={grantsLoading ? null : grants.length}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Column: NGO Diagnosis & Match Form */}
        <section className="lg:col-span-5 space-y-6">
          <div className="gb-card rounded-3xl p-6 sm:p-7">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h2 className="font-display text-xl font-bold text-[#F3F7F4] flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#57DCA0]" />
                Diagnóstico da Organização
              </h2>
              <span className="font-mono text-[11px] text-[#57DCA0] bg-[#050B08] border border-[#1A2F24] px-2.5 py-0.5 rounded-full">
                POST /api/match
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#8EA396] mb-5 leading-relaxed">
              Descreva em português a atuação da sua ONG, cooperativa ou projeto
              comunitário no Brasil para encontrar o edital mais aderente.
            </p>

            {/* 3 Quick-Fill Presets */}
            <div className="mb-5">
              <span className="block font-mono text-[11px] uppercase tracking-wider text-[#8EA396] mb-2">
                Preenchimento Rápido (1 clique)
              </span>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setOngProfile(preset.text);
                      setMatchError(null);
                    }}
                    className="group text-left bg-[#050B08] hover:bg-[#20BD80]/10 border border-[#1A2F24] hover:border-[#20BD80]/60 rounded-xl px-3.5 py-2.5 transition flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {renderPresetIcon(preset.icon)}
                      <span className="text-xs font-medium text-[#F3F7F4] truncate">
                        {preset.label}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-[#8EA396] group-hover:text-[#57DCA0] shrink-0">
                      {preset.tag} →
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleRunMatch} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="ong-profile-textarea"
                    className="text-xs font-medium text-[#F3F7F4]"
                  >
                    Perfil e Objetivos da Iniciativa Ambiental
                  </label>
                  <span className="font-mono text-[11px] text-[#8EA396]">
                    {ongProfile.length}/4000
                  </span>
                </div>
                <textarea
                  id="ong-profile-textarea"
                  rows={5}
                  maxLength={4000}
                  value={ongProfile}
                  onChange={(e) => setOngProfile(e.target.value)}
                  disabled={matchLoading}
                  placeholder="Ex: Somos uma associação comunitária de marisqueiras e pescadores em Salvador (BA) buscando recursos para restauração de manguezais e monitoramento participativo..."
                  className="w-full rounded-2xl bg-[#050B08] border border-[#1A2F24] p-3.5 text-sm text-[#F3F7F4] placeholder:text-[#8EA396]/60 focus:outline-none focus:border-[#20BD80] focus:ring-2 focus:ring-[#20BD80]/20 transition resize-y"
                />
              </div>

              {/* WhatsApp / SMS Nvoip Field */}
              <div className="rounded-2xl bg-[#050B08] border border-[#1A2F24] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label
                    htmlFor="whatsapp-phone-input"
                    className="text-xs font-medium text-[#F3F7F4] flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-[#E7BD71]" />
                    Telefone / WhatsApp com DDD (opcional)
                  </label>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#E7BD71]/12 text-[#E7BD71] border border-[#E7BD71]/30">
                    Alerta Nvoip v3
                  </span>
                </div>
                <input
                  id="whatsapp-phone-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={30}
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  disabled={matchLoading}
                  placeholder="Ex: 71999999999"
                  className="w-full rounded-xl bg-[#0B1611] border border-[#1A2F24] px-3.5 py-2.5 text-sm font-mono text-[#F3F7F4] placeholder:text-[#8EA396]/60 focus:outline-none focus:border-[#E7BD71]/70 transition"
                />
              </div>

              {matchError && (
                <div className="rounded-xl bg-red-950/45 border border-red-500/35 p-3 text-xs text-red-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{matchError}</span>
                </div>
              )}

              {matchSlowNotice && matchLoading && (
                <div className="rounded-xl bg-[#050B08] border border-[#E7BD71]/40 p-3 text-xs text-[#E7BD71] flex items-start gap-2">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
                  <span>
                    O backend no Render pode estar saindo do modo de suspensão
                    (cold start ~30–50s) enquanto o Gemini 2.5 Flash redige sua
                    proposta em inglês.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={matchLoading}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#20BD80] hover:bg-[#29D18F] active:scale-[0.99] text-[#050B08] font-display font-bold text-sm transition shadow-[0_12px_28px_-12px_rgba(32,189,128,0.6)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {matchLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Calculando Match e Redigindo Proposta...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Calcular Match + Redigir Proposta em Inglês</span>
                  </>
                )}
              </button>
            </form>

            {/* Pipeline Terminal Log */}
            {pipelineLogs.length > 0 && (
              <div className="mt-4 rounded-2xl bg-[#050B08] border border-[#1A2F24] p-3.5 font-mono text-[11px] text-[#57DCA0] space-y-1.5">
                {pipelineLogs.map((line, index) => (
                  <div key={`${index}-${line}`} className="leading-relaxed">
                    <span className="text-[#8EA396] mr-1.5">&gt;</span>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Winning Match Dossier + Live Grants Radar */}
        <section className="lg:col-span-7 space-y-7">
          {/* Match Result Dossier (Real POST /api/match) */}
          {matchResult && (
            <div
              ref={resultRef}
              className="gb-card rounded-3xl p-6 sm:p-7 border border-[#20BD80]/45"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#1A2F24]">
                <div className="space-y-1.5 flex-1 min-w-[220px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wider bg-[#20BD80]/20 text-[#57DCA0] border border-[#20BD80]/40 px-2.5 py-0.5 rounded-full">
                      <Award className="w-3.5 h-3.5" />
                      Edital Vencedor
                    </span>
                    <span className="font-mono text-[11px] text-[#8EA396]">
                      Motor: {matchResult.ai_mode}
                    </span>
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F3F7F4] leading-snug">
                    {matchResult.matched_grant.title}
                  </h2>
                  <p className="text-xs text-[#57DCA0] font-medium">
                    {matchResult.matched_grant.organization} •{" "}
                    {matchResult.matched_grant.country} • Prazo:{" "}
                    {matchResult.matched_grant.deadline}
                  </p>
                </div>

                {/* Circular Green Match Score + Gold Funding Amount */}
                <div className="flex items-center gap-3.5 bg-[#050B08] border border-[#1A2F24] rounded-2xl px-4 py-3 shrink-0">
                  <MatchScoreRing score={matchResult.match_score} />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#8EA396]">
                      Financiamento
                    </div>
                    <div className="font-display font-bold text-sm text-[#E7BD71] mt-0.5">
                      {matchResult.matched_grant.funding_amount}
                    </div>
                    <a
                      href={safeExternalHref(
                        matchResult.matched_grant.source_url,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#57DCA0] hover:underline mt-1"
                    >
                      <span>Portal Oficial</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Reasoning (PT-BR) + Nvoip Notification Status */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 my-4">
                <div className="sm:col-span-7 rounded-2xl bg-[#050B08] border border-[#1A2F24] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#57DCA0] mb-1.5">
                    Por que este edital?
                  </div>
                  <p className="text-xs sm:text-sm text-[#F3F7F4]/90 leading-relaxed">
                    {matchResult.match_reasoning_pt}
                  </p>
                </div>

                <div className="sm:col-span-5 rounded-2xl bg-[#050B08] border border-[#1A2F24] p-4 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#E7BD71]">
                      Alerta Nvoip v3
                    </span>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${getNvoipBadgeStyle(matchResult.notification.status).className}`}
                    >
                      {getNvoipBadgeStyle(matchResult.notification.status).label}
                    </span>
                  </div>
                  <p className="text-xs text-[#8EA396] leading-snug">
                    {matchResult.notification.detail}
                  </p>
                  {matchResult.notification.phone && (
                    <span className="font-mono text-[11px] text-[#F3F7F4]">
                      Destino: +{matchResult.notification.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* English Concept Note Viewer + Copy / .MD / .TXT Actions */}
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#57DCA0]" />
                    <h3 className="font-display font-semibold text-sm text-[#F3F7F4]">
                      Project Concept Note (Pronta em Inglês)
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyProposal()}
                      className="inline-flex items-center gap-1.5 text-xs font-display font-bold bg-[#20BD80] hover:bg-[#29D18F] text-[#050B08] px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      {copiedProposal ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadProposal("md")}
                      className="inline-flex items-center gap-1.5 text-xs font-mono bg-[#050B08] hover:bg-[#1A2F24]/60 text-[#F3F7F4] border border-[#1A2F24] hover:border-[#20BD80]/50 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#57DCA0]" />
                      <span>.MD</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadProposal("txt")}
                      className="inline-flex items-center gap-1.5 text-xs font-mono bg-[#050B08] hover:bg-[#1A2F24]/60 text-[#F3F7F4] border border-[#1A2F24] hover:border-[#20BD80]/50 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-[#57DCA0]" />
                      <span>.TXT</span>
                    </button>
                  </div>
                </div>

                <pre className="gb-scroll max-h-[430px] overflow-y-auto rounded-2xl bg-[#050B08] border border-[#1A2F24] p-5 text-xs sm:text-[13px] text-[#F3F7F4]/95 whitespace-pre-wrap font-mono leading-relaxed">
                  {matchResult.generated_proposal_en}
                </pre>
              </div>
            </div>
          )}

          {/* Live Grants Radar (Real GET /api/grants) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-[#F3F7F4] flex items-center gap-2">
                  <Radar className="w-5 h-5 text-[#57DCA0]" />
                  Radar de Editais Internacionais
                </h2>
                <p className="text-xs text-[#8EA396] mt-0.5">
                  Dados ao vivo do Neon PostgreSQL • atualizáveis via Firecrawl
                  v2.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIngestModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#0B1611] hover:bg-[#20BD80]/12 text-[#57DCA0] border border-[#1A2F24] hover:border-[#20BD80]/50 px-3.5 py-2 rounded-xl transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Adicionar via URL (Firecrawl)</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#8EA396] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por fundo, bioma, país ou palavra-chave (ex: mangrove, UNDP, Amazon)..."
                className="w-full rounded-xl bg-[#0B1611] border border-[#1A2F24] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#F3F7F4] placeholder:text-[#8EA396]/70 focus:outline-none focus:border-[#20BD80] transition"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {GRANT_FILTERS.map((filter) => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-mono transition cursor-pointer border ${
                      isActive
                        ? "bg-[#20BD80] text-[#050B08] border-[#20BD80] font-semibold"
                        : "bg-[#0B1611] text-[#8EA396] border-[#1A2F24] hover:border-[#20BD80]/50 hover:text-[#F3F7F4]"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {/* Grants List States */}
            {grantsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="gb-card rounded-2xl p-5 animate-pulse space-y-3"
                  >
                    <div className="flex justify-between gap-4">
                      <div className="h-4 w-2/3 rounded bg-[#1A2F24]" />
                      <div className="h-5 w-24 rounded-full bg-[#1A2F24]" />
                    </div>
                    <div className="h-3 w-full rounded bg-[#1A2F24]/70" />
                    <div className="h-3 w-5/6 rounded bg-[#1A2F24]/50" />
                  </div>
                ))}
              </div>
            ) : grantsError ? (
              <div className="gb-card rounded-2xl p-6 text-center space-y-3 border border-red-500/30">
                <AlertTriangle className="w-6 h-6 text-red-400 mx-auto" />
                <div className="text-sm font-medium text-[#F3F7F4]">
                  Não foi possível carregar os editais do Render
                </div>
                <p className="text-xs text-[#8EA396] max-w-md mx-auto">
                  {grantsError}
                </p>
                <button
                  type="button"
                  onClick={() => void refreshGrantsOnly()}
                  className="inline-flex items-center gap-1.5 text-xs font-display font-bold bg-[#20BD80] hover:bg-[#29D18F] text-[#050B08] px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar carregar novamente</span>
                </button>
              </div>
            ) : filteredGrants.length === 0 ? (
              <div className="gb-card rounded-2xl p-6 text-center space-y-2">
                <p className="text-sm text-[#F3F7F4] font-medium">
                  Nenhum edital encontrado para os filtros aplicados.
                </p>
                <p className="text-xs text-[#8EA396]">
                  Limpe a busca ou raspe um novo edital internacional com o
                  Firecrawl v2.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredGrants.map((grant) => {
                  const isWinner = matchResult?.matched_grant.id === grant.id;
                  return (
                    <article
                      key={grant.id}
                      className={`gb-card rounded-2xl p-5 transition duration-200 hover:border-[#20BD80]/55 ${
                        isWinner
                          ? "border-[#57DCA0] ring-1 ring-[#20BD80]/40"
                          : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
                            <span className="text-[#57DCA0]">
                              {grant.organization}
                            </span>
                            <span className="text-[#1A2F24]">•</span>
                            <span className="text-[#8EA396]">
                              {grant.country}
                            </span>
                          </div>
                          <h3 className="font-display text-base font-bold text-[#F3F7F4] mt-0.5 leading-snug">
                            {grant.title}
                          </h3>
                        </div>

                        {isWinner ? (
                          <span className="font-mono text-[11px] font-semibold bg-[#20BD80]/20 text-[#57DCA0] border border-[#20BD80]/45 px-2.5 py-1 rounded-full shrink-0">
                            ★ Melhor Match ({matchResult.match_score}%)
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] font-semibold bg-[#E7BD71]/12 text-[#E7BD71] border border-[#E7BD71]/30 px-2.5 py-1 rounded-full shrink-0">
                            {grant.funding_amount}
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-[#8EA396] leading-relaxed mb-4">
                        {grant.description}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1A2F24] text-xs">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#8EA396]">
                          <span>
                            Valor:{" "}
                            <strong className="text-[#E7BD71] font-mono">
                              {grant.funding_amount}
                            </strong>
                          </span>
                          <span>
                            Prazo:{" "}
                            <span className="text-[#F3F7F4]">
                              {grant.deadline}
                            </span>
                          </span>
                        </div>

                        <a
                          href={safeExternalHref(grant.source_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#57DCA0] hover:text-[#20BD80] font-medium transition"
                        >
                          <span>Portal Oficial</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1A2F24] py-6 text-xs text-[#8EA396]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            GrantBridge AI • Hack Brasil 2026 (Meio Ambiente &amp; Economia
            Verde)
          </span>
          <span className="font-mono text-[11px] text-[#8EA396]">
            Next.js + Zod • FastAPI Render • Neon PostgreSQL • Firecrawl v2 •
            Gemini 2.5 Flash • Nvoip v3
          </span>
        </div>
      </footer>

      {/* Live Firecrawl v2 URL Ingestion Modal */}
      <IngestModal
        open={ingestModalOpen}
        onClose={() => setIngestModalOpen(false)}
        onGrantIngested={() => {
          void refreshGrantsOnly();
        }}
      />
    </div>
  );
}
