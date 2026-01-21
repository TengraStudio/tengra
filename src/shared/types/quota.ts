import { JsonValue } from '@/types/common'

export type QuotaInfo = {
    remainingQuota: number;
    totalQuota: number;
    remainingFraction: number;
    resetTime?: string;
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
    usageSource?: 'openai' | 'anthropic' | 'copilot' | 'local' | 'none' | 'chatgpt';
    copilot?: CopilotQuota;
    claudeQuota?: ClaudeQuota;
}

export interface ClaudeQuota {
    success: boolean;
    fiveHour?: { utilization: number; resetsAt: string };
    sevenDay?: { utilization: number; resetsAt: string };
    accountId?: string;
    email?: string;
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
