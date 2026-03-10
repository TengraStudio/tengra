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
