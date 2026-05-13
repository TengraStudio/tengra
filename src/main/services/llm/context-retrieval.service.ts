/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { DatabaseService, SemanticFragment } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { withRetry } from '@main/utils/retry.util';
import { ContextRetrievalInputSchema } from '@shared/schemas/service-hardening.schema';

export interface RetrievalResult {
    contextString: string;
    sources: string[];
}

export interface RetrievalAnalytics {
    totalRequests: number;
    failedRequests: number;
    averageSources: number;
    averageContextLength: number;
    topQueries: Array<{ query: string; count: number }>;
    lastRetrievedAt?: number;
}

interface ScoredContextItem {
    source: string;
    sourceId: string;
    content: string;
    score: number;
}

const CONTEXT_RETRIEVAL_SERVICE_NAME = 'ContextRetrieval';
const CONTEXT_RETRIEVAL_RETRY_ATTEMPTS = 2;
const CONTEXT_RETRIEVAL_RETRY_DELAY_MS = 35;
const CONTEXT_RETRIEVAL_BUDGET_MS = 700;

const CONTEXT_RETRIEVAL_ERROR_CODE = {
    validation: 'CONTEXT_RETRIEVAL_VALIDATION',
    operationFailed: 'CONTEXT_RETRIEVAL_OPERATION_FAILED',
    transient: 'CONTEXT_RETRIEVAL_TRANSIENT'
} as const;

const CONTEXT_RETRIEVAL_UI_MESSAGE_KEYS = {
    ready: 'contextRetrieval.health.ready',
    empty: 'contextRetrieval.health.empty',
    failure: 'contextRetrieval.health.failure'
} as const;

type ContextRetrievalErrorCode = typeof CONTEXT_RETRIEVAL_ERROR_CODE[keyof typeof CONTEXT_RETRIEVAL_ERROR_CODE];

export interface ContextRetrievalHealthSnapshot {
    status: 'healthy' | 'degraded';
    uiState: 'ready' | 'empty' | 'failure';
    messageKey: string;
    budgets: {
        standardMs: number;
    };
    metrics: {
        totalRequests: number;
        failedRequests: number;
        validationFailures: number;
        retries: number;
        fallbackResponses: number;
        budgetExceededCount: number;
        lastDurationMs: number;
        lastErrorCode?: ContextRetrievalErrorCode;
        lastRetrievedAt?: number;
        errorRate: number;
    };
}

export class ContextRetrievalService {
    static readonly serviceName = 'contextRetrievalService';
    static readonly dependencies = ['db', 'embedding'] as const;
    private analytics = {
        totalRequests: 0,
        failedRequests: 0,
        totalSources: 0,
        totalContextLength: 0,
        lastRetrievedAt: 0,
        queryCounts: new Map<string, number>(),
        validationFailures: 0,
        retries: 0,
        fallbackResponses: 0,
        budgetExceededCount: 0,
        lastDurationMs: 0,
        lastErrorCode: undefined as ContextRetrievalErrorCode | undefined
    };

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService
    ) { }

    async retrieveContext(query: string, workspaceId?: string, limit: number = 5): Promise<RetrievalResult> {
        const startedAt = Date.now();
        try {
            this.analytics.totalRequests++;
            const parsed = ContextRetrievalInputSchema.safeParse({ query, workspaceId: workspaceId, limit });
            if (!parsed.success) {
                this.analytics.validationFailures++;
                this.analytics.failedRequests++;
                this.analytics.lastErrorCode = CONTEXT_RETRIEVAL_ERROR_CODE.validation;
                this.finalizeDurationMetric(startedAt);
                appLogger.warn(CONTEXT_RETRIEVAL_SERVICE_NAME, `Validation failed: ${parsed.error.issues[0]?.message ?? 'Unknown validation issue'}`);
                return { contextString: '', sources: [] };
            }

            const normalizedQuery = parsed.data.query.trim();
            const effectiveLimit = parsed.data.limit ?? 5;
            const effectiveWorkspaceId = parsed.data.workspaceId ?? workspaceId;

            let workspacePath: string | undefined;
            if (effectiveWorkspaceId) {
                // Try to find workspace by ID to get its path
                const workspaces = await this.db.getWorkspaces();
                const workspace = workspaces.find(p => p.id === effectiveWorkspaceId || p.path === effectiveWorkspaceId);
                workspacePath = workspace?.path ?? effectiveWorkspaceId; // Fallback to workspaceId if it's already a path
            }

            const vector = await this.generateEmbeddingWithRetry(normalizedQuery);

            // Parallel search with partial-failure tolerance
            const [symbolsResult, fragmentsResult] = await Promise.allSettled([
                this.db.searchCodeSymbols(vector, workspacePath),
                this.db.searchSemanticFragments(vector, effectiveLimit, workspacePath)
            ]);
            const symbols =
                symbolsResult.status === 'fulfilled' ? symbolsResult.value : [];
            const fragments =
                fragmentsResult.status === 'fulfilled' ? fragmentsResult.value : [];
            if (symbolsResult.status === 'rejected' || fragmentsResult.status === 'rejected') {
                this.analytics.fallbackResponses++;
            }

            if (symbolsResult.status === 'rejected') {
                appLogger.warn(
                    CONTEXT_RETRIEVAL_SERVICE_NAME,
                    `Code symbol search failed: ${symbolsResult.reason instanceof Error ? symbolsResult.reason.message : String(symbolsResult.reason)}`
                );
            }
            if (fragmentsResult.status === 'rejected') {
                appLogger.warn(
                    CONTEXT_RETRIEVAL_SERVICE_NAME,
                    `Semantic fragment search failed: ${fragmentsResult.reason instanceof Error ? fragmentsResult.reason.message : String(fragmentsResult.reason)}`
                );
            }

            const contextParts: string[] = [];
            const sourceSet = new Set<string>();
            const scoredItems: ScoredContextItem[] = [];

            if (symbols.length > 0) {
                contextParts.push("Relevant Code Symbols:");
                const sortedSymbols = symbols
                    .slice()
                    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
                sortedSymbols.slice(0, 3).forEach(sym => {
                    contextParts.push(`- ${sym.kind} ${sym.name} (${sym.path}:${sym.line})\n  ${sym.signature}\n  ${sym.docstring}`);
                    sourceSet.add(sym.path);
                    scoredItems.push({
                        source: sym.path,
                        sourceId: sym.id,
                        content: `${sym.kind} ${sym.name}: ${sym.signature}`,
                        score: sym.score ?? 0.8
                    });
                });
            }

            if (fragments.length > 0) {
                contextParts.push("\nRelevant Context:");
                const dedupedFragments = this.deduplicateFragments(fragments);
                dedupedFragments.slice(0, effectiveLimit).forEach(frag => {
                    const snippet = frag.content.trim().substring(0, 300);
                    contextParts.push(`- [${frag.source}] ${snippet}...`);
                    sourceSet.add(frag.sourceId);
                    scoredItems.push({
                        source: frag.source,
                        sourceId: frag.sourceId,
                        content: snippet,
                        score: this.getFragmentScore(frag)
                    });
                });
            }

            const summary = this.summarizeContext(scoredItems, 4);
            if (summary.length > 0) {
                contextParts.unshift('Context Summary:');
                contextParts.unshift(summary.map(item => `- ${item}`).join('\n'));
            }

            appLogger.info(
                CONTEXT_RETRIEVAL_SERVICE_NAME,
                `Retrieved context with ${scoredItems.length} items and ${sourceSet.size} unique sources`
            );

            const result = {
                contextString: contextParts.join('\n'),
                sources: Array.from(sourceSet)
            };
            this.recordRetrievalAnalytics(normalizedQuery, result);
            this.analytics.lastErrorCode = undefined;
            this.finalizeDurationMetric(startedAt);
            return result;

        } catch (error) {
            this.analytics.failedRequests++;
            this.analytics.lastErrorCode = CONTEXT_RETRIEVAL_ERROR_CODE.operationFailed;
            this.finalizeDurationMetric(startedAt);
            appLogger.error(CONTEXT_RETRIEVAL_SERVICE_NAME, 'Failed to retrieve context', error as Error);
            return { contextString: '', sources: [] };
        }
    }

    getAnalytics(): RetrievalAnalytics {
        const totalRequests = this.analytics.totalRequests;
        const averageSources = totalRequests === 0 ? 0 : this.analytics.totalSources / totalRequests;
        const averageContextLength = totalRequests === 0 ? 0 : this.analytics.totalContextLength / totalRequests;
        const topQueries = Array.from(this.analytics.queryCounts.entries())
            .sort((left, right) => right[1] - left[1])
            .slice(0, 10)
            .map(([query, count]) => ({ query, count }));

        return {
            totalRequests,
            failedRequests: this.analytics.failedRequests,
            averageSources,
            averageContextLength,
            topQueries,
            lastRetrievedAt: this.analytics.lastRetrievedAt || undefined
        };
    }

    async exportContext(query: string, workspaceId?: string, limit: number = 5): Promise<{
        exportedAt: string;
        query: string;
        workspaceId?: string;
        contextString: string;
        sources: string[];
    }> {
        const result = await this.retrieveContext(query, workspaceId, limit);
        return {
            exportedAt: new Date().toISOString(),
            query,
            workspaceId,
            contextString: result.contextString,
            sources: result.sources
        };
    }

    getHealthStatus(): ContextRetrievalHealthSnapshot {
        const totalRequests = this.analytics.totalRequests;
        const failedRequests = this.analytics.failedRequests;
        const errorRate = totalRequests === 0 ? 0 : failedRequests / totalRequests;

        const uiState = totalRequests === 0
            ? 'empty'
            : failedRequests > 0
                ? 'failure'
                : 'ready';
        const status = errorRate > 0.05 || this.analytics.budgetExceededCount > 0
            ? 'degraded'
            : 'healthy';

        return {
            status,
            uiState,
            messageKey: CONTEXT_RETRIEVAL_UI_MESSAGE_KEYS[uiState],
            budgets: {
                standardMs: CONTEXT_RETRIEVAL_BUDGET_MS
            },
            metrics: {
                totalRequests,
                failedRequests,
                validationFailures: this.analytics.validationFailures,
                retries: this.analytics.retries,
                fallbackResponses: this.analytics.fallbackResponses,
                budgetExceededCount: this.analytics.budgetExceededCount,
                lastDurationMs: this.analytics.lastDurationMs,
                lastErrorCode: this.analytics.lastErrorCode,
                lastRetrievedAt: this.analytics.lastRetrievedAt || undefined,
                errorRate
            }
        };
    }

    private deduplicateFragments(fragments: SemanticFragment[]): SemanticFragment[] {
        const seen = new Set<string>();
        const deduped: SemanticFragment[] = [];

        for (const fragment of fragments) {
            const normalized = fragment.content.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 180);
            const key = `${fragment.sourceId}:${normalized}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            deduped.push(fragment);
        }

        return deduped;
    }

    private getFragmentScore(fragment: SemanticFragment): number {
        const rawScore = fragment.score;
        if (typeof rawScore === 'number' && Number.isFinite(rawScore)) {
            return rawScore;
        }
        return 0.7;
    }

    private summarizeContext(items: ScoredContextItem[], maxItems: number): string[] {
        if (items.length === 0) {
            return [];
        }

        const sorted = items
            .slice()
            .sort((left, right) => right.score - left.score)
            .slice(0, maxItems);

        return sorted.map(item => `${item.source}: ${item.content}`);
    }

    private recordRetrievalAnalytics(query: string, result: RetrievalResult): void {
        this.analytics.lastRetrievedAt = Date.now();
        this.analytics.totalSources += result.sources.length;
        this.analytics.totalContextLength += result.contextString.length;

        const normalizedQuery = query.trim().slice(0, 120);
        if (!normalizedQuery) {
            return;
        }
        const currentCount = this.analytics.queryCounts.get(normalizedQuery) ?? 0;
        this.analytics.queryCounts.set(normalizedQuery, currentCount + 1);
    }

    private finalizeDurationMetric(startedAt: number): void {
        const durationMs = Date.now() - startedAt;
        this.analytics.lastDurationMs = durationMs;
        if (durationMs > CONTEXT_RETRIEVAL_BUDGET_MS) {
            this.analytics.budgetExceededCount += 1;
            appLogger.warn(CONTEXT_RETRIEVAL_SERVICE_NAME, `Performance budget exceeded: ${durationMs}ms > ${CONTEXT_RETRIEVAL_BUDGET_MS}ms`);
        }
    }

    private async generateEmbeddingWithRetry(query: string): Promise<number[]> {
        return withRetry(
            () => this.embedding.generateEmbedding(query),
            {
                maxRetries: CONTEXT_RETRIEVAL_RETRY_ATTEMPTS - 1,
                baseDelayMs: CONTEXT_RETRIEVAL_RETRY_DELAY_MS,
                maxDelayMs: CONTEXT_RETRIEVAL_RETRY_DELAY_MS,
                jitterFactor: 0,
                shouldRetry: () => true,
                onRetry: (error, attempt) => {
                    this.analytics.retries++;
                    this.analytics.lastErrorCode = CONTEXT_RETRIEVAL_ERROR_CODE.transient;
                    const message = error instanceof Error ? error.message : String(error);
                    appLogger.warn(CONTEXT_RETRIEVAL_SERVICE_NAME, `Embedding retry ${attempt + 1}/${CONTEXT_RETRIEVAL_RETRY_ATTEMPTS - 1}: ${message}`);
                },
            }
        );
    }
}

