/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ToolCall, ToolResult } from '@/types/chat';
import { JsonObject } from '@/types/common';

export type AiRuntimeSystemMode = 'thinking' | 'agent' | 'fast' | 'architect';

export type AiIntentType =
    | 'direct_answer'
    | 'single_lookup'
    | 'multi_lookup'
    | 'agentic_workflow'
    | 'creative_generation';

export type AiPresentationStage =
    | 'collecting_context'
    | 'running_tools'
    | 'tool_results_ready'
    | 'answer_ready';

export type AiEvidenceKind =
    | 'tool_result'
    | 'source'
    | 'image'
    | 'content';

export type AiAnswerMode =
    | 'model'
    | 'deterministic'
    | 'fallback';

export interface AiEvidenceEntry {
    kind: AiEvidenceKind;
    summary?: string;
    toolName?: string;
    reused?: boolean;
    path?: string;
}

export type AiEvidenceScope = 'turn' | 'session' | 'workspace';
export type AiEvidenceSourceSurface = 'chat' | 'terminal' | 'filesystem' | 'web';
export type AiEvidenceSatisfaction = 'none' | 'partial' | 'complete' | 'excessive';

export interface AiEvidenceRecord extends AiEvidenceEntry {
    id: string;
    timestamp: number;
    scope: AiEvidenceScope;
    intentRelationship?: 'supporting' | 'contradicting' | 'neutral';
    isReusable: boolean;
    sourceSurface: AiEvidenceSourceSurface;
    satisfactionScore: number; // 0-1 range
    rawContent?: string;
}

export interface AiEvidenceStoreSnapshot {
    records: AiEvidenceRecord[];
    totalSatisfaction: number;
    lastUpdated: number;
}

export interface AiIntentClassification {
    intent: AiIntentType;
    confidence: 'low' | 'medium' | 'high';
    systemMode: AiRuntimeSystemMode;
    requiresTooling: boolean;
    preferredMaxModelTurns: number;
    preferredMaxToolTurns: number;
}

export interface AiPresentationMetadata extends JsonObject {
    version: 1;
    intent: AiIntentType;
    stage: AiPresentationStage;
    answerMode: AiAnswerMode;
    isStreaming: boolean;
    hasReasoning: boolean;
    reasoningSummary?: string;
    reasoningSegments?: string[];
    toolCallCount: number;
    toolResultCount: number;
    reusedToolResultCount: number;
    sourceCount: number;
    imageCount: number;
    evidenceCount: number;
    activeToolNames?: string[];
    // New fields for refactor
    surface?: string;
    responseStyle?: string;
    satisfiedByEvidence?: boolean;
    deterministicAnswerAvailable?: boolean;
}

export interface AiPresentationContext {
    intent: AiIntentClassification | AiIntentType;
    content: string;
    reasoning?: string;
    reasonings?: string[];
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    sources?: string[];
    images?: string[];
    isStreaming?: boolean;
    language?: string;
    evidenceSnapshot?: AiEvidenceStoreSnapshot;
}

export interface AiToolLoopBudget {
    maxModelTurns: number;
    maxExecutedToolTurns: number;
    noProgressThreshold: number;
}
