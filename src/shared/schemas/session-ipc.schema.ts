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

import {
    SessionCapabilityDescriptorSchema,
    SessionRecoverySnapshotSchema,
    SessionStateSchema,
} from './session-engine.schema';

export const sessionStateRequestSchema = z.tuple([z.string().trim().min(1).max(200)]);
export const sessionListRequestSchema = z.tuple([]);
export const sessionStateResponseSchema = SessionStateSchema.nullable();
export const sessionListResponseSchema = z.array(SessionRecoverySnapshotSchema);
export const sessionCapabilityListResponseSchema = z.array(SessionCapabilityDescriptorSchema);
export const sessionHealthResponseSchema = z.object({
    status: z.literal('ready'),
    activeSessions: z.number().int().nonnegative(),
});

