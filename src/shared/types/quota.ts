/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { JsonValue } from '@/types/common';

export type AntigravityAiCreditsInfo = {
    pricingType?: string;
    useAICredits?: boolean;
    creditAmount?: number;
    minimumCreditAmountForUsage?: number;
    status?: string;
    hasSufficientCredits?: boolean;
    canUseCredits?: boolean;
}

export type QuotaInfo = {
    remainingQuota: number;
    totalQuota: number;
    remainingFraction: number;
    resetTime?: string;
    aiCredits?: AntigravityAiCreditsInfo;
}

export type ModelPermission = {
    id: string;
    object: string;
    created: number;
    allow_create_engine: boolean;
    allow_sampling: boolean;
    allow_logprobs: boolean;
    allow_search_indices: boolean;
    allow_view: boolean;
    allow_fine_tuning: boolean;
    organization: string;
    group: string | null;
    is_blocking: boolean;
}

export type ModelQuotaItem = {
    id: string;
    name: string;
    object: string;
    owned_by: string;
    provider: string;
    percentage: number;
    reset: string;
    permission: ModelPermission[];
    quotaInfo?: QuotaInfo;
    [key: string]: JsonValue | undefined;
}

export type AntigravityQuotaModelData = {
    displayName?: string;
    quotaInfo?: QuotaInfo;
    pricingType?: string;
    useAICredits?: boolean;
    creditAmount?: number;
    minimumCreditAmountForUsage?: number;
    status?: string;
    [key: string]: JsonValue | undefined;
}

export interface QuotaResponse {
    status: string;
    next_reset: string;
    models: ModelQuotaItem[];
    success?: boolean;
    authExpired?: boolean;
    usage?: CodexUsage;
    planType?: string;
    accountId?: string;
    email?: string;
    isActive?: boolean;
    error?: string;
    usageSource?: 'openai' | 'anthropic' | 'copilot' | 'local' | 'none' | 'chatgpt';
    copilot?: CopilotQuota;
    claudeQuota?: ClaudeQuota;
    antigravityAiCredits?: AntigravityAiCreditsInfo;
}

export interface ClaudeQuota {
    success: boolean;
    fiveHour?: { utilization: number; resetsAt: string };
    sevenDay?: { utilization: number; resetsAt: string };
    accountId?: string;
    email?: string;
    isActive?: boolean;
    error?: string;
}

export interface CopilotQuota {
    remaining: number;
    limit: number;
    reset?: string;
    chat_enabled?: boolean;
    code_search_enabled?: boolean;
    copilot_plan?: string;
    seat_breakdown?: {
        total_seats: number;
        active_seats: number;
        inactive_seats: number;
        unassigned_seats: number;
        pending_invitations: number;
        plan_type?: string;
    };
    rate_limit?: {
        limit: number;
        remaining: number;
        reset: string;
    };
    session_limits?: {
        weekly?: { limit: number; current: number; reset_at?: string };
        session?: { limit: number; current: number; reset_at?: string };
    };
    session_usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_read_tokens: number;
        cache_write_tokens: number;
        reasoning_tokens?: number;
    };
    analytics_tracking_id?: string;
    error?: string;
}

export interface CodexUsage {
    totalRequests?: number;
    totalTokens?: number;
    remainingRequests?: number;
    remainingTokens?: number;
    dailyUsage?: number;
    dailyLimit?: number;
    weeklyUsage?: number;
    weeklyLimit?: number;
    dailyUsedPercent?: number;
    weeklyUsedPercent?: number;
    dailyResetAt?: string;
    weeklyResetAt?: string;
    resetAt?: string;
    planType?: string;
    error?: string;
}

export interface ModelGroup {
    provider: string;
    models: string[];
}
