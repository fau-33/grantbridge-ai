"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { ApiError, ingestGrantUrl } from "@/lib/api";
import { IngestUrlInputSchema, type Grant } from "@/lib/schemas";

interface IngestModalProps {
  open: boolean;
  onClose: () => void;
  onGrantIngested: (grant: Grant) => void;
}

export function IngestModal({
  open,
  onClose,
  onGrantIngested,
}: IngestModalProps) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slowColdStart, setSlowColdStart] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, submitting, onClose]);

  useEffect(() => {
    if (!open) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setSlowColdStart(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsed = IngestUrlInputSchema.safeParse({ url });
    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues[0]?.message ||
          "Informe um link público válido (https://...).",
      );
      return;
    }

    setSubmitting(true);
    setSlowColdStart(false);
    const coldStartTimer = window.setTimeout(() => {
      setSlowColdStart(true);
    }, 4000);

    try {
      const response = await ingestGrantUrl(parsed.data);
      setSuccessMessage(
        `Oportunidade "${response.grant.title}" mapeada e publicada no radar com sucesso.`,
      );
      setUrl("");
      onGrantIngested(response.grant);
      window.setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail || err.message);
      } else {
        setErrorMessage(
          "Não foi possível mapear este edital no momento. Tente novamente.",
        );
      }
    } finally {
      window.clearTimeout(coldStartTimer);
      setSubmitting(false);
      setSlowColdStart(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingest-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="gb-card w-full max-w-lg max-h-[90vh] overflow-y-auto gb-scroll rounded-3xl p-4 sm:p-6 md:p-7 border border-[#20BD80]/35">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#57DCA0] bg-[#20BD80]/12 border border-[#20BD80]/30 px-2.5 py-0.5 rounded-full mb-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              Mapeamento Inteligente
            </span>
            <h3
              id="ingest-modal-title"
              className="font-display text-lg sm:text-xl font-bold text-[#F3F7F4]"
            >
              Adicionar Novo Edital
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-[#8EA396] hover:text-[#F3F7F4] p-2 -mr-1 rounded-lg transition cursor-pointer disabled:opacity-40 shrink-0"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-[#8EA396] leading-relaxed mb-5">
          Cole o link público de qualquer fundo ou edital ambiental
          internacional. Nossa plataforma extrai os requisitos, organiza os
          prazos e publica a oportunidade imediatamente no radar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="grant-url-input"
              className="block text-xs font-medium text-[#F3F7F4] mb-1.5"
            >
              Link Público do Edital Internacional
            </label>
            <input
              id="grant-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={submitting}
              placeholder="https://www.greengrants.org/what-we-do/grants/"
              className="w-full rounded-xl bg-[#050B08] border border-[#1A2F24] px-3.5 py-2.5 text-sm font-mono text-[#F3F7F4] placeholder:text-[#8EA396]/60 focus:outline-none focus:border-[#20BD80] focus:ring-2 focus:ring-[#20BD80]/20 transition"
              autoFocus
            />
          </div>

          {slowColdStart && submitting && (
            <div className="rounded-xl bg-[#050B08] border border-[#E7BD71]/35 p-3 text-xs text-[#E7BD71] flex items-start gap-2">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin mt-0.5" />
              <span>
                Mapeamento em andamento — a primeira consulta pode levar de 30 a
                50 segundos enquanto o servidor inicia.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl bg-red-950/50 border border-red-500/35 p-3 text-xs text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl bg-[#20BD80]/15 border border-[#20BD80]/40 p-3 text-xs text-[#57DCA0] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-medium text-[#8EA396] hover:text-[#F3F7F4] border border-[#1A2F24] hover:border-[#20BD80]/40 transition cursor-pointer disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-display font-bold bg-[#20BD80] hover:bg-[#29D18F] text-[#050B08] transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mapeando oportunidade...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Adicionar ao Radar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
