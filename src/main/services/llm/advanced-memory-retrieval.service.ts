import { EpisodicMemory } from '@main/services/data/database.service';
import { ChatMessage } from '@main/types/llm.types';
import {
    AdvancedMemoryConfig,
    AdvancedSemanticFragment,
    MemoryCategory,
    MemoryScoreFactors,
    MemorySearchHistoryEntry,
    RecallContext,
    RecallResult,
} from '@shared/types/advanced-memory';

type SearchAnalyticsType = 'semantic' | 'text' | 'hybrid';

interface SearchAnalyticsState {
    totalQueries: number
    semanticQueries: number
    textQueries: number
    hybridQueries: number
    totalResultsReturned: number
    lastQueryAt: number
    queryCounts: Map<string, number>
    history: MemorySearchHistoryEntry[]
}

interface RetrievalDependencies {
    config: AdvancedMemoryConfig
    searchAnalytics: SearchAnalyticsState
    recall: (context: RecallContext) => Promise<RecallResult>
    scoreMemory: (
        memory: AdvancedSemanticFragment,
        queryEmbedding: number[]
    ) => MemoryScoreFactors
    searchMemoriesByVector: (
        embedding: number[],
        limit: number
    ) => Promise<AdvancedSemanticFragment[]>
    getAllAdvancedMemories: () => Promise<AdvancedSemanticFragment[]>
    updateAccessTracking: (id: string) => Promise<void>
    recallEpisodes: (query: string, limit?: number) => Promise<EpisodicMemory[]>
    getAvailableModel: () => Promise<string | null>
    callLLM: (
        messages: ChatMessage[],
        model: string,
        provider?: string
    ) => Promise<{ content: string }>
}

export class AdvancedMemoryRetrievalService {
    constructor(private readonly deps: RetrievalDependencies) {}

    async performRecall(
        context: RecallContext,
        queryEmbedding: number[]
    ): Promise<RecallResult> {
        const limit = context.limit ?? this.deps.config.defaultRecallLimit;
        let candidates = await this.deps.searchMemoriesByVector(queryEmbedding, limit * 3);
        candidates = this.applyRecallFilters(candidates, context);

        const scores = new Map<string, MemoryScoreFactors>();
        const scoredCandidates: Array<{ memory: AdvancedSemanticFragment; finalScore: number }> = [];

        for (const memory of candidates) {
            const factors = this.deps.scoreMemory(memory, queryEmbedding);
            scores.set(memory.id, factors);

            const finalScore =
                factors.baseImportance * 0.2 +
                factors.recencyBoost * 0.15 +
                factors.accessBoost * 0.1 +
                factors.relevanceScore * 0.4 +
                factors.confidenceWeight * 0.15;

            scoredCandidates.push({ memory, finalScore });
        }

        scoredCandidates.sort((left, right) => right.finalScore - left.finalScore);

        let results = scoredCandidates.slice(0, limit).map(candidate => candidate.memory);
        if (context.diversityFactor && context.diversityFactor > 0) {
            results = this.applyDiversity(scoredCandidates, limit, context.diversityFactor);
        }

        for (const memory of results) {
            await this.deps.updateAccessTracking(memory.id);
        }

        return {
            memories: results,
            scores,
            totalMatches: candidates.length,
            queryEmbedding,
        };
    }

    async recallRelevantFacts(
        query: string,
        limit: number = 5
    ): Promise<AdvancedSemanticFragment[]> {
        const result = await this.deps.recall({ query, limit });
        this.recordSearchAnalytics(query, 'semantic', result.memories.length);
        return result.memories;
    }

    async searchMemoriesHybrid(
        query: string,
        limit: number = 10
    ): Promise<AdvancedSemanticFragment[]> {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
            return [];
        }

        const safeLimit = Math.max(1, Math.min(100, limit));
        const semantic = await this.deps.recall({
            query: normalizedQuery,
            limit: safeLimit * 2,
        });
        const lexical = this.rankLexicalMatches(
            normalizedQuery,
            await this.deps.getAllAdvancedMemories(),
            safeLimit * 2
        );

        const combined = new Map<string, { memory: AdvancedSemanticFragment; score: number }>();
        this.mergeScoredResults(combined, semantic.memories, 0.7);
        this.mergeScoredResults(combined, lexical, 0.3);

        const ranked = Array.from(combined.values())
            .sort((left, right) => right.score - left.score)
            .slice(0, safeLimit)
            .map(item => item.memory);

        this.recordSearchAnalytics(normalizedQuery, 'hybrid', ranked.length);
        return ranked;
    }

    async exportMemories(
        query?: string,
        limit: number = 200
    ): Promise<{
        exportedAt: string
        query?: string
        count: number
        memories: AdvancedSemanticFragment[]
    }> {
        const safeLimit = Math.max(1, Math.min(1000, limit));
        const memories = query?.trim()
            ? await this.searchMemoriesHybrid(query, safeLimit)
            : (await this.deps.getAllAdvancedMemories()).slice(0, safeLimit);

        return {
            exportedAt: new Date().toISOString(),
            query: query?.trim() || undefined,
            count: memories.length,
            memories,
        };
    }

    async gatherContext(query: string): Promise<string> {
        const facts = await this.recallRelevantFacts(query, 3);
        const episodes = await this.deps.recallEpisodes(query, 2);

        let context = '';
        if (facts.length > 0) {
            context += `Related Facts:\n${facts.map(fact => `- ${fact.content}`).join('\n')}\n\n`;
        }
        if (episodes.length > 0) {
            context += `Related Episodes:\n${episodes.map(episode => `- ${episode.summary}`).join('\n')}`;
        }
        return context;
    }

    private applyDiversity(
        scoredCandidates: Array<{ memory: AdvancedSemanticFragment; finalScore: number }>,
        limit: number,
        diversityFactor: number
    ): AdvancedSemanticFragment[] {
        const results: AdvancedSemanticFragment[] = [];
        const usedCategories = new Set<MemoryCategory>();

        for (const candidate of scoredCandidates) {
            if (results.length >= limit) {
                break;
            }

            const categoryPenalty = usedCategories.has(candidate.memory.category)
                ? diversityFactor * 0.3
                : 0;

            if (candidate.finalScore - categoryPenalty > 0.1 || results.length < 3) {
                results.push(candidate.memory);
                usedCategories.add(candidate.memory.category);
            }
        }

        return results;
    }

    private applyRecallFilters(
        memories: AdvancedSemanticFragment[],
        context: RecallContext
    ): AdvancedSemanticFragment[] {
        return memories.filter(memory => this.matchesRecallFilters(memory, context));
    }

    private matchesRecallFilters(
        memory: AdvancedSemanticFragment,
        context: RecallContext
    ): boolean {
        return (
            this.matchesBasicFilters(memory, context) &&
            this.matchesTimeFilters(memory, context) &&
            this.matchesScoreFilters(memory, context) &&
            this.matchesStatusFilters(memory, context)
        );
    }

    private matchesBasicFilters(
        memory: AdvancedSemanticFragment,
        context: RecallContext
    ): boolean {
        if (context.workspaceId && memory.workspaceId !== context.workspaceId) {
            return false;
        }
        if (context.categories && !context.categories.includes(memory.category)) {
            return false;
        }
        if (context.tags && !context.tags.some(tag => memory.tags.includes(tag))) {
            return false;
        }
        return true;
    }

    private matchesTimeFilters(
        memory: AdvancedSemanticFragment,
        context: RecallContext
    ): boolean {
        if (context.createdAfter && memory.createdAt < context.createdAfter) {
            return false;
        }
        if (context.createdBefore && memory.createdAt > context.createdBefore) {
            return false;
        }
        return true;
    }

    private matchesScoreFilters(
        memory: AdvancedSemanticFragment,
        context: RecallContext
    ): boolean {
        if (context.minConfidence && memory.confidence < context.minConfidence) {
            return false;
        }
        if (context.minImportance && memory.importance < context.minImportance) {
            return false;
        }
        return true;
    }

    private matchesStatusFilters(
        memory: AdvancedSemanticFragment,
        context: RecallContext
    ): boolean {
        if (!context.includeArchived && memory.status === 'archived') {
            return false;
        }
        if (!context.includePending && memory.status === 'pending') {
            return false;
        }
        return true;
    }

    private rankLexicalMatches(
        query: string,
        memories: AdvancedSemanticFragment[],
        limit: number
    ): AdvancedSemanticFragment[] {
        const queryTerms = query.split(/\s+/).filter(Boolean);
        if (queryTerms.length === 0) {
            return [];
        }

        const scored = memories
            .map(memory => {
                const haystack = `${memory.content} ${memory.tags.join(' ')}`.toLowerCase();
                let score = 0;
                for (const term of queryTerms) {
                    if (haystack.includes(term)) {
                        score += 1;
                    }
                }
                if (score === 0) {
                    return null;
                }
                return { memory, score };
            })
            .filter(
                (
                    item
                ): item is { memory: AdvancedSemanticFragment; score: number } => item !== null
            )
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);

        this.recordSearchAnalytics(query, 'text', scored.length);
        return scored.map(item => item.memory);
    }

    private mergeScoredResults(
        target: Map<string, { memory: AdvancedSemanticFragment; score: number }>,
        memories: AdvancedSemanticFragment[],
        weight: number
    ): void {
        for (let index = 0; index < memories.length; index += 1) {
            const memory = memories[index];
            const rankScore = weight * (1 / (index + 1));
            const existing = target.get(memory.id);
            if (existing) {
                existing.score += rankScore;
                continue;
            }
            target.set(memory.id, { memory, score: rankScore });
        }
    }

    private recordSearchAnalytics(
        query: string,
        type: SearchAnalyticsType,
        resultCount: number
    ): void {
        const analytics = this.deps.searchAnalytics;
        analytics.totalQueries += 1;
        analytics.lastQueryAt = Date.now();
        analytics.totalResultsReturned += resultCount;

        if (type === 'semantic') {
            analytics.semanticQueries += 1;
        }
        if (type === 'text') {
            analytics.textQueries += 1;
        }
        if (type === 'hybrid') {
            analytics.hybridQueries += 1;
        }

        const normalizedQuery = query.trim().slice(0, 120);
        if (!normalizedQuery) {
            return;
        }

        const currentCount = analytics.queryCounts.get(normalizedQuery) ?? 0;
        analytics.queryCounts.set(normalizedQuery, currentCount + 1);
        analytics.history.push({
            query: normalizedQuery,
            type,
            resultCount,
            timestamp: analytics.lastQueryAt,
        });

        if (analytics.history.length > 200) {
            analytics.history = analytics.history.slice(-200);
        }
    }
}
