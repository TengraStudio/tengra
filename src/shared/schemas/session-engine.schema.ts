import type { JsonValue } from '@shared/types/common';
import {
    SESSION_CAPABILITIES,
    SESSION_EVENT_TYPES,
    SESSION_MESSAGE_ROLES,
    SESSION_MODES,
    SESSION_RECOVERY_ACTIONS,
    SESSION_STATUSES,
} from '@shared/types/session-engine';
import { z } from 'zod';

const SessionJsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([z.string(), z.number(), z.boolean(), z.null(), SessionJsonObjectSchema, SessionJsonArraySchema])
);
const SessionJsonObjectSchema = z.record(z.string(), SessionJsonValueSchema);
const SessionJsonArraySchema = z.array(SessionJsonValueSchema);

export const SessionModeSchema = z.enum(SESSION_MODES);
export const SessionCapabilitySchema = z.enum(SESSION_CAPABILITIES);
export const SessionStatusSchema = z.enum(SESSION_STATUSES);
export const SessionEventTypeSchema = z.enum(SESSION_EVENT_TYPES);
export const SessionMessageRoleSchema = z.enum(SESSION_MESSAGE_ROLES);
export const SessionRecoveryActionSchema = z.enum(SESSION_RECOVERY_ACTIONS);

export const SessionModelSelectionSchema = z.object({
    provider: z.string().trim().min(1).max(200),
    model: z.string().trim().min(1).max(300),
    reasoningLevel: z.string().trim().max(50).optional(),
});

export const SessionMetadataSchema = z.object({
    title: z.string().trim().max(300).optional(),
    workspaceId: z.string().trim().max(200).optional(),
    chatId: z.string().trim().max(200).optional(),
    taskId: z.string().trim().max(200).optional(),
    sourceSurface: z.string().trim().max(100).optional(),
    labels: z.array(z.string().trim().max(100)).max(20).optional(),
    extras: SessionJsonObjectSchema.optional(),
});

export const SessionMessageEnvelopeSchema = z.object({
    id: z.string().trim().min(1).max(200),
    role: SessionMessageRoleSchema,
    content: z.string().max(200000),
    createdAt: z.number().int().nonnegative(),
    metadata: SessionJsonObjectSchema.optional(),
});

export const SessionRecoveryStateSchema = z.object({
    canResume: z.boolean(),
    requiresReview: z.boolean(),
    action: SessionRecoveryActionSchema,
    lastTransitionAt: z.number().int().nonnegative(),
    hint: z.string().max(1000).optional(),
});

export const SessionStateSchema = z.object({
    id: z.string().trim().min(1).max(200),
    mode: SessionModeSchema,
    status: SessionStatusSchema,
    capabilities: z.array(SessionCapabilitySchema).max(16),
    model: SessionModelSelectionSchema,
    metadata: SessionMetadataSchema,
    messages: z.array(SessionMessageEnvelopeSchema).max(5000),
    recovery: SessionRecoveryStateSchema,
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    lastError: z.string().max(5000).optional(),
});

export const SessionEventEnvelopeSchema = z.object({
    sessionId: z.string().trim().min(1).max(200),
    mode: SessionModeSchema,
    type: SessionEventTypeSchema,
    emittedAt: z.number().int().nonnegative(),
    payload: SessionJsonObjectSchema.optional(),
});

export const SessionStartOptionsSchema = z.object({
    sessionId: z.string().trim().min(1).max(200),
    mode: SessionModeSchema,
    capabilities: z.array(SessionCapabilitySchema).max(16),
    model: SessionModelSelectionSchema,
    metadata: SessionMetadataSchema.optional(),
    initialMessages: z.array(SessionMessageEnvelopeSchema).max(100).optional(),
});

export const SessionSubmitMessageOptionsSchema = z.object({
    message: SessionMessageEnvelopeSchema,
    metadata: SessionJsonObjectSchema.optional(),
});

export const SessionCapabilityDescriptorSchema = z.object({
    id: SessionCapabilitySchema,
    label: z.string().trim().min(1).max(120),
    enabledByDefault: z.boolean(),
    compatibleModes: z.array(SessionModeSchema).min(1).max(8),
    description: z.string().trim().min(1).max(500),
});

export const SessionRecoverySnapshotSchema = z.object({
    sessionId: z.string().trim().min(1).max(200),
    mode: SessionModeSchema,
    status: SessionStatusSchema,
    capabilities: z.array(SessionCapabilitySchema).max(16),
    messageCount: z.number().int().nonnegative(),
    metadata: SessionMetadataSchema,
    updatedAt: z.number().int().nonnegative(),
    recoveryHint: z.string().max(1000).optional(),
    recovery: SessionRecoveryStateSchema,
    lastMessagePreview: z.string().max(280).optional(),
});
