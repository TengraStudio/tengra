/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Message } from '../ai/chat';
import type { JsonValue } from '../common';

export interface AgentProfile {
    id: string;
    name: string;
    role: string;
    persona: string;
    systemPrompt: string;
    skills: string[];
}

export interface AgentTemplate {
    id: string;
    name: string;
    description: string;
    category: 'researcher' | 'coder' | 'reviewer' | 'orchestrator' | 'custom';
    systemPromptOverride?: string;
    taskTemplate: string;
    predefinedSteps?: string[];
    variables: string[];
    modelRouting?: Record<string, JsonValue>;
    tags: string[];
    isBuiltIn: boolean;
    authorId?: string;
    createdAt?: number;
    updatedAt?: number;
}

export interface AgentCollaborationMessage {
    id: string;
    taskId: string;
    stageId: string;
    fromAgentId: string;
    toAgentId?: string;
    channel: 'private' | 'group';
    intent: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    payload: Record<string, JsonValue>;
    createdAt: number;
    expiresAt?: number;
}

export type PlanCostBreakdown = {
    totalEstimatedCost: number;
    inputCost: number;
    outputCost: number;
    stepBreakdown: Array<{
        stepId: string;
        stepText: string;
        estimatedTokens: number;
        estimatedCostUsd: number;
    }>;
    modelId: string;
    provider: string;
}

/** Status of a council step */
export type CouncilStepStatus =
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'awaiting_step_approval';

/** Confidence scoring for a step */
export type StepConfidence = {
    [key: string]: JsonValue | undefined;
    score: number; // 0-100
    factors: {
        [key: string]: JsonValue | undefined;
        complexity: number;
        specificity: number;
        toolAvailability: number;
        historicalSuccess: number;
    };
    explanation?: string;
}

/** Cost estimate for a step or plan */
export type CostEstimate = {
    [key: string]: JsonValue | undefined;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
}

/** Model configuration for a specific step */
export type StepModelConfig = {
    [key: string]: JsonValue | undefined;
    provider: string;
    model: string;
    /** Reason for using this model (e.g., "code generation", "research") */
    reason?: string;
}

/** Task type for model routing */
export type TaskType =
    | 'code_generation'
    | 'code_review'
    | 'research'
    | 'documentation'
    | 'debugging'
    | 'testing'
    | 'refactoring'
    | 'planning'
    | 'general';

/** Model routing rule for task types */
export interface ModelRoutingRule {
    taskType: TaskType;
    provider: string;
    model: string;
    priority: number; // Higher priority = preferred
}

export type CouncilStep = {
    [key: string]: JsonValue | undefined;
    id: string;
    text: string;
    status: CouncilStepStatus;
    type?: 'task' | 'fork' | 'join';
    dependsOn?: string[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
    timing?: {
        startedAt?: number;
        completedAt?: number;
        durationMs?: number;
    };
    tokens?: {
        prompt: number;
        completion: number;
    };
    estimatedCost?: CostEstimate;
    actualCost?: CostEstimate;
    confidence?: StepConfidence;
    modelConfig?: StepModelConfig;
    taskType?: TaskType;
    requiresApproval?: boolean;
}

export type WorkspaceStep = CouncilStep;
export type WorkspaceStepStatus = CouncilStepStatus;

export type CouncilStartOptions = {
    task: string;
    nodeId?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    model?: { provider: string; model: string };
    workspaceId?: string;
    agentProfileId?: string;
    attachments?: Array<{ name: string; path: string; size: number }>;
    systemMode?: 'fast' | 'thinking' | 'architect';
    budgetLimitUsd?: number;
    locale?: string;
    executionMode?: 'sequential' | 'parallel';
}

export type AgentStartOptions = CouncilStartOptions;

export type CouncilState = {
    status:
    | 'idle'
    | 'planning'
    | 'waiting_for_approval'
    | 'running'
    | 'paused'
    | 'failed'
    | 'completed'
    | 'error';
    currentTask: string;
    plan: CouncilStep[];
    history: Message[];
    lastError?: string;
    nodeId?: string;
    config?: CouncilStartOptions;
}

export type WorkspaceState = CouncilState;

/** usageStats events for council monitoring */
export enum CouncilUsageStatsEvent {
    MODEL_ROUTED = 'council_model_routed',
    PLAN_PROPOSED = 'council_plan_proposed',
    EXECUTION_STARTED = 'council_execution_started',
    STEP_COMPLETED = 'council_step_completed',
    STEP_FAILED = 'council_step_failed'
}

/** Performance regression budgets in milliseconds */
export const COUNCIL_PERFORMANCE_BUDGETS = {
    ROUTE_MODEL_MS: 100,
    INITIALIZE_MS: 1000
} as const;

