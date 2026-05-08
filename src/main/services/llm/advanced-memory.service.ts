/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Advanced Memory Service
 *
 * A sophisticated memory system that surpasses ChatGPT/Claude memory with:
 * - Staging buffer with validation gate (stop saving unnecessary things)
 * - Confidence scoring and importance calculation
 * - Contradiction detection and resolution
 * - Memory decay and access tracking
 * - Memory consolidation (merge similar facts)
 * - Context-aware recall
 */

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { DatabaseService, EntityKnowledge, EpisodicMemory } from '@main/services/data/database.service';
import { AdvancedMemoryIndexingService } from '@main/services/llm/advanced-memory-indexing.service';
import { AdvancedMemoryMaintenanceService } from '@main/services/llm/advanced-memory-maintenance.service';
import { AdvancedMemoryNormalizationAdapter } from '@main/services/llm/advanced-memory-normalization.adapter';
import { AdvancedMemoryPersistenceAdapter } from '@main/services/llm/advanced-memory-persistence.adapter';
import { AdvancedMemoryRetrievalService } from '@main/services/llm/advanced-memory-retrieval.service';
import {
    BackgroundModelResolver,
    BackgroundModelSelection
} from '@main/services/llm/background-model-resolver.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { SettingsService } from '@main/services/system/settings.service';
import { ChatMessage } from '@main/types/llm.types';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { withRetry } from '@main/utils/retry.util';
import { ADVANCED_MEMORY_CHANNELS } from '@shared/constants/ipc-channels';
import {
    AdvancedMemoryImportPayloadSchema,
    AdvancedMemoryRecallContextSchema
} from '@shared/schemas/service-hardening.schema';
import {
    AdvancedMemoryConfig,
    AdvancedSemanticFragment,
    coerceMemoryCategory,
    ConsolidationResult,
    ContradictionCandidate,
    DEFAULT_MEMORY_CONFIG,
    MemoryCategory,
    MemoryImportResult,
    MemoryScoreFactors,
    MemorySearchAnalytics,
    MemorySearchHistoryEntry,
    MemorySource,
    MemoryStatistics,
    MemoryStatus,
    MemoryVersion,
    PendingMemory,
    RecallContext,
    RecallResult,
    SharedMemoryAnalytics,
    SharedMemoryMergeConflict,
    SharedMemoryNamespace,
    SharedMemorySyncRequest,
    SharedMemorySyncResult,
    SimilarMemoryCandidate
} from '@shared/types/advanced-memory';
import { RuntimeValue } from '@shared/types/common';
import { JsonObject } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

const SERVICE_NAME = 'AdvancedMemoryService';
const ADVANCED_MEMORY_RETRY_ATTEMPTS = 2;
const ADVANCED_MEMORY_RETRY_DELAY_MS = 35;
const ADVANCED_MEMORY_BUDGET_MS = 900;

const ADVANCED_MEMORY_ERROR_CODE = {
    validation: 'ADVANCED_MEMORY_VALIDATION',
    operationFailed: 'ADVANCED_MEMORY_OPERATION_FAILED',
    transient: 'ADVANCED_MEMORY_TRANSIENT'
} as const;

const ADVANCED_MEMORY_UI_MESSAGE_KEYS = {
    ready: 'advancedMemory.health.ready',
    empty: 'advancedMemory.health.empty',
    failure: 'advancedMemory.health.failure'
} as const;

type AdvancedMemoryErrorCode = typeof ADVANCED_MEMORY_ERROR_CODE[keyof typeof ADVANCED_MEMORY_ERROR_CODE];

export interface AdvancedMemoryHealthSnapshot {
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
        lastErrorCode?: AdvancedMemoryErrorCode;
        errorRate: number;
    };
}

// Models are now managed via SettingsService

interface OllamaTagsResponse {
    models: { name: string }[];
}

export interface SummarizationResult {
    summary: string;
    title: string;
    topics: string[];
    pendingTasks: string[];
}

export type PersonalitySettings = {
    traits: string[];
    responseStyle: 'formal' | 'casual' | 'professional' | 'playful';
    allowProfanity: boolean;
    customInstructions: string;
} & JsonObject;

export interface AdvancedMemoryDeps {
    db: DatabaseService;
    embedding: EmbeddingService;
    llmService: LLMService;
    settings: SettingsService;
    backgroundModelResolver?: BackgroundModelResolver;
}

export class AdvancedMemoryService {
    private config: AdvancedMemoryConfig;
    private stagingBuffer: Map<string, PendingMemory> = new Map();
    private sharedNamespaces = new Map<string, SharedMemoryNamespace>();
    private readonly searchCacheTtlMs = 15_000;
    private readonly snapshotCacheTtlMs = 10_000;
    private searchCache = new Map<string, { expiresAt: number; value: AdvancedSemanticFragment[] }>();
    private memorySnapshot: { expiresAt: number; value: AdvancedSemanticFragment[] } | null = null;
    private memorySnapshotRefresh: Promise<void> | null = null;
    private cachedBackgroundModel: BackgroundModelSelection | null = null;
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;
    private searchAnalytics = {
        totalQueries: 0,
        semanticQueries: 0,
        textQueries: 0,
        hybridQueries: 0,
        totalResultsReturned: 0,
        lastQueryAt: 0,
        queryCounts: new Map<string, number>(),
        history: [] as MemorySearchHistoryEntry[]
    };
    private operationalAnalytics = {
        totalRequests: 0,
        failedRequests: 0,
        validationFailures: 0,
        retries: 0,
        fallbackResponses: 0,
        budgetExceededCount: 0,
        lastDurationMs: 0,
        lastErrorCode: undefined as AdvancedMemoryErrorCode | undefined
    };
    private readonly retrievalService: AdvancedMemoryRetrievalService;
    private readonly maintenanceService: AdvancedMemoryMaintenanceService;
    private readonly indexingService: AdvancedMemoryIndexingService;
    private readonly normalizationAdapter: AdvancedMemoryNormalizationAdapter;
    private readonly persistenceAdapter: AdvancedMemoryPersistenceAdapter;
    private readonly db: DatabaseService;
    private readonly embedding: EmbeddingService;
    private readonly llmService: LLMService;
    private readonly settings: SettingsService;
    private readonly backgroundModelResolver?: BackgroundModelResolver;

    constructor(
        deps: AdvancedMemoryDeps,
        config?: Partial<AdvancedMemoryConfig>
    ) {
        this.db = deps.db;
        this.embedding = deps.embedding;
        this.llmService = deps.llmService;
        this.settings = deps.settings;
        this.backgroundModelResolver = deps.backgroundModelResolver;
        this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
        this.normalizationAdapter = new AdvancedMemoryNormalizationAdapter({
            generateId: this.generateId.bind(this)
        });
        this.persistenceAdapter = new AdvancedMemoryPersistenceAdapter(this.db);
        this.retrievalService = new AdvancedMemoryRetrievalService({
            config: this.config,
            searchAnalytics: this.searchAnalytics,
            recall: this.recall.bind(this),
            scoreMemory: this.calculateMemoryScore.bind(this),
            searchMemoriesByVector: this.searchMemoriesByVector.bind(this),
            getAllAdvancedMemories: this.getAllAdvancedMemories.bind(this),
            updateAccessTracking: this.updateAccessTracking.bind(this),
            recallEpisodes: this.recallEpisodes.bind(this),
            getAvailableModel: this.getAvailableModel.bind(this),
            callLLM: this.callLLM.bind(this),
        });
        this.maintenanceService = new AdvancedMemoryMaintenanceService({
            config: this.config,
            db: this.db,
            stagingBuffer: this.stagingBuffer,
            getAllAdvancedMemories: this.getAllAdvancedMemories.bind(this),
            updateAdvancedMemory: this.updateAdvancedMemory.bind(this),
            getMemoryById: this.getMemoryById.bind(this),
            getPendingMemories: this.getPendingMemories.bind(this),
            getAvailableModel: this.getAvailableModel.bind(this),
            callLLM: this.callLLM.bind(this),
            editMemory: this.editMemory.bind(this),
            calculateDecayedImportance: this.calculateDecayedImportance.bind(this),
        });
        this.indexingService = new AdvancedMemoryIndexingService({
            config: this.config,
            generateEmbedding: this.embedding.generateEmbedding.bind(this.embedding),
            searchMemoriesByVector: this.searchMemoriesByVector.bind(this),
            getAvailableModel: this.getAvailableModel.bind(this),
            callLLM: this.callLLM.bind(this),
            getMemoryById: this.getMemoryById.bind(this),
            updateAdvancedMemory: this.updateAdvancedMemory.bind(this),
            updateMemoryStatus: this.updateMemoryStatus.bind(this),
            cosineSimilarity: this.cosineSimilarity.bind(this),
        });
    }

    async initialize(): Promise<void> {
        if (this.initializationPromise) {
            await this.initializationPromise;
            return;
        }
        if (this.isInitialized) { return; }

        this.isInitialized = true;
        this.initializationPromise = (async () => {
            try {
                void this.loadPendingMemories().then(() => {
                    void this.runDecayMaintenance().catch(error => {
                        appLogger.debug(SERVICE_NAME, `Background memory decay maintenance failed: ${String(error)}`);
                    });
                    this.warmMemorySnapshot();
                }).catch(error => {
                    appLogger.debug(SERVICE_NAME, `Background pending memory load failed: ${String(error)}`);
                });
            } finally {
                appLogger.info(SERVICE_NAME, 'Advanced memory service initialized');
            }
        })();
        await this.initializationPromise;
    }

    /** Clears staging buffers, shared namespaces, and analytics state. */
    async cleanup(): Promise<void> {
        this.stagingBuffer.clear();
        this.sharedNamespaces.clear();
        this.searchCache.clear();
        this.memorySnapshot = null;
        this.memorySnapshotRefresh = null;
        this.searchAnalytics.queryCounts.clear();
        this.searchAnalytics.history.length = 0;
        this.cachedBackgroundModel = null;
        this.isInitialized = false;
        appLogger.info(SERVICE_NAME, 'Advanced memory service cleaned up');
    }

    // ========================================================================
    // FACT EXTRACTION (Entry Point)
    // ========================================================================

    @ipc(ADVANCED_MEMORY_CHANNELS.EXTRACT_AND_STAGE)
    async extractAndStageFromMessageIpc(payload: { content: string; sourceId: string; workspaceId?: string }): Promise<RuntimeValue> {
        const { content, sourceId, workspaceId } = payload;
        const result = await this.extractAndStageFromMessage(content, sourceId, workspaceId);
        return serializeToIpc(result);
    }

    /**
     * Extract facts from a user message and stage them for validation
     */
    async extractAndStageFromMessage(
        content: string,
        sourceId: string,
        workspaceId?: string
    ): Promise<PendingMemory[]> {
        const startedAt = Date.now();
        this.operationalAnalytics.totalRequests++;

        if (!content.trim()) {
            this.operationalAnalytics.validationFailures++;
            this.operationalAnalytics.failedRequests++;
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.validation;
            this.finalizeOperationDuration(startedAt);
            return [];
        }

        // Skip if message is too short or likely not containing facts
        if (!this.shouldExtractFacts(content)) {
            this.operationalAnalytics.fallbackResponses++;
            this.finalizeOperationDuration(startedAt);
            return [];
        }

        const model = await this.getAvailableModel();
        if (!model) {
            appLogger.debug(SERVICE_NAME, 'No LLM available for extraction');
            this.operationalAnalytics.fallbackResponses++;
            this.finalizeOperationDuration(startedAt);
            return [];
        }

        try {
            const extracted = await this.extractFactsWithLLM(content, model);
            const pendingMemories: PendingMemory[] = [];

            for (const fact of extracted) {
                const pending = await this.createPendingMemory({
                    content: fact.content,
                    source: 'user_implicit',
                    sourceId,
                    sourceContext: content,
                    category: fact.category,
                    extractionConfidence: fact.confidence,
                    tags: fact.tags,
                    workspaceId
                });

                if (pending) {
                    pendingMemories.push(pending);
                }
            }

            this.operationalAnalytics.lastErrorCode = undefined;
            this.finalizeOperationDuration(startedAt);
            return pendingMemories;
        } catch (error) {
            this.operationalAnalytics.failedRequests++;
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.operationFailed;
            this.finalizeOperationDuration(startedAt);
            appLogger.error(SERVICE_NAME, `Extraction failed: ${error}`);
            return [];
        }
    }

    /**
     * Explicitly remember a fact (user said "remember this")
     */
    @ipc(ADVANCED_MEMORY_CHANNELS.REMEMBER)
    async rememberExplicitIpc(content: string, options?: { category?: MemoryCategory; tags?: string[]; workspaceId?: string }): Promise<RuntimeValue> {
        const memory = await this.rememberExplicit(
            content,
            'user-explicit',
            options?.category ?? 'fact',
            options?.tags ?? [],
            options?.workspaceId
        );
        return serializeToIpc(memory);
    }

    async rememberExplicit(
        content: string,
        sourceId: string,
        category: MemoryCategory = 'fact',
        tags: string[] = [],
        workspaceId?: string
    ): Promise<AdvancedSemanticFragment> {
        const startedAt = Date.now();
        this.operationalAnalytics.totalRequests++;
        if (!content.trim()) {
            this.operationalAnalytics.validationFailures++;
            this.operationalAnalytics.failedRequests++;
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.validation;
            this.finalizeOperationDuration(startedAt);
            throw new Error('Explicit memory content must not be empty');
        }
        try {
            const embedding = await this.generateEmbeddingWithRetry(content);
            const now = Date.now();
            const normalizedCategory = coerceMemoryCategory(category);

            const memory: AdvancedSemanticFragment = {
                id: this.generateId(),
                content,
                embedding,
                source: 'user_explicit',
                sourceId,
                category: normalizedCategory,
                tags,
                confidence: 1.0,  // User explicitly stated - maximum confidence
                importance: 0.9,  // High importance for explicit memories
                initialImportance: 0.9,
                status: 'confirmed',
                validatedAt: now,
                validatedBy: 'user',
                accessCount: 0,
                lastAccessedAt: now,
                relatedMemoryIds: [],
                contradictsIds: [],
                workspaceId,
                createdAt: now,
                updatedAt: now
            };

            // Check for contradictions and resolve
            await this.handleContradictions(memory);

            // Store
            await this.storeAdvancedMemory(memory);

            appLogger.info(SERVICE_NAME, `Explicit memory stored: "${content.substring(0, 50)}..."`);
            this.operationalAnalytics.lastErrorCode = undefined;
            this.finalizeOperationDuration(startedAt);
            return memory;
        } catch (error) {
            this.operationalAnalytics.failedRequests++;
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.operationFailed;
            this.finalizeOperationDuration(startedAt);
            throw error;
        }
    }

    // ========================================================================
    // STAGING BUFFER
    // ========================================================================

    /**
     * Create a pending memory in the staging buffer
     */
    private async createPendingMemory(params: {
        content: string;
        source: MemorySource;
        sourceId: string;
        sourceContext: string;
        category: MemoryCategory;
        extractionConfidence: number;
        tags: string[];
        workspaceId?: string;
    }): Promise<PendingMemory | null> {
        const { content, source, sourceId, sourceContext, category, extractionConfidence, tags, workspaceId } = params;
        const normalizedCategory = coerceMemoryCategory(category);
        // Check staging buffer limit
        if (this.stagingBuffer.size >= this.config.maxPendingMemories) {
            // Remove oldest pending memory
            const oldest = Array.from(this.stagingBuffer.values())
                .sort((a, b) => a.extractedAt - b.extractedAt)[0];
            this.stagingBuffer.delete(oldest.id);
        }

        const embedding = await this.embedding.generateEmbedding(content);

        // Calculate scores
        const relevanceScore = await this.calculateRelevanceScore(content, normalizedCategory);
        const noveltyScore = await this.calculateNoveltyScore(content, embedding);

        // Skip if too low confidence or not novel enough
        if (extractionConfidence < this.config.minExtractionConfidence) {
            appLogger.debug(SERVICE_NAME, `Skipping low confidence fact: ${content.substring(0, 30)}...`);
            return null;
        }

        if (noveltyScore < 0.3) {
            appLogger.debug(SERVICE_NAME, `Skipping non-novel fact: ${content.substring(0, 30)}...`);
            return null;
        }

        // Find potential contradictions
        const potentialContradictions = await this.findContradictions(content, embedding);

        // Find similar memories for potential consolidation
        const similarMemories = await this.findSimilarMemories(embedding);

        const pending: PendingMemory = {
            id: this.generateId(),
            content,
            embedding,
            source,
            sourceId,
            sourceContext,
            extractedAt: Date.now(),
            suggestedCategory: normalizedCategory,
            suggestedTags: tags,
            extractionConfidence,
            relevanceScore,
            noveltyScore,
            requiresUserValidation: this.shouldRequireUserValidation(
                extractionConfidence,
                relevanceScore,
                potentialContradictions.length
            ),
            potentialContradictions,
            similarMemories,
            workspaceId
        };

        this.stagingBuffer.set(pending.id, pending);
        await this.savePendingMemory(pending);

        // Auto-confirm if meets threshold
        if (this.shouldAutoConfirm(pending)) {
            await this.confirmPendingMemory(pending.id, 'auto');
            return null; // Already confirmed, not pending
        }

        appLogger.info(SERVICE_NAME, `Memory staged: "${content.substring(0, 50)}..." (confidence: ${extractionConfidence.toFixed(2)})`);
        return pending;
    }

    /**
     * Get all pending memories awaiting validation
     */
    @ipc(ADVANCED_MEMORY_CHANNELS.GET_PENDING)
    async getPendingMemoriesIpc(): Promise<RuntimeValue> {
        const pending = this.getPendingMemories();
        return serializeToIpc(pending);
    }

    getPendingMemories(): PendingMemory[] {
        return Array.from(this.stagingBuffer.values())
            .sort((a, b) => b.extractedAt - a.extractedAt);
    }

    /**
     * Confirm a pending memory (user validation)
     */
    @ipc(ADVANCED_MEMORY_CHANNELS.CONFIRM)
    async confirmPendingMemoryIpc(id: string, adjustments?: { content?: string; category?: MemoryCategory; tags?: string[]; importance?: number }): Promise<RuntimeValue> {
        const memory = await this.confirmPendingMemory(id, 'user', adjustments);
        return serializeToIpc(memory);
    }

    async confirmPendingMemory(
        id: string,
        validatedBy: 'user' | 'auto' = 'user',
        adjustments?: {
            content?: string;
            category?: MemoryCategory;
            tags?: string[];
            importance?: number;
        }
    ): Promise<AdvancedSemanticFragment | null> {
        const pending = this.stagingBuffer.get(id);
        if (!pending) {
            appLogger.warn(SERVICE_NAME, `Pending memory not found: ${id}`);
            return null;
        }

        const memory = await this.createMemoryFromPending(pending, validatedBy, adjustments);

        // Handle contradictions
        await this.handleContradictions(memory);

        // Handle consolidation with similar memories
        const consolidationResult = await this.attemptConsolidation(memory, pending.similarMemories);

        if (consolidationResult.action === 'merged' && consolidationResult.resultingMemoryId) {
            await this.removeFromStaging(id);
            return null;
        }

        // Store and cleanup
        await this.storeAdvancedMemory(memory);
        await this.removeFromStaging(id);

        appLogger.info(SERVICE_NAME, `Memory confirmed (${validatedBy}): "${memory.content.substring(0, 50)}..."`);
        return memory;
    }

    private async createMemoryFromPending(
        pending: PendingMemory,
        validatedBy: 'user' | 'auto',
        adjustments?: {
            content?: string;
            category?: MemoryCategory;
            tags?: string[];
            importance?: number;
        }
    ): Promise<AdvancedSemanticFragment> {
        const content = adjustments?.content ?? pending.content;
        const embedding = await this.resolveEmbedding(pending, adjustments?.content);
        const importance = adjustments?.importance ?? this.calculateInitialImportance(pending);

        return this.assembleMemoryFragment({ pending, content, embedding, importance, validatedBy, adjustments });
    }

    private assembleMemoryFragment(params: {
        pending: PendingMemory;
        content: string;
        embedding: number[];
        importance: number;
        validatedBy: 'user' | 'auto';
        adjustments?: { category?: MemoryCategory; tags?: string[] };
    }): AdvancedSemanticFragment {
        const { pending, content, embedding, importance, validatedBy, adjustments } = params;
        const now = Date.now();
        return {
            id: pending.id,
            content,
            embedding,
            source: pending.source,
            sourceId: pending.sourceId,
            sourceContext: pending.sourceContext,
            category: adjustments?.category ?? pending.suggestedCategory,
            tags: adjustments?.tags ?? pending.suggestedTags,
            confidence: validatedBy === 'user' ? 1.0 : pending.extractionConfidence,
            importance,
            initialImportance: importance,
            status: 'confirmed',
            validatedAt: now,
            validatedBy,
            accessCount: 0,
            lastAccessedAt: now,
            relatedMemoryIds: [],
            contradictsIds: [],
            workspaceId: pending.workspaceId,
            createdAt: now,
            updatedAt: now
        };
    }

    private async resolveEmbedding(pending: PendingMemory, newContent?: string): Promise<number[]> {
        if (newContent) {
            return await this.embedding.generateEmbedding(newContent);
        }
        return pending.embedding;
    }

    private async removeFromStaging(id: string): Promise<void> {
        this.stagingBuffer.delete(id);
        await this.deletePendingMemory(id);
    }

    /**
     * Reject a pending memory
     */
    async rejectPendingMemory(id: string, reason?: string): Promise<void> {
        const pending = this.stagingBuffer.get(id);
        if (!pending) { return; }

        appLogger.info(SERVICE_NAME, `Memory rejected: "${pending.content.substring(0, 50)}..." ${reason ? `(${reason})` : ''}`);

        this.stagingBuffer.delete(id);
        await this.deletePendingMemory(id);
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.CONFIRM_ALL)
    async confirmAllIpc(): Promise<RuntimeValue> {
        const pending = this.getPendingMemories();
        let confirmed = 0;
        for (const p of pending) {
            if (!p.requiresUserValidation) {
                await this.confirmPendingMemory(p.id, 'user');
                confirmed++;
            }
        }
        return serializeToIpc({ confirmed });
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.REJECT_ALL)
    async rejectAllIpc(): Promise<RuntimeValue> {
        const pending = this.getPendingMemories();
        for (const p of pending) {
            await this.rejectPendingMemory(p.id, 'Bulk rejection');
        }
        return serializeToIpc({ rejected: pending.length });
    }

    // ========================================================================
    // CONTEXT-AWARE RECALL
    // ========================================================================

    /**
     * Recall memories with full context awareness
     */
    @ipc(ADVANCED_MEMORY_CHANNELS.RECALL)
    async recallIpc(context: RecallContext): Promise<RuntimeValue> {
        const result = await this.recall(context);
        return serializeToIpc(result);
    }

    async recall(context: RecallContext): Promise<RecallResult> {
        const startedAt = Date.now();
        this.operationalAnalytics.totalRequests++;

        const parsed = AdvancedMemoryRecallContextSchema.safeParse(context);
        if (!parsed.success) {
            this.operationalAnalytics.validationFailures++;
            this.operationalAnalytics.failedRequests++;
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.validation;
            this.finalizeOperationDuration(startedAt);
            appLogger.warn(SERVICE_NAME, `Recall validation failed: ${parsed.error.issues[0]?.message ?? 'unknown validation issue'}`);
            return {
                memories: [],
                scores: new Map<string, MemoryScoreFactors>(),
                totalMatches: 0,
                queryEmbedding: []
            };
        }

        try {
            const recallContext = parsed.data as RecallContext;
            const queryEmbedding = await this.generateEmbeddingWithRetry(recallContext.query);
            const output = await this.retrievalService.performRecall(recallContext, queryEmbedding);
            this.operationalAnalytics.lastErrorCode = undefined;
            this.finalizeOperationDuration(startedAt);
            return output;
        } catch (error) {
            this.operationalAnalytics.failedRequests++;
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.operationFailed;
            this.operationalAnalytics.fallbackResponses++;
            this.finalizeOperationDuration(startedAt);
            appLogger.error(SERVICE_NAME, `Recall failed: ${error}`);
            return {
                memories: [],
                scores: new Map<string, MemoryScoreFactors>(),
                totalMatches: 0,
                queryEmbedding: []
            };
        }
    }

    /**
     * Simple recall for backwards compatibility
     */
    async recallRelevantFacts(query: string, limit: number = 5): Promise<AdvancedSemanticFragment[]> {
        return this.retrievalService.recallRelevantFacts(query, limit);
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.SEARCH)
    async searchMemoriesHybridIpc(query: string, limit: number = 10): Promise<RuntimeValue> {
        const result = await this.searchMemoriesHybrid(query, limit);
        return serializeToIpc(result);
    }

    async searchMemoriesHybrid(query: string, limit: number = 10): Promise<AdvancedSemanticFragment[]> {
        const startedAt = Date.now();
        this.operationalAnalytics.totalRequests++;

        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
            this.finalizeOperationDuration(startedAt);
            return [];
        }

        const safeLimit = Math.max(1, Math.min(100, limit));
        const cacheKey = this.buildSearchCacheKey(normalizedQuery, safeLimit);
        const cached = this.readSearchCache(cacheKey);
        if (cached) {
            this.finalizeOperationDuration(startedAt);
            return cached;
        }

        try {
            const primaryResult = await Promise.race([
                this.retrievalService.searchMemoriesHybrid(normalizedQuery, safeLimit).then(result => ({
                    type: 'primary' as const,
                    result
                })),
                new Promise<{ type: 'timeout' }>(resolve => {
                    setTimeout(() => resolve({ type: 'timeout' }), ADVANCED_MEMORY_BUDGET_MS);
                })
            ]);

            if (primaryResult.type === 'primary') {
                this.writeSearchCache(cacheKey, primaryResult.result);
                this.operationalAnalytics.lastErrorCode = undefined;
                this.finalizeOperationDuration(startedAt);
                return primaryResult.result;
            }

            this.operationalAnalytics.budgetExceededCount++;
            this.operationalAnalytics.fallbackResponses++;
            const fallback = await this.searchMemoriesByText(normalizedQuery, safeLimit, true);
            this.writeSearchCache(cacheKey, fallback);
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.transient;
            this.finalizeOperationDuration(startedAt);
            return fallback;
        } catch (error) {
            this.operationalAnalytics.failedRequests++;
            this.operationalAnalytics.fallbackResponses++;
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.operationFailed;
            appLogger.warn(
                SERVICE_NAME,
                `Hybrid search primary path failed, using lexical fallback: ${String(error)}`
            );
            const fallback = await this.searchMemoriesByText(normalizedQuery, safeLimit, true);
            this.writeSearchCache(cacheKey, fallback);
            this.finalizeOperationDuration(startedAt);
            return fallback;
        }
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.SEARCH_RESOLUTIONS)
    async findResolutionMemoriesIpc(errorQuery: string, limit: number = 5): Promise<RuntimeValue> {
        const result = await this.findResolutionMemories(errorQuery, limit);
        return serializeToIpc(result);
    }

    async findResolutionMemories(errorQuery: string, limit: number = 5): Promise<AdvancedSemanticFragment[]> {
        const normalizedLimit = Math.max(1, Math.min(50, limit));
        const candidates = await this.searchMemoriesHybrid(errorQuery, normalizedLimit * 3);
        return candidates
            .filter(memory => memory.tags.includes('resolution') || memory.tags.includes('error-fix'))
            .slice(0, normalizedLimit);
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.EXPORT)
    async exportMemoriesIpc(query?: string, limit: number = 200): Promise<RuntimeValue> {
        const result = await this.exportMemories(query, limit);
        return serializeToIpc(result);
    }

    async exportMemories(query?: string, limit: number = 200): Promise<{
        exportedAt: string;
        query?: string;
        count: number;
        memories: AdvancedSemanticFragment[];
    }> {
        return this.retrievalService.exportMemories(query, limit);
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.IMPORT)
    async importMemoriesIpc(payload: { memories?: Array<Partial<AdvancedSemanticFragment>>; pendingMemories?: Array<Partial<PendingMemory>>; replaceExisting?: boolean }): Promise<RuntimeValue> {
        const result = await this.importMemories(payload);
        return serializeToIpc(result);
    }

    async importMemories(payload: {
        memories?: Array<Partial<AdvancedSemanticFragment>>;
        pendingMemories?: Array<Partial<PendingMemory>>;
        replaceExisting?: boolean;
    }): Promise<MemoryImportResult> {
        const startedAt = Date.now();
        this.operationalAnalytics.totalRequests++;

        const parsedPayload = AdvancedMemoryImportPayloadSchema.safeParse(payload);
        if (!parsedPayload.success) {
            this.operationalAnalytics.validationFailures++;
            this.operationalAnalytics.failedRequests++;
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.validation;
            this.finalizeOperationDuration(startedAt);
            return {
                imported: 0,
                pendingImported: 0,
                skipped: 1,
                errors: [`Invalid import payload: ${parsedPayload.error.issues[0]?.message ?? 'unknown validation issue'}`]
            };
        }

        const memories = Array.isArray(parsedPayload.data.memories) ? parsedPayload.data.memories : [];
        const pendingMemories = Array.isArray(parsedPayload.data.pendingMemories) ? parsedPayload.data.pendingMemories : [];
        const result: MemoryImportResult = {
            imported: 0,
            pendingImported: 0,
            skipped: 0,
            errors: []
        };

        if (parsedPayload.data.replaceExisting) {
            await this.clearExistingMemories();
        }

        for (let index = 0; index < memories.length; index++) {
            const candidate = this.normalizationAdapter.normalizeMemoryRecord(memories[index]);
            if (!candidate) {
                result.skipped++;
                result.errors.push(`Invalid memory record at index ${index}`);
                continue;
            }

            try {
                if (candidate.embedding.length === 0) {
                    candidate.embedding = await this.generateEmbeddingWithRetry(candidate.content);
                }
                await this.storeAdvancedMemory(candidate);
                result.imported++;
            } catch (error) {
                result.skipped++;
                this.operationalAnalytics.fallbackResponses++;
                result.errors.push(`Failed to import memory ${candidate.id}: ${String(error)}`);
            }
        }

        for (let index = 0; index < pendingMemories.length; index++) {
            const pending = this.normalizationAdapter.normalizePendingMemoryRecord(pendingMemories[index]);
            if (!pending) {
                result.skipped++;
                result.errors.push(`Invalid pending memory record at index ${index}`);
                continue;
            }

            try {
                this.stagingBuffer.set(pending.id, pending);
                await this.savePendingMemory(pending);
                result.pendingImported++;
            } catch (error) {
                result.skipped++;
                this.operationalAnalytics.fallbackResponses++;
                result.errors.push(`Failed to import pending memory ${pending.id}: ${String(error)}`);
            }
        }

        if (result.errors.length > 0) {
            this.operationalAnalytics.failedRequests++;
            this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.operationFailed;
        } else {
            this.operationalAnalytics.lastErrorCode = undefined;
        }
        this.finalizeOperationDuration(startedAt);
        return result;
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.GET_STATS)
    async getStatisticsIpc(): Promise<RuntimeValue> {
        const result = await this.getStatistics();
        return serializeToIpc(result);
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.GET_SEARCH_ANALYTICS)
    async getSearchAnalyticsIpc(): Promise<RuntimeValue> {
        const result = this.getSearchAnalytics();
        return serializeToIpc(result);
    }

    getSearchAnalytics(): MemorySearchAnalytics {
        const totalQueries = this.searchAnalytics.totalQueries;
        const averageResults = totalQueries === 0
            ? 0
            : this.searchAnalytics.totalResultsReturned / totalQueries;

        const topQueries = Array.from(this.searchAnalytics.queryCounts.entries())
            .sort((left, right) => right[1] - left[1])
            .slice(0, 10)
            .map(([query, count]) => ({ query, count }));

        return {
            totalQueries,
            semanticQueries: this.searchAnalytics.semanticQueries,
            textQueries: this.searchAnalytics.textQueries,
            hybridQueries: this.searchAnalytics.hybridQueries,
            averageResults,
            lastQueryAt: this.searchAnalytics.lastQueryAt || undefined,
            topQueries
        };
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.HEALTH)
    async getHealthStatusIpc(): Promise<RuntimeValue> {
        const result = this.getHealthStatus();
        return serializeToIpc(result);
    }

    getHealthStatus(): AdvancedMemoryHealthSnapshot {
        const totalRequests = this.operationalAnalytics.totalRequests;
        const failedRequests = this.operationalAnalytics.failedRequests;
        const errorRate = totalRequests === 0 ? 0 : failedRequests / totalRequests;
        const uiState = totalRequests === 0
            ? 'empty'
            : failedRequests > 0
                ? 'failure'
                : 'ready';
        const status = errorRate > 0.05 || this.operationalAnalytics.budgetExceededCount > 0
            ? 'degraded'
            : 'healthy';

        return {
            status,
            uiState,
            messageKey: ADVANCED_MEMORY_UI_MESSAGE_KEYS[uiState],
            budgets: {
                standardMs: ADVANCED_MEMORY_BUDGET_MS
            },
            metrics: {
                totalRequests,
                failedRequests,
                validationFailures: this.operationalAnalytics.validationFailures,
                retries: this.operationalAnalytics.retries,
                fallbackResponses: this.operationalAnalytics.fallbackResponses,
                budgetExceededCount: this.operationalAnalytics.budgetExceededCount,
                lastDurationMs: this.operationalAnalytics.lastDurationMs,
                lastErrorCode: this.operationalAnalytics.lastErrorCode,
                errorRate
            }
        };
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.GET_SEARCH_HISTORY)
    async getSearchHistoryIpc(limit: number = 25): Promise<RuntimeValue> {
        const result = this.getSearchHistory(limit);
        return serializeToIpc(result);
    }

    getSearchHistory(limit: number = 25): MemorySearchHistoryEntry[] {
        const safeLimit = Math.max(1, Math.min(200, limit));
        const startIndex = Math.max(0, this.searchAnalytics.history.length - safeLimit);
        return this.searchAnalytics.history.slice(startIndex).reverse();
    }

    @ipc(ADVANCED_MEMORY_CHANNELS.GET_SEARCH_SUGGESTIONS)
    async getSearchSuggestionsIpc(prefix?: string, limit: number = 8): Promise<RuntimeValue> {
        const result = this.getSearchSuggestions(prefix, limit);
        return serializeToIpc(result);
    }

    getSearchSuggestions(prefix?: string, limit: number = 8): string[] {
        const normalizedPrefix = (prefix ?? '').trim().toLowerCase();
        const safeLimit = Math.max(1, Math.min(20, limit));

        return Array.from(this.searchAnalytics.queryCounts.entries())
            .filter(([query]) => !normalizedPrefix || query.toLowerCase().startsWith(normalizedPrefix))
            .sort((left, right) => right[1] - left[1])
            .slice(0, safeLimit)
            .map(([query]) => query);
    }

    // ========================================================================
    // EPISODIC MEMORY (Conversations)
    // ========================================================================

    @ipc(ADVANCED_MEMORY_CHANNELS.SUMMARIZE_CHAT)
    async summarizeChatIpc(payload: { chatId: string; provider?: string; model?: string }): Promise<RuntimeValue> {
        const { chatId, provider, model } = payload;
        const result = await this.summarizeChat(chatId, provider, model);
        return serializeToIpc(result);
    }

    async summarizeChat(chatId: string, provider?: string, model?: string): Promise<SummarizationResult> {
        const messages = await this.db.getMessages(chatId);
        if (messages.length === 0) {
            return { summary: '', title: '', topics: [], pendingTasks: [] };
        }

        const transcript = messages
            .slice(-20) // Summarize last 20 messages
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');

        const prompt = `Analyze the conversation transcript and provide:
1. A concise summary (max 3 sentences).
2. A short, descriptive title.
3. Key topics discussed (comma-separated).
4. Any unresolved tasks or questions.

Format the output as JSON:
{
  "summary": "...",
  "title": "...",
  "topics": ["...", "..."],
  "pendingTasks": ["...", "..."]
}

Transcript:
${transcript}`;

        try {
            const selectedModel = model ?? (await this.getAvailableModel());
            if (!selectedModel) {
                appLogger.debug(SERVICE_NAME, 'Skipping summarization: no background model available');
                const firstMessageContent = messages[0]?.content;
                return {
                    summary: `Conversation with ${messages.length} messages.`,
                    title: typeof firstMessageContent === 'string'
                        ? firstMessageContent.substring(0, 50)
                        : 'Conversation',
                    topics: [],
                    pendingTasks: []
                };
            }

            const res = await this.callLLM(
                [{ role: 'system', content: 'You are an expert at analyzing and summarizing conversations.' }, { role: 'user', content: prompt }],
                selectedModel,
                provider
            );

            return safeJsonParse<SummarizationResult>(res.content.replace(/```json|```/g, '').trim(), {
                topics: [],
                summary: '',
                title: '',
                pendingTasks: []
            });
        } catch (error) {
            appLogger.warn(SERVICE_NAME, `Summarization failed: ${error}`);
            return {
                summary: `Conversation with ${messages.length} messages.`,
                title: `Chat Session ${new Date().toLocaleDateString()}`,
                topics: [],
                pendingTasks: []
            };
        }
    }

    async summarizeSession(chatId: string, provider?: string, model?: string): Promise<EpisodicMemory | null> {
        const messages = await this.db.getMessages(chatId);
        if (messages.length < 5) { return null; }

        const analysis = await this.summarizeChat(chatId, provider, model);
        const embedding = await this.embedding.generateEmbedding(analysis.summary);
        const now = Date.now();

        const memory = {
            id: this.generateId(),
            title: analysis.title,
            summary: analysis.summary,
            embedding,
            startDate: (messages[0].timestamp as number) || now,
            endDate: (messages[messages.length - 1].timestamp as number) || now,
            chatId,
            participants: ['user', 'assistant'],
            createdAt: now,
            timestamp: now
        };

        // Store topics as semantic fragments for better retrieval
        if (Array.isArray(analysis.topics)) {
            for (const topic of analysis.topics) {
                await this.rememberExplicit(
                    `In chat "${analysis.title}", we discussed: ${topic}`,
                    chatId,
                    'fact',
                    ['topic', ...analysis.topics]
                );
            }
        }

        await this.db.storeEpisodicMemory(memory);

        return memory;
    }

    async recallEpisodes(query: string, limit: number = 3): Promise<EpisodicMemory[]> {
        const queryEmbedding = await this.embedding.generateEmbedding(query);
        return await this.db.searchEpisodicMemories(queryEmbedding, limit);
    }

    async getAllEpisodes(): Promise<EpisodicMemory[]> {
        return await this.db.knowledge.getAllEpisodicMemories();
    }

    // ========================================================================
    // ENTITY KNOWLEDGE
    // ========================================================================

    async setEntityFact(entityType: string, entityName: string, key: string, value: string): Promise<EntityKnowledge> {
        const id = `${entityType}:${entityName}:${key}`.replace(/\s+/g, '_').toLowerCase();
        const knowledge = {
            id,
            entityType,
            entityName,
            key,
            value,
            confidence: 1.0,
            source: 'manual',
            updatedAt: Date.now()
        };
        await this.db.storeEntityKnowledge(knowledge);
        return knowledge;
    }

    async getEntityFacts(entityName: string): Promise<EntityKnowledge[]> {
        return await this.db.getEntityKnowledge(entityName);
    }

    async getAllEntityFacts(): Promise<EntityKnowledge[]> {
        return await this.db.knowledge.getAllEntityKnowledge();
    }

    async deleteEntityFacts(entityName: string): Promise<boolean> {
        const normalized = entityName.trim();
        if (!normalized) {
            return false;
        }
        await this.db.deleteEntityKnowledge(normalized);
        return true;
    }

    // ========================================================================
    // PERSONALITY & SYSTEM MEMORY
    // ========================================================================

    async getPersonality(): Promise<PersonalitySettings | null> {
        const value = await this.db.recallMemory('system:personality');
        if (value?.content) {
            return safeJsonParse<PersonalitySettings | null>(value.content, null);
        }
        return null;
    }

    async updatePersonality(personality: PersonalitySettings): Promise<void> {
        await this.db.storeMemory('system:personality', personality);
    }

    /**
     * High-level context gathering combining fragments and episodes
     */
    async gatherContext(query: string): Promise<string> {
        return this.retrievalService.gatherContext(query);
    }

    // ========================================================================
    // CONTRADICTION DETECTION
    // ========================================================================

    /**
     * Find potential contradictions with existing memories
     */
    private async findContradictions(
        content: string,
        embedding: number[]
    ): Promise<ContradictionCandidate[]> {
        return this.indexingService.findContradictions(content, embedding);
    }

    /**
     * Handle contradictions when storing a new memory
     */
    private async handleContradictions(memory: AdvancedSemanticFragment): Promise<void> {
        await this.indexingService.handleContradictions(memory);
    }

    // ========================================================================
    // MEMORY CONSOLIDATION
    // ========================================================================

    /**
     * Find similar memories for potential consolidation
     */
    private async findSimilarMemories(embedding: number[]): Promise<SimilarMemoryCandidate[]> {
        return this.indexingService.findSimilarMemories(embedding);
    }

    /**
     * Attempt to consolidate a new memory with existing similar ones
     */
    private async attemptConsolidation(
        newMemory: AdvancedSemanticFragment,
        similarCandidates: SimilarMemoryCandidate[]
    ): Promise<ConsolidationResult> {
        return this.indexingService.attemptConsolidation(newMemory, similarCandidates);
    }

    // ========================================================================
    // MEMORY DECAY
    // ========================================================================

    /**
     * Run decay maintenance on all memories
     */
    async runDecayMaintenance(): Promise<void> {
        await this.maintenanceService.runDecayMaintenance();
    }

    /**
     * Calculate decayed importance for a memory
     */
    private calculateDecayedImportance(memory: AdvancedSemanticFragment, now: number): number {
        const daysSinceCreation = (now - memory.createdAt) / (1000 * 60 * 60 * 24);
        const daysSinceAccess = (now - memory.lastAccessedAt) / (1000 * 60 * 60 * 24);

        // Exponential decay based on time
        const decayFactor = Math.pow(0.5, daysSinceCreation / this.config.decay.halfLifeDays);

        // Access boost - each access reduces decay
        const accessBoost = Math.min(
            memory.accessCount * this.config.decay.accessBoostFactor,
            0.5 // Cap boost at 50%
        );

        // Recency boost for recently accessed
        const recencyBoost = daysSinceAccess < this.config.decay.recencyBoostDays
            ? 0.2 * (1 - daysSinceAccess / this.config.decay.recencyBoostDays)
            : 0;

        const newImportance = memory.initialImportance * decayFactor + accessBoost + recencyBoost;

        return Math.max(
            Math.min(newImportance, 1.0),
            this.config.decay.minImportance
        );
    }

    // ========================================================================
    // SCORING & VALIDATION HELPERS
    // ========================================================================

    /**
     * Calculate memory score with all factors
     */
    private calculateMemoryScore(
        memory: AdvancedSemanticFragment,
        queryEmbedding: number[]
    ): MemoryScoreFactors {
        const now = Date.now();
        const daysSinceCreation = (now - memory.createdAt) / (1000 * 60 * 60 * 24);

        return {
            baseImportance: memory.importance,
            recencyBoost: Math.max(0, 1 - daysSinceCreation / 30), // Full boost within 30 days
            accessBoost: Math.min(memory.accessCount * 0.05, 0.3), // Cap at 30%
            relevanceScore: this.cosineSimilarity(queryEmbedding, memory.embedding),
            decayFactor: this.calculateDecayedImportance(memory, now) / memory.initialImportance,
            confidenceWeight: memory.confidence
        };
    }

    /**
     * Calculate initial importance for a pending memory
     */
    private calculateInitialImportance(pending: PendingMemory): number {
        const categoryWeights: Record<MemoryCategory, number> = {
            preference: 0.8,
            personal: 0.85,
            workspace: 0.7,
            technical: 0.6,
            workflow: 0.75,
            relationship: 0.65,
            fact: 0.5,
            instruction: 0.9
        };

        const categoryWeight = categoryWeights[pending.suggestedCategory] || 0.5;
        const confidenceWeight = pending.extractionConfidence;
        const relevanceWeight = pending.relevanceScore;
        const noveltyWeight = pending.noveltyScore;

        return Math.min(
            1.0,
            categoryWeight * 0.3 + confidenceWeight * 0.3 + relevanceWeight * 0.2 + noveltyWeight * 0.2
        );
    }

    /**
     * Check if a fact should require user validation
     */
    private shouldRequireUserValidation(
        confidence: number,
        relevance: number,
        contradictionCount: number
    ): boolean {
        if (this.config.requireUserValidation) { return true; }
        if (contradictionCount > 0) { return true; }
        if (confidence < 0.7) { return true; }
        if (relevance < 0.5) { return true; }
        return false;
    }

    /**
     * Check if a pending memory should be auto-confirmed
     */
    private shouldAutoConfirm(pending: PendingMemory): boolean {
        if (pending.requiresUserValidation) { return false; }
        if (pending.potentialContradictions.length > 0) { return false; }

        const combinedScore = (
            pending.extractionConfidence * 0.4 +
            pending.relevanceScore * 0.3 +
            pending.noveltyScore * 0.3
        );

        return combinedScore >= this.config.autoConfirmThreshold;
    }

    /**
     * Calculate relevance score for a fact
     */
    private async calculateRelevanceScore(_content: string, category: MemoryCategory): Promise<number> {
        // Higher relevance for certain categories
        const categoryRelevance: Record<MemoryCategory, number> = {
            preference: 0.9,
            personal: 0.85,
            instruction: 0.95,
            workflow: 0.8,
            workspace: 0.75,
            technical: 0.7,
            relationship: 0.65,
            fact: 0.5
        };

        return categoryRelevance[category];
    }

    /**
     * Calculate novelty score (how new is this information?)
     */
    private async calculateNoveltyScore(_content: string, embedding: number[]): Promise<number> {
        const similar = await this.searchMemoriesByVector(embedding, 3);

        if (similar.length === 0) { return 1.0; } // Completely novel

        const maxSimilarity = Math.max(
            ...similar.map(m => this.cosineSimilarity(embedding, m.embedding))
        );

        return Math.max(0, 1 - maxSimilarity);
    }

    /**
     * Check if we should extract facts from a message
     */
    private shouldExtractFacts(content: string): boolean {
        // Too short
        if (content.length < 20) { return false; }

        // Likely a command or question
        if (content.startsWith('/')) { return false; }
        if (content.endsWith('?') && content.length < 100) { return false; }

        // Contains potential fact indicators
        const factIndicators = [
            // English
            'i am', 'i\'m', 'my name', 'i prefer', 'i like', 'i use', 'i work',
            'i want', 'i need', 'always', 'never', 'usually', 'remember',
            'note that', 'keep in mind', 'don\'t forget', 'important:',
            // Turkish
            'benim', 'ben', 'adım', 'tercih', 'severim', 'kullanıyorum', 'çalışıyorum', 'istiyorum',
            // German
            'ich bin', 'mein name', 'ich bevorzuge', 'ich mag', 'ich nutze', 'ich arbeite', 'ich will', 'ich brauche',
            // French
            'je suis', 'je m\'appelle', 'je préfère', 'j’aime', 'j\'aime', 'j\'utilise', 'je travaille', 'je veux', 'j\'ai besoin',
            // Spanish
            'soy ', 'me llamo', 'prefiero', 'me gusta', 'uso ', 'trabajo', 'quiero', 'necesito',
            // Arabic
            'أنا', 'اسمي', 'أفضل', 'أحب', 'أستخدم', 'أعمل', 'أريد', 'أحتاج',
            // Chinese
            '我是', '我叫', '我更喜欢', '我喜欢', '我使用', '我在', '我想', '我需要',
            // Japanese
            '私は', '僕は', '俺は', '名前は', '好き', '使って', '働いて', 'したい', '必要'
        ];

        const lowerContent = content.toLowerCase();
        return factIndicators.some(indicator => lowerContent.includes(indicator));
    }

    // ========================================================================
    // LLM FACT EXTRACTION
    // ========================================================================

    /**
     * Extract facts from content using LLM
     */
    private async extractFactsWithLLM(
        content: string,
        model: string
    ): Promise<Array<{ content: string; category: MemoryCategory; confidence: number; tags: string[] }>> {
        const prompt = `Analyze this message and extract important facts worth remembering about the user.

Message: "${content}"

For each fact, determine:
1. The fact itself (rewrite as a clear, standalone statement)
2. Category: preference, personal, workspace, technical, workflow, relationship, fact, or instruction
3. Confidence (0.0-1.0): How confident are you this is accurate?
4. Tags: relevant keywords

Rules:
- Only extract IMPORTANT, USEFUL facts that would help personalize future interactions
- Skip trivial information (greetings, temporary states, generic questions)
- Rewrite facts to be context-independent
- Be conservative - only high-quality facts

Return a JSON array:
[{"content": "User prefers dark mode", "category": "preference", "confidence": 0.9, "tags": ["ui", "theme"]}]

If no facts worth remembering, return [].`;

        try {
            const response = await this.callLLM(
                [
                    { role: 'system', content: 'You are a fact extraction agent. Only extract important, useful facts.' },
                    { role: 'user', content: prompt }
                ],
                model
            );

            const parsed = safeJsonParse<Array<{
                content: string;
                category: string;
                confidence: number;
                tags: string[];
            }>>(response.content.replace(/```json|```/g, '').trim(), []);

            return parsed.map(f => ({
                content: f.content,
                category: coerceMemoryCategory(f.category),
                confidence: Math.min(1, Math.max(0, f.confidence)),
                tags: f.tags
            }));
        } catch (error) {
            appLogger.error(SERVICE_NAME, `LLM extraction failed: ${error}`);
            return [];
        }
    }

    // ========================================================================
    // STATISTICS
    // ========================================================================

    async getStatistics(): Promise<MemoryStatistics> {
        return this.maintenanceService.getStatistics();
    }

    private async clearExistingMemories(): Promise<void> {
        await this.maintenanceService.clearExistingMemories();
        this.clearSearchCaches();
    }

    private finalizeOperationDuration(startedAt: number): void {
        const durationMs = Date.now() - startedAt;
        this.operationalAnalytics.lastDurationMs = durationMs;
        if (durationMs > ADVANCED_MEMORY_BUDGET_MS) {
            this.operationalAnalytics.budgetExceededCount++;
            appLogger.warn(SERVICE_NAME, `Performance budget exceeded: ${durationMs}ms > ${ADVANCED_MEMORY_BUDGET_MS}ms`);
        }
    }

    private async generateEmbeddingWithRetry(content: string): Promise<number[]> {
        return withRetry(
            () => this.embedding.generateEmbedding(content),
            {
                maxRetries: ADVANCED_MEMORY_RETRY_ATTEMPTS - 1,
                baseDelayMs: ADVANCED_MEMORY_RETRY_DELAY_MS,
                maxDelayMs: ADVANCED_MEMORY_RETRY_DELAY_MS,
                jitterFactor: 0,
                shouldRetry: () => true,
                onRetry: (error, attempt) => {
                    this.operationalAnalytics.retries++;
                    this.operationalAnalytics.lastErrorCode = ADVANCED_MEMORY_ERROR_CODE.transient;
                    const message = error instanceof Error ? error.message : String(error);
                    appLogger.warn(SERVICE_NAME, `Embedding retry ${attempt + 1}/${ADVANCED_MEMORY_RETRY_ATTEMPTS - 1}: ${message}`);
                },
            }
        );
    }

    private isWorkspaceAllowed(
        namespace: SharedMemoryNamespace,
        sourceWorkspaceId: string,
        targetWorkspaceId: string
    ): boolean {
        const allowedTargets = namespace.accessControl[sourceWorkspaceId];
        if (!allowedTargets) {
            return false;
        }
        return allowedTargets.includes(targetWorkspaceId);
    }

    private async findWorkspaceMemoryBySource(
        workspaceId: string,
        sourceId: string
    ): Promise<AdvancedSemanticFragment | null> {
        const memories = await this.getAllAdvancedMemories();
        return memories.find(memory => memory.workspaceId === workspaceId && memory.sourceId === sourceId) ?? null;
    }

    /**
     * Cosine similarity between two vectors
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length || a.length === 0) { return 0; }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    private generateId(): string {
        return `mem_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    }

    // ========================================================================
    // DATABASE OPERATIONS
    // ========================================================================

    private async storeAdvancedMemory(memory: AdvancedSemanticFragment): Promise<void> {
        await this.persistenceAdapter.storeAdvancedMemory(memory);
        this.clearSearchCaches();
    }

    private async updateAdvancedMemory(memory: AdvancedSemanticFragment): Promise<void> {
        await this.persistenceAdapter.updateAdvancedMemory(memory);
        this.clearSearchCaches();
    }

    private async getMemoryById(id: string): Promise<AdvancedSemanticFragment | null> {
        return this.persistenceAdapter.getMemoryById(id);
    }

    public async getAllAdvancedMemories(): Promise<AdvancedSemanticFragment[]> {
        return this.persistenceAdapter.getAllAdvancedMemories();
    }

    private async searchMemoriesByVector(embedding: number[], limit: number): Promise<AdvancedSemanticFragment[]> {
        return this.persistenceAdapter.searchMemoriesByVector(embedding, limit);
    }

    private async updateMemoryStatus(id: string, status: MemoryStatus): Promise<void> {
        const memory = await this.getMemoryById(id);
        if (memory) {
            memory.status = status;
            memory.updatedAt = Date.now();
            await this.updateAdvancedMemory(memory);
        }
    }

    private async updateAccessTracking(id: string): Promise<void> {
        const memory = await this.getMemoryById(id);
        if (memory) {
            memory.accessCount++;
            memory.lastAccessedAt = Date.now();
            await this.updateAdvancedMemory(memory);
        }
    }

    private async savePendingMemory(pending: PendingMemory): Promise<void> {
        await this.persistenceAdapter.savePendingMemory(pending);
    }

    private async deletePendingMemory(id: string): Promise<void> {
        await this.persistenceAdapter.deletePendingMemory(id);
    }

    private async loadPendingMemories(): Promise<void> {
        const pendingCount = await this.persistenceAdapter.loadPendingMemories(this.stagingBuffer);
        appLogger.info(SERVICE_NAME, `Loaded ${pendingCount} pending memories`);
    }

    // ========================================================================
    // LLM HELPERS
    // ========================================================================

    private async getAvailableModel(): Promise<string | null> {
        const resolved = await this.backgroundModelResolver?.resolve();
        if (resolved) {
            this.cachedBackgroundModel = resolved;
            return resolved.model;
        }

        if (this.cachedBackgroundModel) { return this.cachedBackgroundModel.model; }

        try {
            const res = await fetch('http://127.0.0.1:11434/api/tags');
            if (!res.ok) { return null; }

            const data = await res.json() as OllamaTagsResponse;
            const installed = data.models.map(m => m.name.toLowerCase());
            const preferredModels = this.settings.getSettings().ai?.preferredMemoryModels ?? [];

            for (const preferred of preferredModels) {
                const match = installed.find(m => m === preferred || m.startsWith(preferred.split(':')[0]));
                if (match) {
                    this.cachedBackgroundModel = { model: match, provider: 'ollama', source: 'local' };
                    appLogger.info(SERVICE_NAME, `Using Ollama model: ${match}`);
                    return match;
                }
            }

            if (installed.length > 0) {
                this.cachedBackgroundModel = { model: installed[0], provider: 'ollama', source: 'local' };
                return installed[0];
            }
        } catch {
            appLogger.debug(SERVICE_NAME, 'Ollama not available');
        }

        return null;
    }

    private async callLLM(messages: ChatMessage[], model: string, provider?: string): Promise<{ content: string }> {
        const resolvedProvider = provider ?? this.providerForBackgroundModel(model);
        return this.llmService.chat(messages, model, [], resolvedProvider);
    }

    private providerForBackgroundModel(model: string): string {
        if (this.cachedBackgroundModel?.model === model) {
            return this.cachedBackgroundModel.provider;
        }
        if (model.startsWith('ollama/')) {
            return 'ollama';
        }
        if (model.startsWith('claude-') || model.startsWith('anthropic/')) {
            return 'anthropic';
        }
        if (model.startsWith('gemini-') || model.startsWith('google/')) {
            return 'antigravity';
        }
        if (model.includes('codex') || model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3')) {
            return 'codex';
        }
        return 'ollama';
    }

    // ========================================================================
    // DELETE & EDIT OPERATIONS
    // ========================================================================

    /**
     * Delete a single memory by ID
     */
    async deleteMemory(id: string): Promise<boolean> {
        const memory = await this.getMemoryById(id);
        if (!memory) {
            appLogger.warn(SERVICE_NAME, `Memory not found for deletion: ${id}`);
            return false;
        }

        await this.db.deleteAdvancedMemory(id);
        this.clearSearchCaches();
        appLogger.info(SERVICE_NAME, `Memory deleted: ${id}`);
        return true;
    }

    /**
     * Delete multiple memories by IDs
     */
    async deleteMemories(ids: string[]): Promise<{ deleted: number; failed: string[] }> {
        let deleted = 0;
        const failed: string[] = [];

        for (const id of ids) {
            try {
                const success = await this.deleteMemory(id);
                if (success) {
                    deleted++;
                } else {
                    failed.push(id);
                }
            } catch (error) {
                appLogger.error(SERVICE_NAME, `Failed to delete memory ${id}: ${error}`);
                failed.push(id);
            }
        }

        appLogger.info(SERVICE_NAME, `Bulk delete: ${deleted} deleted, ${failed.length} failed`);
        return { deleted, failed };
    }

    /**
     * Edit an existing memory's content and metadata
     */
    async editMemory(
        id: string,
        updates: {
            content?: string;
            category?: MemoryCategory;
            tags?: string[];
            importance?: number;
            workspaceId?: string | null;
            editReason?: string;
        }
    ): Promise<AdvancedSemanticFragment | null> {
        const memory = await this.getMemoryById(id);
        if (!memory) {
            appLogger.warn(SERVICE_NAME, `Memory not found for edit: ${id}`);
            return null;
        }

        // Store history before update
        const historyItem: MemoryVersion = {
            versionIndex: (memory.history?.length ?? 0),
            content: memory.content,
            category: memory.category,
            tags: [...memory.tags],
            importance: memory.importance,
            timestamp: memory.updatedAt,
            reason: updates.editReason
        };

        if (!memory.history) {
            memory.history = [];
        }
        memory.history.push(historyItem);

        // Apply updates
        if (updates.content !== undefined && updates.content !== memory.content) {
            memory.content = updates.content;
            // Re-generate embedding for new content
            memory.embedding = await this.embedding.generateEmbedding(updates.content);
        }

        if (updates.category !== undefined) {
            memory.category = updates.category;
        }

        if (updates.tags !== undefined) {
            memory.tags = updates.tags;
        }

        if (updates.importance !== undefined) {
            memory.importance = Math.max(0, Math.min(1, updates.importance));
            memory.initialImportance = memory.importance;
        }

        if (updates.workspaceId !== undefined) {
            memory.workspaceId = updates.workspaceId ?? undefined;
        }

        memory.updatedAt = Date.now();

        await this.updateAdvancedMemory(memory);
        appLogger.info(SERVICE_NAME, `Memory edited: ${id} (Version ${memory.history.length})`);
        return memory;
    }

    /**
     * Rollback a memory to a previous version
     */
    async rollbackMemory(id: string, versionIndex: number): Promise<AdvancedSemanticFragment | null> {
        const memory = await this.getMemoryById(id);
        if (!memory?.history?.[versionIndex]) {
            appLogger.warn(SERVICE_NAME, `Rollback failed: Memory ${id} or version ${versionIndex} not found`);
            return null;
        }

        const targetVersion = memory.history[versionIndex];

        // Add current state to history before rollback
        const currentAsVersion: MemoryVersion = {
            versionIndex: memory.history.length,
            content: memory.content,
            category: memory.category,
            tags: [...memory.tags],
            importance: memory.importance,
            timestamp: memory.updatedAt,
            reason: `Rollback to version ${versionIndex}`
        };
        memory.history.push(currentAsVersion);

        // Apply target version
        memory.content = targetVersion.content;
        memory.category = targetVersion.category;
        memory.tags = [...targetVersion.tags];
        memory.importance = targetVersion.importance;
        memory.embedding = await this.embedding.generateEmbedding(memory.content);
        memory.updatedAt = Date.now();

        await this.updateAdvancedMemory(memory);
        appLogger.info(SERVICE_NAME, `Memory ${id} rolled back to version ${versionIndex}`);
        return memory;
    }

    /**
     * Get the edit history of a memory
     */
    async getMemoryHistory(id: string): Promise<MemoryVersion[]> {
        const memory = await this.getMemoryById(id);
        return memory?.history ?? [];
    }

    /**
     * Share a memory with another workspace
     */
    async shareMemoryWithWorkspace(memoryId: string, targetWorkspaceId: string): Promise<AdvancedSemanticFragment | null> {
        const memory = await this.getMemoryById(memoryId);
        if (!memory) { return null; }
        const normalizedTags = memory.tags ?? [];
        const normalizedHistory = memory.history ?? [];
        const normalizedRelatedMemoryIds = memory.relatedMemoryIds ?? [];

        const sharedMemory: AdvancedSemanticFragment = {
            ...memory,
            id: this.generateId(),
            workspaceId: targetWorkspaceId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            history: [
                ...normalizedHistory,
                {
                    versionIndex: normalizedHistory.length,
                    content: memory.content,
                    category: memory.category,
                    tags: [...normalizedTags],
                    importance: memory.importance,
                    timestamp: Date.now(),
                    reason: `Shared from ${memory.workspaceId ?? 'global'} to ${targetWorkspaceId}`
                }
            ],
            tags: [...normalizedTags],
            relatedMemoryIds: Array.from(new Set([...normalizedRelatedMemoryIds, memory.id])), // Link to original
        };

        await this.storeAdvancedMemory(sharedMemory);
        appLogger.info(SERVICE_NAME, `Memory ${memoryId} shared with workspace ${targetWorkspaceId}`);
        return sharedMemory;
    }

    async createSharedNamespace(payload: {
        id: string;
        name: string;
        workspaceIds: string[];
        accessControl?: Record<string, string[]>;
    }): Promise<SharedMemoryNamespace> {
        const now = Date.now();
        const uniqueWorkspaces = Array.from(new Set(payload.workspaceIds.filter(wsId => wsId.trim().length > 0)));
        const defaultAccess: Record<string, string[]> = {};
        for (const wsId of uniqueWorkspaces) {
            defaultAccess[wsId] = uniqueWorkspaces.filter(candidate => candidate !== wsId);
        }
        const existing = await this.persistenceAdapter.getSharedMemoryNamespaceById(payload.id);
        const namespace: SharedMemoryNamespace = {
            id: payload.id,
            name: payload.name,
            workspaceIds: uniqueWorkspaces,
            accessControl: payload.accessControl ?? defaultAccess,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now
        };
        await this.persistenceAdapter.upsertSharedMemoryNamespace(namespace);
        this.sharedNamespaces.set(namespace.id, namespace);
        return namespace;
    }

    async syncSharedNamespace(request: SharedMemorySyncRequest): Promise<SharedMemorySyncResult> {
        const namespace = await this.getSharedNamespace(request.namespaceId);
        if (!namespace) {
            throw new Error(`Shared namespace not found: ${request.namespaceId}`);
        }
        if (!namespace.workspaceIds.includes(request.sourceWorkspaceId)) {
            throw new Error(`Source workspace ${request.sourceWorkspaceId} is not part of namespace ${request.namespaceId}`);
        }

        const sourceMemories = (await this.getAllAdvancedMemories()).filter(memory =>
            memory.workspaceId === request.sourceWorkspaceId &&
            (request.memoryIds === undefined || request.memoryIds.includes(memory.id))
        );
        const targets = (request.targetWorkspaceIds ?? namespace.workspaceIds)
            .filter(wsId => wsId !== request.sourceWorkspaceId);

        let synced = 0;
        let skipped = 0;
        const conflicts: SharedMemoryMergeConflict[] = [];
        for (const targetWsId of targets) {
            if (!this.isWorkspaceAllowed(namespace, request.sourceWorkspaceId, targetWsId)) {
                skipped += sourceMemories.length;
                continue;
            }
            for (const sourceMemory of sourceMemories) {
                const existing = await this.findWorkspaceMemoryBySource(targetWsId, sourceMemory.sourceId);
                if (existing && existing.content !== sourceMemory.content) {
                    const conflict: SharedMemoryMergeConflict = {
                        namespaceId: namespace.id,
                        sourceWorkspaceId: request.sourceWorkspaceId,
                        targetWorkspaceId: targetWsId,
                        sourceMemoryId: sourceMemory.id,
                        targetMemoryId: existing.id,
                        sourceContent: sourceMemory.content,
                        targetContent: existing.content,
                        resolution: request.resolution ?? 'manual_review',
                        detectedAt: Date.now()
                    };
                    conflicts.push(conflict);
                    continue;
                }

                const shared = await this.shareMemoryWithWorkspace(sourceMemory.id, targetWsId);
                if (shared) {
                    synced++;
                } else {
                    skipped++;
                }
            }
        }

        if (conflicts.length > 0) {
            await this.persistenceAdapter.appendSharedMemoryConflicts(namespace.id, conflicts);
        }

        return {
            namespaceId: namespace.id,
            synced,
            skipped,
            conflicts,
            updatedAt: Date.now()
        };
    }

    async getSharedNamespaceAnalytics(namespaceId: string): Promise<SharedMemoryAnalytics> {
        const namespace = await this.getSharedNamespace(namespaceId);
        if (!namespace) {
            throw new Error(`Shared namespace not found: ${namespaceId}`);
        }

        const allMemories = await this.getAllAdvancedMemories();
        const memoriesByWorkspace: Record<string, number> = {};
        let totalMemories = 0;
        for (const wsId of namespace.workspaceIds) {
            const count = allMemories.filter(memory => memory.workspaceId === wsId).length;
            memoriesByWorkspace[wsId] = count;
            totalMemories += count;
        }

        return {
            namespaceId,
            totalMemories,
            totalWorkspaces: namespace.workspaceIds.length,
            conflicts: await this.persistenceAdapter.getSharedMemoryConflictCount(namespaceId),
            memoriesByWorkspace,
            updatedAt: Date.now()
        };
    }

    async searchAcrossWorkspaces(payload: {
        namespaceId: string;
        query: string;
        workspaceId: string;
        limit?: number;
    }): Promise<AdvancedSemanticFragment[]> {
        const namespace = await this.getSharedNamespace(payload.namespaceId);
        if (!namespace) {
            throw new Error(`Shared namespace not found: ${payload.namespaceId}`);
        }
        if (!namespace.workspaceIds.includes(payload.workspaceId)) {
            throw new Error(`Workspace ${payload.workspaceId} is not part of namespace ${payload.namespaceId}`);
        }

        const searchResult = await this.searchMemoriesHybrid(payload.query, payload.limit ?? 20);
        return searchResult.filter(memory =>
            memory.workspaceId !== undefined &&
            namespace.workspaceIds.includes(memory.workspaceId) &&
            this.isWorkspaceAllowed(namespace, payload.workspaceId, memory.workspaceId)
        );
    }

    /**
     * Archive a memory (soft delete)
     */
    async archiveMemory(id: string): Promise<boolean> {
        return this.maintenanceService.archiveMemory(id);
    }

    /**
     * Restore an archived memory
     */
    async restoreMemory(id: string): Promise<boolean> {
        return this.maintenanceService.restoreMemory(id);
    }

    /**
     * Archive multiple memories
     */
    async archiveMemories(ids: string[]): Promise<{ archived: number; failed: string[] }> {
        return this.maintenanceService.archiveMemories(ids);
    }

    /**
     * Get a single memory by ID (public method)
     */
    async getMemory(id: string): Promise<AdvancedSemanticFragment | null> {
        return this.getMemoryById(id);
    }

    /**
     * Manually trigger re-categorization of memories
     */
    async recategorizeMemories(memoryIds?: string[]): Promise<number> {
        return this.maintenanceService.recategorizeMemories(memoryIds);
    }

    /**
     * Clean up expired memories
     */
    async cleanupExpiredMemories(): Promise<number> {
        return this.maintenanceService.cleanupExpiredMemories();
    }

    private async getSharedNamespace(namespaceId: string): Promise<SharedMemoryNamespace | null> {
        const cached = this.sharedNamespaces.get(namespaceId);
        if (cached) {
            return cached;
        }
        const persisted = await this.persistenceAdapter.getSharedMemoryNamespaceById(namespaceId);
        if (persisted) {
            this.sharedNamespaces.set(namespaceId, persisted);
        }
        return persisted;
    }

    private buildSearchCacheKey(query: string, limit: number): string {
        return `${query}::${limit}`;
    }

    private readSearchCache(key: string): AdvancedSemanticFragment[] | null {
        const cached = this.searchCache.get(key);
        if (!cached) {
            return null;
        }
        if (cached.expiresAt <= Date.now()) {
            this.searchCache.delete(key);
            return null;
        }
        return cached.value;
    }

    private writeSearchCache(key: string, value: AdvancedSemanticFragment[]): void {
        this.searchCache.set(key, {
            value,
            expiresAt: Date.now() + this.searchCacheTtlMs
        });
        if (this.searchCache.size > 300) {
            const firstKey = this.searchCache.keys().next().value as string | undefined;
            if (firstKey) {
                this.searchCache.delete(firstKey);
            }
        }
    }

    private clearSearchCaches(): void {
        this.searchCache.clear();
        this.warmMemorySnapshot();
    }

    private async getMemorySnapshot(options: { fastOnly?: boolean } = {}): Promise<AdvancedSemanticFragment[]> {
        if (this.memorySnapshot && this.memorySnapshot.expiresAt > Date.now()) {
            return this.memorySnapshot.value;
        }
        if (options.fastOnly) {
            return this.memorySnapshot?.value ?? [];
        }
        await this.refreshMemorySnapshot();
        return this.memorySnapshot?.value ?? [];
    }

    private async refreshMemorySnapshot(): Promise<void> {
        if (this.memorySnapshotRefresh) {
            await this.memorySnapshotRefresh;
            return;
        }
        this.memorySnapshotRefresh = (async () => {
            const memories = await this.getAllAdvancedMemories();
            this.memorySnapshot = {
                value: memories,
                expiresAt: Date.now() + this.snapshotCacheTtlMs
            };
        })().finally(() => {
            this.memorySnapshotRefresh = null;
        });
        await this.memorySnapshotRefresh;
    }

    private warmMemorySnapshot(): void {
        if (this.memorySnapshotRefresh) {
            return;
        }
        void this.refreshMemorySnapshot().catch(error => {
            appLogger.debug(SERVICE_NAME, `Background memory cache refresh failed: ${String(error)}`);
        });
    }

    private async searchMemoriesByText(
        normalizedQuery: string,
        limit: number,
        fastOnly: boolean = false
    ): Promise<AdvancedSemanticFragment[]> {
        const memories = await this.getMemorySnapshot({ fastOnly });
        if (memories.length === 0 && fastOnly) {
            this.warmMemorySnapshot();
        }
        const terms = normalizedQuery.split(/\s+/).filter(Boolean);
        if (terms.length === 0) {
            return [];
        }
        return memories
            .map(memory => {
                const haystack = `${memory.content} ${memory.tags.join(' ')}`.toLowerCase();
                let score = 0;
                for (const term of terms) {
                    if (haystack.includes(term)) {
                        score++;
                    }
                }
                return { memory, score };
            })
            .filter(item => item.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, limit)
            .map(item => item.memory);
    }

}

