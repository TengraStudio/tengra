/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { ClaudeQuota, CodexUsage, QuotaResponse } from '@shared/types/quota';
import type {
    CouncilSubagentRuntime,
    ModelCostProfile,
    NormalizedQuotaSnapshot,
    ProviderFallbackCandidate,
    QuotaBucket,
    QuotaWindow,
    WorkspaceAgentExecutionStrategy,
} from '@shared/types/workspace-agent-session';

import type { GroupedModels, ModelInfo } from '@/types';

interface BuildNormalizedQuotaSnapshotOptions {
    groupedModels: GroupedModels | null | undefined;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: Array<{ usage: CodexUsage; accountId?: string; email?: string }> } | null;
    claudeQuota?: { accounts: ClaudeQuota[] } | null;
}

interface ModelCandidate {
    provider: string;
    model: string;
    contextWindow: number;
    local: boolean;
    score: number;
}

const SIMPLE_TASK_PATTERN =
    /\b(explain|fix typo|rename|small|quick|summarize|minor|simple|cleanup|format|readme|comment)\b/i;
const REASONING_TASK_PATTERN =
    /\b(architecture|refactor|design|council|plan|debug|complex|investigate|analyze|reason)\b/i;

const MODEL_COST_MULTIPLIERS: Record<string, number> = {
    'gpt-5.1-codex': 30,
    'gpt-5.1-codex-mini': 3,
    'gpt-5.4': 30,
    'gpt-5.4-mini': 6,
    'gpt-4o': 3,
    'gpt-4o-mini': 1,
    'claude-opus-4.6': 30,
    'claude-sonnet-4.6': 3,
};

function flattenModels(groupedModels: GroupedModels | null | undefined): ModelInfo[] {
    if (!groupedModels) {
        return [];
    }

    return Object.values(groupedModels).flatMap(group => group.models);
}

function normalizeBucketKey(provider: string, modelId: string): string {
    const normalized = modelId.toLowerCase();
    if (provider === 'antigravity') {
        if (normalized.includes('gemini') && normalized.includes('3.1') && normalized.includes('pro')) {
            return 'antigravity:gemini-3.1-pro';
        }
        if (normalized.includes('claude') && normalized.includes('4.6')) {
            return 'antigravity:claude-4.6';
        }
        return `antigravity:${normalized.replace(/-(high|low)$/, '')}`;
    }
    return `${provider}:${normalized}`;
}

function buildQuotaWindow(
    id: string,
    label: string,
    remaining: number,
    total: number,
    resetAt?: string
): QuotaWindow {
    return {
        id,
        label,
        remaining,
        total,
        resetAt,
    };
}

function resolveAntigravityWindowQuota(model: QuotaResponse['models'][number]): {
    remaining: number;
    total: number;
} {
    const quotaInfo = model.quotaInfo;
    const baseRemaining =
        quotaInfo?.remainingQuota
        ?? Math.max(0, Math.round((quotaInfo?.remainingFraction ?? 0) * (quotaInfo?.totalQuota ?? 100)));
    const baseTotal = quotaInfo?.totalQuota ?? 100;
    const aiCredits = quotaInfo?.aiCredits;
    const canUseCredits = aiCredits?.canUseCredits === true;

    if (!canUseCredits || baseRemaining > 0) {
        return {
            remaining: baseRemaining,
            total: baseTotal,
        };
    }

    const creditRemaining = typeof aiCredits.creditAmount === 'number'
        ? Math.max(1, Math.round(aiCredits.creditAmount))
        : 1;
    return {
        remaining: creditRemaining,
        total: Math.max(creditRemaining, 1),
    };
}

function buildAntigravityBuckets(quotas?: { accounts: QuotaResponse[] } | null): QuotaBucket[] {
    if (!quotas?.accounts) {
        return [];
    }

    const bucketMap = new Map<string, QuotaBucket>();
    for (const account of quotas.accounts) {
        for (const model of account.models) {
            const bucketId = normalizeBucketKey('antigravity', model.id);
            const existing = bucketMap.get(bucketId);
            const { remaining, total } = resolveAntigravityWindowQuota(model);
            if (existing) {
                existing.models.push(model.id);
                continue;
            }
            bucketMap.set(bucketId, {
                id: bucketId,
                provider: 'antigravity',
                accountId: account.accountId,
                label: model.name,
                models: [model.id],
                windows: [
                    buildQuotaWindow(
                        `${bucketId}:shared`,
                        'shared',
                        remaining,
                        total,
                        model.quotaInfo?.resetTime ?? account.next_reset
                    ),
                ],
            });
        }
    }

    return Array.from(bucketMap.values());
}

function buildClaudeBuckets(claudeQuota?: { accounts: ClaudeQuota[] } | null): QuotaBucket[] {
    if (!claudeQuota?.accounts) {
        return [];
    }

    return claudeQuota.accounts.map((account, index) => {
        const windows: QuotaWindow[] = [];
        if (account.fiveHour) {
            windows.push(
                buildQuotaWindow(
                    `claude:${index}:five-hour`,
                    '5h',
                    Math.max(0, 100 - account.fiveHour.utilization),
                    100,
                    account.fiveHour.resetsAt
                )
            );
        }
        if (account.sevenDay) {
            windows.push(
                buildQuotaWindow(
                    `claude:${index}:seven-day`,
                    '7d',
                    Math.max(0, 100 - account.sevenDay.utilization),
                    100,
                    account.sevenDay.resetsAt
                )
            );
        }
        return {
            id: `claude:${account.accountId ?? index}`,
            provider: 'claude',
            accountId: account.accountId,
            label: account.email ?? `Claude ${index + 1}`,
            models: ['claude'],
            windows,
        };
    });
}

function buildCodexBuckets(
    codexUsage?: {
        accounts: Array<{ usage: CodexUsage; accountId?: string; email?: string }>;
    } | null
): QuotaBucket[] {
    if (!codexUsage?.accounts) {
        return [];
    }

    return codexUsage.accounts.map((account, index) => ({
        id: `codex:${account.accountId ?? index}`,
        provider: 'codex',
        accountId: account.accountId,
        label: account.email ?? `Codex ${index + 1}`,
        models: ['codex'],
        windows: [
            buildQuotaWindow(
                `codex:${index}:daily`,
                'daily',
                Math.max(0, (account.usage.dailyLimit ?? 0) - (account.usage.dailyUsage ?? 0)),
                Math.max(1, account.usage.dailyLimit ?? 1),
                account.usage.dailyResetAt
            ),
            buildQuotaWindow(
                `codex:${index}:weekly`,
                'weekly',
                Math.max(0, (account.usage.weeklyLimit ?? 0) - (account.usage.weeklyUsage ?? 0)),
                Math.max(1, account.usage.weeklyLimit ?? 1),
                account.usage.weeklyResetAt
            ),
        ],
    }));
}

function buildCopilotBuckets(quotas?: { accounts: QuotaResponse[] } | null): QuotaBucket[] {
    if (!quotas?.accounts) {
        return [];
    }

    return quotas.accounts
        .filter(account => account.copilot !== undefined)
        .map((account, index) => ({
            id: `copilot:${account.accountId ?? index}`,
            provider: 'copilot',
            accountId: account.accountId,
            label: account.email ?? `Copilot ${index + 1}`,
            models: ['copilot'],
            windows: [
                buildQuotaWindow(
                    `copilot:${index}:credits`,
                    'credits',
                    Math.max(0, account.copilot?.remaining ?? 0),
                    Math.max(1, account.copilot?.limit ?? 1),
                    account.copilot?.reset
                ),
                buildQuotaWindow(
                    `copilot:${index}:requests`,
                    'requests',
                    Math.max(0, account.copilot?.rate_limit?.remaining ?? 0),
                    Math.max(1, account.copilot?.rate_limit?.limit ?? 1),
                    account.copilot?.rate_limit?.reset
                ),
            ],
        }));
}

function computeReasoningWeight(modelId: string): number {
    const normalized = modelId.toLowerCase();
    if (normalized.includes('opus') || normalized.includes('o1') || normalized.includes('o3')) {
        return 95;
    }
    if (
        normalized.includes('sonnet') ||
        normalized.includes('codex') ||
        normalized.includes('pro')
    ) {
        return 84;
    }
    if (normalized.includes('flash') || normalized.includes('mini') || normalized.includes('haiku')) {
        return 58;
    }
    return 68;
}

function computeSpeedWeight(modelId: string): number {
    const normalized = modelId.toLowerCase();
    if (normalized.includes('flash') || normalized.includes('mini') || normalized.includes('haiku')) {
        return 90;
    }
    if (normalized.includes('opus') || normalized.includes('o1') || normalized.includes('o3')) {
        return 45;
    }
    return 70;
}

function buildModelCostProfiles(groupedModels: GroupedModels | null | undefined): ModelCostProfile[] {
    return flattenModels(groupedModels).map(model => {
        const provider = model.provider ?? 'unknown';
        const modelId = model.id ?? model.name ?? 'unknown-model';
        return {
            provider,
            model: modelId,
            reasoningWeight: computeReasoningWeight(modelId),
            speedWeight: computeSpeedWeight(modelId),
            local: provider === 'ollama',
            creditMultiplier: MODEL_COST_MULTIPLIERS[modelId.toLowerCase()],
            requestLimited: provider === 'copilot',
        };
    });
}

function getBucketHeadroom(bucket: QuotaBucket): number {
    if (bucket.windows.length === 0) {
        return 0.2;
    }
    const fractions = bucket.windows.map(window =>
        window.total > 0 ? Math.max(0, Math.min(1, window.remaining / window.total)) : 0
    );
    return Math.min(...fractions);
}

function buildFallbackCandidates(
    groupedModels: GroupedModels | null | undefined,
    buckets: QuotaBucket[],
    profiles: ModelCostProfile[]
): ProviderFallbackCandidate[] {
    return flattenModels(groupedModels)
        .map(model => {
            const provider = model.provider ?? 'unknown';
            const modelId = model.id ?? model.name ?? 'unknown-model';
            const bucket = buckets.find(candidate =>
                candidate.provider === provider &&
                candidate.models.some(candidateModel => candidateModel.toLowerCase() === modelId.toLowerCase())
            );
            const profile = profiles.find(candidate =>
                candidate.provider === provider && candidate.model === modelId
            );
            const headroom = bucket ? getBucketHeadroom(bucket) : 0.35;
            const contextBonus = (model.contextWindow ?? 32000) >= 128000 ? 0.2 : 0.05;
            const costPenalty = profile?.creditMultiplier ? profile.creditMultiplier / 100 : 0;

            return {
                provider,
                model: modelId,
                accountId: bucket?.accountId,
                bucketId: bucket?.id,
                score: headroom + contextBonus - costPenalty,
                reason: bucket
                    ? `${bucket.label} ${(headroom * 100).toFixed(0)}%`
                    : 'no direct bucket',
            };
        })
        .sort((left, right) => right.score - left.score);
}

export function buildNormalizedQuotaSnapshot(
    options: BuildNormalizedQuotaSnapshotOptions
): NormalizedQuotaSnapshot {
    const buckets = [
        ...buildAntigravityBuckets(options.quotas),
        ...buildClaudeBuckets(options.claudeQuota),
        ...buildCodexBuckets(options.codexUsage),
        ...buildCopilotBuckets(options.quotas),
    ];
    const models = buildModelCostProfiles(options.groupedModels);
    return {
        generatedAt: Date.now(),
        buckets,
        models,
        fallbackCandidates: buildFallbackCandidates(
            options.groupedModels,
            buckets,
            models
        ),
    };
}

export function classifyTaskProfile(task: string): 'simple' | 'balanced' | 'reasoning' {
    if (SIMPLE_TASK_PATTERN.test(task)) {
        return 'simple';
    }
    if (REASONING_TASK_PATTERN.test(task)) {
        return 'reasoning';
    }
    return 'balanced';
}

function scoreModelCandidate(
    model: ModelInfo,
    snapshot: NormalizedQuotaSnapshot,
    taskProfile: 'simple' | 'balanced' | 'reasoning',
    strategy: WorkspaceAgentExecutionStrategy
): ModelCandidate {
    const provider = model.provider ?? 'unknown';
    const modelId = model.id ?? model.name ?? 'unknown-model';
    const profile = snapshot.models.find(
        candidate => candidate.provider === provider && candidate.model === modelId
    );
    const fallback = snapshot.fallbackCandidates.find(
        candidate => candidate.provider === provider && candidate.model === modelId
    );
    const local = provider === 'ollama';
    let score = fallback?.score ?? 0.2;
    const contextWindow = model.contextWindow ?? 32000;

    if (taskProfile === 'reasoning') {
        score += (profile?.reasoningWeight ?? 50) / 100;
    } else if (taskProfile === 'simple') {
        score += (profile?.speedWeight ?? 50) / 140;
    } else {
        score += ((profile?.reasoningWeight ?? 50) + (profile?.speedWeight ?? 50)) / 240;
    }

    if (contextWindow >= 128000) {
        score += 0.18;
    } else if (contextWindow >= 64000) {
        score += 0.1;
    }

    if (local && (strategy === 'local-first-simple' || taskProfile === 'simple')) {
        score += 0.22;
    }

    if (profile?.requestLimited && (fallback?.score ?? 0) < 0.15) {
        score -= 0.25;
    }

    return {
        provider,
        model: modelId,
        contextWindow,
        local,
        score,
    };
}

export function recommendCouncilParticipants(options: {
    task: string;
    groupedModels: GroupedModels | null | undefined;
    snapshot: NormalizedQuotaSnapshot;
    strategy: WorkspaceAgentExecutionStrategy;
    requestedCount: number;
}): {
    chairman: ModelCandidate | null;
    subagents: ModelCandidate[];
    runtimes: CouncilSubagentRuntime[];
} {
    const taskProfile = classifyTaskProfile(options.task);
    const ranked = flattenModels(options.groupedModels)
        .map(model =>
            scoreModelCandidate(model, options.snapshot, taskProfile, options.strategy)
        )
        .sort((left, right) => right.score - left.score);
    const chairman = ranked[0] ?? null;
    const subagents = ranked.slice(0, Math.max(2, Math.min(30, options.requestedCount)));
    const runtimes: CouncilSubagentRuntime[] = subagents.map((candidate, index) => ({
        id: `agent-${index + 1}`,
        name: index === 0 ? 'Chairman' : `Agent ${index + 1}`,
        provider: candidate.provider,
        model: candidate.model,
        workspaceId: `draft-${index + 1}`,
        status: index === 0 ? 'reviewing' : 'working',
        stageGoal:
            index === 0
                ? 'Review, route, and approve incoming drafts'
                : 'Execute assigned stage and prepare private draft',
        progressPercent: index === 0 ? 5 : 0,
        helpAvailable: false,
        ownerStageId: index === 0 ? undefined : `stage-${index + 1}`,
    }));

    return {
        chairman,
        subagents,
        runtimes,
    };
}

