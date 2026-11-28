import { z } from "zod";

export const GrantSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  organization: z.string(),
  country: z.string(),
  funding_amount: z.string(),
  deadline: z.string(),
  description: z.string(),
  source_url: z.string(),
  created_at: z.string(),
});

export type Grant = z.infer<typeof GrantSchema>;

export const GrantsListResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  grants: z.array(GrantSchema),
});

export type GrantsListResponse = z.infer<typeof GrantsListResponseSchema>;

export const IngestUrlInputSchema = z.object({
  url: z
    .string()
    .trim()
    .min(8, "Informe uma URL válida.")
    .max(2048, "A URL excede o limite de 2048 caracteres.")
    .url("Informe uma URL pública válida (http:// ou https://).")
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "A URL deve começar com http:// ou https://.",
    ),
});

export type IngestUrlInput = z.infer<typeof IngestUrlInputSchema>;

export const IngestUrlResponseSchema = z.object({
  message: z.string(),
  grant: GrantSchema,
});

export type IngestUrlResponse = z.infer<typeof IngestUrlResponseSchema>;

export const MatchRequestSchema = z.object({
  ong_profile: z
    .string()
    .trim()
    .min(15, "Descreva a organização ou projeto com pelo menos 15 caracteres.")
    .max(4000, "A descrição deve ter no máximo 4000 caracteres."),
  whatsapp_phone: z
    .string()
    .trim()
    .max(30, "O telefone/WhatsApp deve ter no máximo 30 caracteres.")
    .optional()
    .default(""),
});

export type MatchRequest = z.input<typeof MatchRequestSchema>;
export type MatchRequestParsed = z.output<typeof MatchRequestSchema>;

export const NotificationSchema = z.object({
  status: z.string(),
  phone: z.string(),
  detail: z.string(),
});

export type NotificationResult = z.infer<typeof NotificationSchema>;

export const MatchResponseSchema = z.object({
  proposal_id: z.number().int(),
  match_score: z.number().int().min(0).max(100),
  match_reasoning_pt: z.string(),
  ai_mode: z.string(),
  matched_grant: GrantSchema,
  generated_proposal_en: z.string(),
  notification: NotificationSchema,
  created_at: z.string(),
});

export type MatchResponse = z.infer<typeof MatchResponseSchema>;

export const ProposalSummarySchema = z.object({
  id: z.number().int(),
  ong_profile: z.string(),
  grant_id: z.number().int().nullable(),
  match_score: z.number().int().min(0).max(100),
  generated_proposal_en: z.string(),
  phone_notified: z.string().default(""),
  notification_status: z.string(),
  created_at: z.string(),
  grant_title: z.string().nullable().optional(),
  grant_organization: z.string().nullable().optional(),
});

export type ProposalSummary = z.infer<typeof ProposalSummarySchema>;

export const ProposalsListResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  proposals: z.array(ProposalSummarySchema),
});

export type ProposalsListResponse = z.infer<typeof ProposalsListResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
  integrations: z.object({
    neon_postgresql: z
      .object({
        connected: z.boolean(),
        provider: z.string(),
        status: z.string(),
        grants_count: z.number().int().nonnegative().optional(),
        detail: z.string().optional(),
      })
      .passthrough(),
    firecrawl_v2: z
      .object({
        configured: z.boolean(),
        status: z.string(),
      })
      .passthrough(),
    gemini_ai: z
      .object({
        configured: z.boolean(),
        model: z.string(),
        status: z.string(),
      })
      .passthrough(),
    nvoip_v3: z
      .object({
        configured: z.boolean(),
        status: z.string(),
      })
      .passthrough(),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
