import { z } from 'zod';

/**
 * Antigravity AI Credit Schema
 * Strictly following the observed v1.107.0 payload structure.
 */
export const AntigravityAiCreditSchema = z.object({
  creditType: z.string(),
  creditAmount: z.string().or(z.number()),
  minimumCreditAmountForUsage: z.string().or(z.number()),
});

/**
 * Antigravity Paid Tier Schema
 */
export const AntigravityPaidTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  availableCredits: z.array(AntigravityAiCreditSchema).optional(),
});

/**
 * Partial schema for loadCodeAssist Response
 */
export const AntigravityLoadCodeAssistSchema = z.object({
  paidTier: AntigravityPaidTierSchema.optional(),
  cloudaicompanionProject: z.union([
    z.string(),
    z.object({ id: z.string() })
  ]).optional(),
  allowedTiers: z.array(z.object({
    id: z.string(),
    isDefault: z.boolean().optional(),
  })).optional(),
});

export type AntigravityAiCredit = z.infer<typeof AntigravityAiCreditSchema>;
export type AntigravityPaidTier = z.infer<typeof AntigravityPaidTierSchema>;
export type AntigravityLoadCodeAssist = z.infer<typeof AntigravityLoadCodeAssistSchema>;
