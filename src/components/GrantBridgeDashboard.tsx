"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  Check,
  Clock,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Globe2,
  Loader2,
  MessageSquare,
  Plus,
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

type ServiceState = "loading" | "online" | "warning" | "offline";

interface ServiceStatusItem {
  key: string;
  label: string;
  state: ServiceState;
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
  // Real health status from GET /api/health
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Real grants from GET /api/grants
  const [grants, setGrants] = useState<Grant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [grantsError, setGrantsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<GrantCategoryFilter>("all");

  // Cold-start detection (> 4 seconds)
  const [initialColdStart, setInitialColdStart] = useState(false);
  const [coldStartSeconds, setColdStartSeconds] = useState(0);

  // Match engine state
  const [ongProfile, setOngProfile] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchSlowNotice, setMatchSlowNotice] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);
  const [copiedProposal, setCopiedProposal] = useState(false);

  // Add Grant modal state
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
          : "Não foi possível verificar o status da plataforma.",
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
          : "Não foi possível carregar os editais no momento.",
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
          : "Falha ao atualizar a lista de editais.",
      );
    } finally {
      setGrantsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllInitialData();
  }, [fetchAllInitialData]);

  // User-facing service indicators backed strictly by real GET /api/health data
  const serviceStatuses: ServiceStatusItem[] = useMemo(() => {
    if (healthLoading) {
      return [
        { key: "radar", label: "Verificando Radar...", state: "loading" },
        { key: "analysis", label: "Verificando Análise...", state: "loading" },
        { key: "alerts", label: "Verificando Alertas...", state: "loading" },
      ];
    }

    if (!health) {
      return [
        { key: "radar", label: "Radar Climático Offline", state: "offline" },
        { key: "analysis", label: "Análise Indisponível", state: "offline" },
        { key: "alerts", label: "Alertas Indisponíveis", state: "offline" },
      ];
    }

    const { neon_postgresql, firecrawl_v2, gemini_ai, nvoip_v3 } =
      health.integrations;

    const dbReady =
      neon_postgresql.connected && neon_postgresql.status === "ok";
    const scrapingReady =
      firecrawl_v2.configured && firecrawl_v2.status === "ready";
    const radarState: ServiceState =
      dbReady && scrapingReady
        ? "online"
        : dbReady || neon_postgresql.status === "not_configured"
          ? "warning"
          : "offline";

    const analysisState: ServiceState =
      gemini_ai.configured && gemini_ai.status === "ready"
        ? "online"
        : "offline";

    const alertsState: ServiceState =
      nvoip_v3.configured && nvoip_v3.status === "ready"
        ? "online"
        : "offline";

    return [
      {
        key: "radar",
        label:
          radarState === "online"
            ? "Radar Climático Online"
            : radarState === "warning"
              ? "Radar em Modo Parcial"
              : "Radar Climático Offline",
        state: radarState,
      },
      {
        key: "analysis",
        label:
          analysisState === "online"
            ? "Análise Inteligente Ativa"
            : "Análise Indisponível",
        state: analysisState,
      },
      {
        key: "alerts",
        label:
          alertsState === "online"
            ? "Alertas Habilitados"
            : "Alertas Indisponíveis",
        state: alertsState,
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
          "Revise os campos antes de buscar oportunidades.",
      );
      return;
    }

    setMatchLoading(true);
    setMatchSlowNotice(false);
    setPipelineLogs([
      "Analisando o perfil da sua organização...",
      "Consultando oportunidades climáticas internacionais no radar...",
      "Calculando compatibilidade e redigindo proposta técnica em inglês...",
      ...(parsed.data.whatsapp_phone
        ? [`Preparando alerta para o celular ${parsed.data.whatsapp_phone}...`]
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
        `Compatibilidade calculada (${response.match_score}%)! Sua proposta técnica em inglês está pronta.`,
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
          : "Erro inesperado ao calcular a compatibilidade.";
      setMatchError(msg);
      setPipelineLogs((prev) => [...prev, `Não foi possível concluir: ${msg}`]);
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
    if (icon === "waves")
      return <Waves className="w-4 h-4 text-[#57DCA0] shrink-0" />;
    if (icon === "recycle")
      return <Recycle className="w-4 h-4 text-[#57DCA0] shrink-0" />;
    return <Trees className="w-4 h-4 text-[#57DCA0] shrink-0" />;
  }

  function renderStatusDot(state: ServiceState) {
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

  function getAlertDisplay(status: string) {
    if (status === "sent") {
      return {
        badge: "ENVIADO",
        className:
          "bg-[#20BD80]/20 text-[#57DCA0] border border-[#20BD80]/40",
        message: "Alerta enviado para o seu celular.",
      };
    }
    if (status === "skipped") {
      return {
        badge: "OPCIONAL",
        className: "bg-[#050B08] text-[#8EA396] border border-[#1A2F24]",
        message: "Nenhum telefone informado para notificação.",
      };
    }
    return {
      badge: "REGISTRADO",
      className:
        "bg-[#E7BD71]/15 text-[#E7BD71] border border-[#E7BD71]/35",
      message:
        "Alerta registrado com sucesso (disparo em modo de demonstração).",
    };
  }

  const isRefreshing = healthLoading || grantsLoading;

  return (
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col bg-[#050B08] text-[#F3F7F4]">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#1A2F24] bg-[#050B08]/92 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <BrandMark className="w-9 h-9 sm:w-10 sm:h-10" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base sm:text-lg tracking-tight text-[#F3F7F4] whitespace-nowrap">
                  GrantBridge{" "}
                  <span className="text-[#57DCA0]">AI</span>
                </span>
                <span className="hidden md:inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0B1611] border border-[#1A2F24] text-[#57DCA0] whitespace-nowrap">
                  Hack Brasil 2026
                </span>
              </div>
              <p className="text-[11px] text-[#8EA396] hidden sm:block truncate">
                Meio Ambiente &amp; Economia Verde
              </p>
            </div>
          </div>

          {/* Actions + Desktop Status Pills */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0B1611] border border-[#1A2F24]">
              {serviceStatuses.map((item) => (
                <div
                  key={item.key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#050B08]/80 border border-[#1A2F24]/80 text-[11px] font-medium whitespace-nowrap"
                >
                  {renderStatusDot(item.state)}
                  <span
                    className={
                      item.state === "online"
                        ? "text-[#F3F7F4]"
                        : item.state === "warning" || item.state === "loading"
                          ? "text-[#E7BD71]"
                          : "text-red-300"
                    }
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Compact Icon-Only Reload Button */}
            <button
              type="button"
              onClick={() => void fetchAllInitialData()}
              disabled={isRefreshing}
              title="Atualizar dados do radar"
              aria-label="Atualizar dados do radar"
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl bg-[#0B1611] border border-[#1A2F24] hover:border-[#20BD80]/55 text-[#8EA396] hover:text-[#57DCA0] transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw
                className={`w-4 h-4 transition-transform ${isRefreshing ? "animate-spin text-[#57DCA0]" : ""}`}
              />
            </button>

            <button
              type="button"
              onClick={() => setIngestModalOpen(true)}
              className="min-h-[40px] inline-flex items-center gap-1.5 text-xs font-display font-bold bg-[#20BD80] hover:bg-[#29D18F] text-[#050B08] px-3 sm:px-4 py-2 rounded-xl transition cursor-pointer shadow-[0_8px_24px_-10px_rgba(32,189,128,0.65)] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Adicionar Edital</span>
            </button>
          </div>
        </div>

        {/* Compact Status Pills on Mobile / Tablet */}
        <div className="xl:hidden border-t border-[#1A2F24]/70 px-4 sm:px-6 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-1.5">
            {serviceStatuses.map((item) => (
              <div
                key={item.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B1611] border border-[#1A2F24] text-[11px] font-medium whitespace-nowrap"
              >
                {renderStatusDot(item.state)}
                <span
                  className={
                    item.state === "online"
                      ? "text-[#F3F7F4]"
                      : item.state === "warning" || item.state === "loading"
                        ? "text-[#E7BD71]"
                        : "text-red-300"
                  }
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Friendly Cold-Start Banner (> 4s on initial load) */}
      {initialColdStart && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-2xl bg-[#0B1611] border border-[#E7BD71]/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-start sm:items-center gap-2.5 text-[#E7BD71] min-w-0 flex-1">
              <Clock className="w-4 h-4 shrink-0 animate-pulse mt-0.5 sm:mt-0" />
              <span className="break-words">
                <strong className="text-[#F3F7F4]">
                  Iniciando o servidor da plataforma...
                </strong>{" "}
                A primeira consulta pode levar de 30 a 50 segundos enquanto
                carregamos o radar de oportunidades climáticas.
              </span>
            </div>
            <span className="font-mono text-[#E7BD71] shrink-0">
              {coldStartSeconds}s
            </span>
          </div>
        </div>
      )}

      {/* Service Unreachable Banner */}
      {!healthLoading && healthError && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-2xl bg-red-950/35 border border-red-500/35 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-red-200">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
              <WifiOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5 sm:mt-0" />
              <span className="break-words">
                <strong>Plataforma temporariamente indisponível:</strong>{" "}
                {healthError}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void fetchAllInitialData()}
              className="font-mono text-[11px] underline text-red-100 hover:text-white cursor-pointer shrink-0"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Hero Section with Responsive Vector Globe SVG */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-6">
        <div className="gb-card rounded-3xl p-4 sm:p-6 lg:p-10 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            <div className="lg:col-span-7 space-y-4 sm:space-y-5 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#050B08] border border-[#1A2F24] text-[11px] font-mono text-[#57DCA0] max-w-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#20BD80] shrink-0" />
                <span className="truncate">
                  Ponte Inteligente • Financiamento Climático Global
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.12] text-[#F3F7F4] break-words">
                Conecte iniciativas ambientais brasileiras a{" "}
                <span className="text-[#57DCA0]">
                  fundos climáticos internacionais.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-[#8EA396] max-w-2xl leading-relaxed">
                Mapeamos oportunidades globais em tempo real, calculamos a
                compatibilidade com a sua organização, redigimos sua proposta
                técnica em inglês pronta para submissão e enviamos alertas
                direto no seu celular.
              </p>

              {/* 3 KPIs — Stacked 1-col on mobile, 3-col on sm+ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="rounded-2xl bg-[#050B08]/90 border border-[#1A2F24] p-3.5 sm:p-4 flex sm:block items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[#57DCA0] sm:justify-between sm:mb-1.5">
                      <Globe2 className="w-4 h-4 shrink-0" />
                      <span className="font-mono text-[10px] uppercase text-[#8EA396]">
                        Radar
                      </span>
                    </div>
                    <p className="text-xs text-[#8EA396] mt-0.5 sm:hidden">
                      Editais Ativos
                    </p>
                  </div>
                  <div className="text-right sm:text-left">
                    <div className="font-display text-2xl sm:text-3xl font-bold text-[#F3F7F4]">
                      {grantsLoading ? (
                        <span className="text-[#8EA396]">—</span>
                      ) : (
                        grants.length
                      )}
                    </div>
                    <p className="text-[11px] text-[#8EA396] mt-0.5 hidden sm:block">
                      Editais Ativos
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#050B08]/90 border border-[#1A2F24] p-3.5 sm:p-4 flex sm:block items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[#E7BD71] sm:justify-between sm:mb-1.5">
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span className="font-mono text-[10px] uppercase text-[#8EA396]">
                        Idioma
                      </span>
                    </div>
                    <p className="text-xs text-[#8EA396] mt-0.5 sm:hidden">
                      Proposta Pronta
                    </p>
                  </div>
                  <div className="text-right sm:text-left">
                    <div className="font-display text-2xl sm:text-3xl font-bold text-[#E7BD71]">
                      PT→EN
                    </div>
                    <p className="text-[11px] text-[#8EA396] mt-0.5 hidden sm:block">
                      Proposta Pronta
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#050B08]/90 border border-[#1A2F24] p-3.5 sm:p-4 flex sm:block items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[#57DCA0] sm:justify-between sm:mb-1.5">
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span className="font-mono text-[10px] uppercase text-[#8EA396]">
                        Celular
                      </span>
                    </div>
                    <p className="text-xs text-[#8EA396] mt-0.5 sm:hidden">
                      Alerta Direto
                    </p>
                  </div>
                  <div className="text-right sm:text-left">
                    <div className="font-display text-2xl sm:text-3xl font-bold text-[#57DCA0]">
                      SMS
                    </div>
                    <p className="text-[11px] text-[#8EA396] mt-0.5 hidden sm:block">
                      Alerta Direto
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vector Globe SVG — Compact on Mobile */}
            <div className="lg:col-span-5 flex items-center justify-center py-1 sm:py-2">
              <BrazilGlobeSvg
                activeGrantsCount={grantsLoading ? null : grants.length}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-10">
        {/* Workspace: Form (5 cols) + Match Result / Guide (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-7 items-start">
          {/* Left Column: NGO Diagnosis & Match Form */}
          <section className="lg:col-span-5 min-w-0">
            <div className="gb-card rounded-3xl p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#F3F7F4] flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#57DCA0] shrink-0" />
                  <span>Diagnóstico da Organização</span>
                </h2>
                <span className="font-mono text-[11px] text-[#57DCA0] bg-[#050B08] border border-[#1A2F24] px-2.5 py-0.5 rounded-full">
                  Passo 1
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#8EA396] mb-5 leading-relaxed">
                Descreva em português a atuação da sua ONG, cooperativa ou
                projeto comunitário no Brasil para encontrar o edital mais
                compatível.
              </p>

              {/* 3 Quick-Fill Presets — Touch-friendly min-h-[44px] & flex-wrap */}
              <div className="mb-5">
                <span className="block font-mono text-[11px] uppercase tracking-wider text-[#8EA396] mb-2">
                  Preenchimento Rápido (1 clique)
                </span>
                <div className="flex flex-col gap-2">
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setOngProfile(preset.text);
                        setMatchError(null);
                      }}
                      className="group min-h-[44px] w-full text-left bg-[#050B08] hover:bg-[#20BD80]/10 border border-[#1A2F24] hover:border-[#20BD80]/60 rounded-xl px-3.5 py-2.5 transition flex flex-wrap items-center justify-between gap-x-2 gap-y-1 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {renderPresetIcon(preset.icon)}
                        <span className="text-xs font-medium text-[#F3F7F4] break-words">
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
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="ong-profile-textarea"
                      className="text-xs font-medium text-[#F3F7F4]"
                    >
                      Perfil e Objetivos da Iniciativa Ambiental
                    </label>
                    <span className="font-mono text-[11px] text-[#8EA396] shrink-0">
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

                {/* WhatsApp / SMS Alert Field */}
                <div className="rounded-2xl bg-[#050B08] border border-[#1A2F24] p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label
                      htmlFor="whatsapp-phone-input"
                      className="text-xs font-medium text-[#F3F7F4] flex items-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[#E7BD71] shrink-0" />
                      <span>Telefone / WhatsApp com DDD (opcional)</span>
                    </label>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#E7BD71]/12 text-[#E7BD71] border border-[#E7BD71]/30">
                      Alerta por WhatsApp / SMS
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
                    className="w-full min-h-[44px] rounded-xl bg-[#0B1611] border border-[#1A2F24] px-3.5 py-2.5 text-sm font-mono text-[#F3F7F4] placeholder:text-[#8EA396]/60 focus:outline-none focus:border-[#E7BD71]/70 transition"
                  />
                </div>

                {matchError && (
                  <div className="rounded-xl bg-red-950/45 border border-red-500/35 p-3 text-xs text-red-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="break-words">{matchError}</span>
                  </div>
                )}

                {matchSlowNotice && matchLoading && (
                  <div className="rounded-xl bg-[#050B08] border border-[#E7BD71]/40 p-3 text-xs text-[#E7BD71] flex items-start gap-2">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
                    <span className="break-words">
                      Estamos finalizando a análise e redigindo sua proposta
                      técnica em inglês. A primeira solicitação pode levar de 30
                      a 50 segundos enquanto o servidor inicia.
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={matchLoading}
                  className="w-full min-h-[48px] py-3.5 px-4 sm:px-5 rounded-2xl bg-[#20BD80] hover:bg-[#29D18F] active:scale-[0.99] text-[#050B08] font-display font-bold text-sm transition shadow-[0_12px_28px_-12px_rgba(32,189,128,0.6)] flex items-center justify-center gap-2 text-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {matchLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Analisando Editais e Gerando Proposta...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>Encontrar Edital Compatível e Gerar Proposta</span>
                    </>
                  )}
                </button>
              </form>

              {/* User-Friendly Progress Log */}
              {pipelineLogs.length > 0 && (
                <div className="mt-4 rounded-2xl bg-[#050B08] border border-[#1A2F24] p-3.5 font-mono text-[11px] text-[#57DCA0] space-y-1.5 overflow-x-hidden">
                  {pipelineLogs.map((line, index) => (
                    <div
                      key={`${index}-${line}`}
                      className="leading-relaxed break-words"
                    >
                      <span className="text-[#8EA396] mr-1.5">&gt;</span>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Match Result Dossier OR Guided Empty State */}
          <section className="lg:col-span-7 min-w-0">
            {matchResult ? (
              (() => {
                const alertDisplay = getAlertDisplay(
                  matchResult.notification.status,
                );
                return (
                  <div
                    ref={resultRef}
                    className="gb-card rounded-3xl p-4 sm:p-6 border border-[#20BD80]/45 min-w-0"
                  >
                    {/* Header: Mobile stacks Match Score Ring ABOVE Title; sm+ places Title left & Ring right */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-[#1A2F24]">
                      {/* Match Score Ring + Gold Funding Amount (first on mobile, right on sm+) */}
                      <div className="sm:order-2 flex items-center gap-3.5 bg-[#050B08] border border-[#1A2F24] rounded-2xl px-4 py-3 w-full sm:w-auto shrink-0">
                        <MatchScoreRing score={matchResult.match_score} />
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-[#8EA396]">
                            Financiamento
                          </div>
                          <div className="font-display font-bold text-sm text-[#E7BD71] mt-0.5 break-words">
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
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                      </div>

                      {/* Grant Title & Metadata (second on mobile, left on sm+) */}
                      <div className="sm:order-1 space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wider bg-[#20BD80]/20 text-[#57DCA0] border border-[#20BD80]/40 px-2.5 py-0.5 rounded-full">
                            <Award className="w-3.5 h-3.5 shrink-0" />
                            <span>Edital Recomendado</span>
                          </span>
                          <span className="font-mono text-[11px] text-[#8EA396]">
                            Análise Inteligente
                          </span>
                        </div>
                        <h2 className="font-display text-lg sm:text-2xl font-bold text-[#F3F7F4] leading-snug break-words">
                          {matchResult.matched_grant.title}
                        </h2>
                        <p className="text-xs text-[#57DCA0] font-medium break-words">
                          {matchResult.matched_grant.organization} •{" "}
                          {matchResult.matched_grant.country} • Prazo:{" "}
                          {matchResult.matched_grant.deadline}
                        </p>
                      </div>
                    </div>

                    {/* Reasoning (PT-BR) + Mobile Alert Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 my-4">
                      <div className="sm:col-span-7 rounded-2xl bg-[#050B08] border border-[#1A2F24] p-4 min-w-0">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[#57DCA0] mb-1.5">
                          Por que este edital?
                        </div>
                        <p className="text-xs sm:text-sm text-[#F3F7F4]/90 leading-relaxed break-words">
                          {matchResult.match_reasoning_pt}
                        </p>
                      </div>

                      <div className="sm:col-span-5 rounded-2xl bg-[#050B08] border border-[#1A2F24] p-4 flex flex-col justify-between gap-2 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#E7BD71]">
                            Alerta por WhatsApp / SMS
                          </span>
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${alertDisplay.className}`}
                          >
                            {alertDisplay.badge}
                          </span>
                        </div>
                        <p className="text-xs text-[#8EA396] leading-snug break-words">
                          {alertDisplay.message}
                        </p>
                        {matchResult.notification.phone && (
                          <span className="font-mono text-[11px] text-[#F3F7F4] break-all">
                            Celular: +{matchResult.notification.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* English Concept Note Viewer + Copy / .MD / .TXT Actions */}
                    <div className="mt-5 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-[#57DCA0] shrink-0" />
                          <h3 className="font-display font-semibold text-sm text-[#F3F7F4] break-words">
                            Proposta Técnica em Inglês (Project Concept Note)
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCopyProposal()}
                            className="flex-1 sm:flex-none min-h-[38px] inline-flex items-center justify-center gap-1.5 text-xs font-display font-bold bg-[#20BD80] hover:bg-[#29D18F] text-[#050B08] px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
                          >
                            {copiedProposal ? (
                              <>
                                <Check className="w-3.5 h-3.5 shrink-0" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                                <span>Copiar Texto</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadProposal("md")}
                            className="min-h-[38px] inline-flex items-center justify-center gap-1.5 text-xs font-mono bg-[#050B08] hover:bg-[#1A2F24]/60 text-[#F3F7F4] border border-[#1A2F24] hover:border-[#20BD80]/50 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5 text-[#57DCA0] shrink-0" />
                            <span>.MD</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadProposal("txt")}
                            className="min-h-[38px] inline-flex items-center justify-center gap-1.5 text-xs font-mono bg-[#050B08] hover:bg-[#1A2F24]/60 text-[#F3F7F4] border border-[#1A2F24] hover:border-[#20BD80]/50 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
                          >
                            <FileDown className="w-3.5 h-3.5 text-[#57DCA0] shrink-0" />
                            <span>.TXT</span>
                          </button>
                        </div>
                      </div>

                      <pre className="gb-scroll w-full max-w-full max-h-[430px] overflow-y-auto overflow-x-hidden rounded-2xl bg-[#050B08] border border-[#1A2F24] p-4 sm:p-5 text-xs sm:text-[13px] text-[#F3F7F4]/95 whitespace-pre-wrap break-words font-mono leading-relaxed">
                        {matchResult.generated_proposal_en}
                      </pre>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="gb-card rounded-3xl p-4 sm:p-6 lg:p-8 border border-[#1A2F24] h-full flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#57DCA0] bg-[#050B08] border border-[#1A2F24] px-2.5 py-0.5 rounded-full">
                    <Sparkles className="w-3.5 h-3.5" />
                    Passo 2 • Resultado da Análise
                  </span>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F3F7F4]">
                    Sua recomendação e proposta técnica aparecerão aqui
                  </h2>
                  <p className="text-xs sm:text-sm text-[#8EA396] leading-relaxed">
                    Escolha um dos perfis rápidos ao lado ou descreva sua
                    organização para cruzar automaticamente com todos os fundos
                    climáticos ativos no radar.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-[#050B08] border border-[#1A2F24] p-4 space-y-1.5">
                    <div className="font-mono text-[11px] text-[#57DCA0]">
                      01 • Compatibilidade
                    </div>
                    <p className="text-xs text-[#8EA396] leading-relaxed">
                      Identifica o edital internacional mais aderente e calcula
                      o percentual de compatibilidade.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#050B08] border border-[#1A2F24] p-4 space-y-1.5">
                    <div className="font-mono text-[11px] text-[#E7BD71]">
                      02 • Proposta em Inglês
                    </div>
                    <p className="text-xs text-[#8EA396] leading-relaxed">
                      Redige uma Project Concept Note estruturada com impacto
                      local, orçamento e ODS da ONU.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#050B08] border border-[#1A2F24] p-4 space-y-1.5">
                    <div className="font-mono text-[11px] text-[#57DCA0]">
                      03 • Alerta no Celular
                    </div>
                    <p className="text-xs text-[#8EA396] leading-relaxed">
                      Notifica o líder comunitário por WhatsApp / SMS e libera
                      download em .MD e .TXT.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Full-Width Live Grants Radar (1 col mobile, 2 cols tablet, 3 cols desktop) */}
        <section className="space-y-4 sm:space-y-5 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F3F7F4] flex items-center gap-2">
                <Radar className="w-5 h-5 text-[#57DCA0] shrink-0" />
                <span>Radar de Editais Internacionais</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#8EA396] mt-0.5">
                Oportunidades climáticas internacionais atualizadas em tempo
                real.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIngestModalOpen(true)}
              className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#0B1611] hover:bg-[#20BD80]/12 text-[#57DCA0] border border-[#1A2F24] hover:border-[#20BD80]/50 px-4 py-2 rounded-xl transition cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Adicionar Edital</span>
            </button>
          </div>

          {/* Search + Category Filter Chips */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#8EA396] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por fundo, bioma, país ou palavra-chave (ex: mangrove, UNDP, Amazon)..."
                className="w-full min-h-[44px] rounded-xl bg-[#0B1611] border border-[#1A2F24] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#F3F7F4] placeholder:text-[#8EA396]/70 focus:outline-none focus:border-[#20BD80] transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {GRANT_FILTERS.map((filter) => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-mono transition cursor-pointer border whitespace-nowrap ${
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
          </div>

          {/* Grants Grid: 1 col mobile -> 2 cols md -> 3 cols lg */}
          {grantsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="gb-card rounded-2xl p-4 sm:p-5 animate-pulse space-y-3"
                >
                  <div className="flex justify-between gap-4">
                    <div className="h-4 w-2/3 rounded bg-[#1A2F24]" />
                    <div className="h-5 w-20 rounded-full bg-[#1A2F24]" />
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
                Não foi possível carregar os editais no momento
              </div>
              <p className="text-xs text-[#8EA396] max-w-md mx-auto break-words">
                {grantsError}
              </p>
              <button
                type="button"
                onClick={() => void refreshGrantsOnly()}
                className="min-h-[42px] inline-flex items-center gap-1.5 text-xs font-display font-bold bg-[#20BD80] hover:bg-[#29D18F] text-[#050B08] px-4 py-2 rounded-xl transition cursor-pointer"
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
                Limpe a busca ou adicione uma nova oportunidade internacional ao
                radar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGrants.map((grant) => {
                const isWinner = matchResult?.matched_grant.id === grant.id;
                return (
                  <article
                    key={grant.id}
                    className={`gb-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 min-w-0 transition duration-200 hover:border-[#20BD80]/55 ${
                      isWinner
                        ? "border-[#57DCA0] ring-1 ring-[#20BD80]/40"
                        : ""
                    }`}
                  >
                    <div className="space-y-2.5 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-[#57DCA0] truncate max-w-full">
                          {grant.organization}
                        </span>
                        {isWinner ? (
                          <span className="font-mono text-[10px] font-semibold bg-[#20BD80]/20 text-[#57DCA0] border border-[#20BD80]/45 px-2 py-0.5 rounded-full shrink-0">
                            ★ {matchResult.match_score}% Match
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] font-semibold bg-[#E7BD71]/12 text-[#E7BD71] border border-[#E7BD71]/30 px-2 py-0.5 rounded-full max-w-full truncate">
                            {grant.funding_amount}
                          </span>
                        )}
                      </div>

                      <h3 className="font-display text-base font-bold text-[#F3F7F4] leading-snug break-words">
                        {grant.title}
                      </h3>

                      <p className="text-[11px] text-[#8EA396] break-words">
                        {grant.country}
                      </p>

                      <p className="text-xs sm:text-sm text-[#8EA396] leading-relaxed break-words">
                        {grant.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#1A2F24] space-y-2.5 text-xs">
                      <div className="flex flex-col gap-1 text-[#8EA396]">
                        <span className="break-words">
                          Valor:{" "}
                          <strong className="text-[#E7BD71] font-mono">
                            {grant.funding_amount}
                          </strong>
                        </span>
                        <span className="break-words">
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
                        className="inline-flex items-center gap-1 text-[#57DCA0] hover:text-[#20BD80] font-medium transition pt-0.5"
                      >
                        <span>Acessar Portal Oficial</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1A2F24] py-6 text-xs text-[#8EA396]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span>
              GrantBridge AI • Hack Brasil 2026 (Meio Ambiente &amp; Economia
              Verde)
            </span>
            <span className="hidden sm:inline text-[#1A2F24]">•</span>
            <span>
              Desenvolvido por{" "}
              <a
                href="https://github.com/fau-33"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#57DCA0] hover:text-[#20BD80] font-medium underline-offset-4 hover:underline transition"
              >
                Flávio Félix
              </a>{" "}
              (Equipe Solo Developer)
            </span>
          </div>
          <span className="text-[11px] text-[#8EA396]">
            Financiamento Climático Global • Propostas Técnicas em Inglês •
            Alertas Diretos
          </span>
        </div>
      </footer>

      {/* Add Grant Modal */}
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
