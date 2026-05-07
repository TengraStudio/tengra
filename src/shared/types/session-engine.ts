/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { IpcValue, JsonObject } from './common';

export const SESSION_MODES = ['chat', 'workspace', 'automation'] as const;
export type SessionMode = typeof SESSION_MODES[number];

export const SESSION_CAPABILITIES = [
    'council',
    'tools',
    'workspace_context',
    'task_planning',
    'task_execution',
    'rag',
    'image_generation',
    'checkpoints',
    'recovery',
] as const;
export type SessionCapability = typeof SESSION_CAPABILITIES[number];

export const SESSION_STATUSES = [
    'idle',
    'preparing',
    'streaming',
    'waiting_for_input',
    'paused',
    'interrupted',
    'failed',
    'completed',
] as const;
export type SessionStatus = typeof SESSION_STATUSES[number];

export const SESSION_EVENT_TYPES = [
    'session.started',
    'session.status.changed',
    'session.message.created',
    'session.message.updated',
    'session.module.attached',
    'session.module.detached',
    'session.interrupted',
    'session.completed',
    'session.failed',
] as const;
export type SessionEventType = typeof SESSION_EVENT_TYPES[number];

export const SESSION_MESSAGE_ROLES = [
    'system',
    'user',
    'assistant',
    'tool',
    'council',
] as const;
export type SessionMessageRole = typeof SESSION_MESSAGE_ROLES[number];

export const SESSION_RECOVERY_ACTIONS = [
    'none',
    'resume_conversation',
    'resume_workspace',
    'resume_automation',
    'review_before_resume',
] as const;
export type SessionRecoveryAction = typeof SESSION_RECOVERY_ACTIONS[number];

export interface SessionModelSelection {
    provider: string;
    model: string;
    reasoningLevel?: string;
}

export type SessionMetadata = {
    title?: string;
    workspaceId?: string;
    chatId?: string;
    taskId?: string;
    sourceSurface?: string;
    labels?: string[];
    extras?: JsonObject;
}

export type SessionMessageEnvelope = {
    id: string;
    role: SessionMessageRole;
    content: string;
    createdAt: number;
    metadata?: JsonObject;
}

export type SessionRecoveryState = {
    canResume: boolean;
    requiresReview: boolean;
    action: SessionRecoveryAction;
    lastTransitionAt: number;
    hint?: string;
}

export type SessionState = {
    id: string;
    mode: SessionMode;
    status: SessionStatus;
    capabilities: SessionCapability[];
    model: SessionModelSelection;
    metadata: SessionMetadata;
    messages: SessionMessageEnvelope[];
    recovery: SessionRecoveryState;
    createdAt: number;
    updatedAt: number;
    lastError?: string;
}

export type SessionEventEnvelope = {
    sessionId: string;
    mode: SessionMode;
    type: SessionEventType;
    emittedAt: number;
    payload?: JsonObject;
}

export interface SessionStartOptions {
    sessionId: string;
    mode: SessionMode;
    capabilities: SessionCapability[];
    model: SessionModelSelection;
    metadata?: SessionMetadata;
    initialMessages?: SessionMessageEnvelope[];
}

export interface SessionSubmitMessageOptions {
    message: SessionMessageEnvelope;
    metadata?: JsonObject;
}

export interface SessionRecoverySnapshot {
    sessionId: string;
    mode: SessionMode;
    status: SessionStatus;
    capabilities: SessionCapability[];
    messageCount: number;
    metadata: SessionMetadata;
    updatedAt: number;
    recoveryHint?: string;
    recovery: SessionRecoveryState;
    lastMessagePreview?: string;
}

export interface SessionCapabilityDescriptor {
    id: SessionCapability;
    label: string;
    enabledByDefault: boolean;
    compatibleModes: SessionMode[];
    description: string;
}

export type SessionTransportPayload = Record<string, IpcValue>;

export interface SessionCouncilQuotaInterruptEvent {
    success: boolean;
    interruptId: string;
    checkpointId?: string;
    blockedByQuota: boolean;
    switched: boolean;
    selectedFallback?: {
        provider: string;
        model: string;
    };
    availableFallbacks: Array<{
        provider: string;
        model: string;
    }>;
    message: string;
    dedupeKey: string;
    emittedAt: number;
    v: 'v1';
}

