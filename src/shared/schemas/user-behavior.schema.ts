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
 * Zod schema for User Behavior Record.
 * Part of FEAT-05: User behavior learning.
 */
export const UserBehaviorRecordSchema = z.object({
    id: z.string().uuid(),
    eventType: z.string(),
    eventKey: z.string(),
    count: z.number().int().nonnegative(),
    lastUsedAt: z.number().int().nonnegative(),
    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Zod schema for User Behavior interactions summary.
 */
export const UserBehaviorSummarySchema = z.object({
    eventType: z.string(),
    topEvents: z.array(z.string()),
    lastInteraction: z.number().optional()
});

export type UserBehaviorRecord = z.infer<typeof UserBehaviorRecordSchema>;
export type UserBehaviorSummary = z.infer<typeof UserBehaviorSummarySchema>;

