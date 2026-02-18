import { appLogger } from '@main/logging/logger';
import { DatabaseService, SemanticFragment } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';

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

export class ContextRetrievalService {
    private analytics = {
        totalRequests: 0,
        failedRequests: 0,
        totalSources: 0,
        totalContextLength: 0,
        lastRetrievedAt: 0,
        queryCounts: new Map<string, number>()
    };

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService
    ) { }

    async retrieveContext(query: string, projectId?: string, limit: number = 5): Promise<RetrievalResult> {
        try {
            this.analytics.totalRequests++;
            let projectPath: string | undefined;
            if (projectId) {
                // Try to find project by ID to get its path
                const projects = await this.db.getProjects();
                const project = projects.find(p => p.id === projectId || p.path === projectId);
                projectPath = project?.path ?? projectId; // Fallback to projectId if it's already a path
            }

            const vector = await this.embedding.generateEmbedding(query);

            // Parallel search with partial-failure tolerance
            const [symbolsResult, fragmentsResult] = await Promise.allSettled([
                this.db.searchCodeSymbols(vector, projectPath),
                this.db.searchSemanticFragments(vector, limit, projectPath)
            ]);
            const symbols =
                symbolsResult.status === 'fulfilled' ? symbolsResult.value : [];
            const fragments =
                fragmentsResult.status === 'fulfilled' ? fragmentsResult.value : [];

            if (symbolsResult.status === 'rejected') {
                appLogger.warn(
                    'ContextRetrieval',
                    `Code symbol search failed: ${symbolsResult.reason instanceof Error ? symbolsResult.reason.message : String(symbolsResult.reason)}`
                );
            }
            if (fragmentsResult.status === 'rejected') {
                appLogger.warn(
                    'ContextRetrieval',
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
                dedupedFragments.slice(0, limit).forEach(frag => {
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
                'ContextRetrieval',
                `Retrieved context with ${scoredItems.length} items and ${sourceSet.size} unique sources`
            );

            const result = {
                contextString: contextParts.join('\n'),
                sources: Array.from(sourceSet)
            };
            this.recordRetrievalAnalytics(query, result);
            return result;

        } catch (error) {
            this.analytics.failedRequests++;
            appLogger.error('ContextRetrieval', 'Failed to retrieve context', error as Error);
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

    async exportContext(query: string, projectId?: string, limit: number = 5): Promise<{
        exportedAt: string;
        query: string;
        projectId?: string;
        contextString: string;
        sources: string[];
    }> {
        const result = await this.retrieveContext(query, projectId, limit);
        return {
            exportedAt: new Date().toISOString(),
            query,
            projectId,
            contextString: result.contextString,
            sources: result.sources
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
}
