/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

