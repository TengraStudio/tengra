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

import { appLogger } from '@main/logging/logger';
import { DatabaseService, EntityKnowledge, EpisodicMemory } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ChatMessage } from '@main/types/llm.types';
import {
    AdvancedMemoryConfig,
    AdvancedSemanticFragment,
    ConsolidationResult,
    ContradictionCandidate,
    DEFAULT_MEMORY_CONFIG,
    MemoryCategory,
    MemoryScoreFactors,
    MemorySource,
    MemoryStatistics,
    MemoryStatus,
    PendingMemory,
    RecallContext,
    RecallResult,
    SimilarMemoryCandidate
} from '@shared/types/advanced-memory';
import { JsonObject } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

const SERVICE_NAME = 'AdvancedMemoryService';

// Ollama models in order of preference (smallest first)
const PREFERRED_MODELS = [
    'llama3.2:1b', 'llama3.2:3b', 'phi3:mini', 'gemma2:2b',
    'qwen2.5:0.5b', 'qwen2.5:1.5b', 'llama3.1:8b', 'mistral:7b'
];

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

export class AdvancedMemoryService {
    private config: AdvancedMemoryConfig;
    private stagingBuffer: Map<string, PendingMemory> = new Map();
    private cachedOllamaModel: string | null = null;
    private isInitialized = false;

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService,
        private llmService: LLMService,
        config?: Partial<AdvancedMemoryConfig>
    ) {
        this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) { return; }

        // Load pending memories from database
        await this.loadPendingMemories();

        // Run decay maintenance
        await this.runDecayMaintenance();

        this.isInitialized = true;
        appLogger.info(SERVICE_NAME, 'Advanced memory service initialized');
    }

    // ========================================================================
    // FACT EXTRACTION (Entry Point)
    // ========================================================================

    /**
     * Extract facts from a user message and stage them for validation
     */
    async extractAndStageFromMessage(
        content: string,
        sourceId: string,
        projectId?: string
    ): Promise<PendingMemory[]> {
        // Skip if message is too short or likely not containing facts
        if (!this.shouldExtractFacts(content)) {
            return [];
        }

        const model = await this.getAvailableModel();
        if (!model) {
            appLogger.debug(SERVICE_NAME, 'No LLM available for extraction');
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
                    projectId
                });

                if (pending) {
                    pendingMemories.push(pending);
                }
            }

            return pendingMemories;
        } catch (error) {
            appLogger.error(SERVICE_NAME, `Extraction failed: ${error}`);
            return [];
        }
    }

    /**
     * Explicitly remember a fact (user said "remember this")
     */
    async rememberExplicit(
        content: string,
        sourceId: string,
        category: MemoryCategory = 'fact',
        tags: string[] = [],
        projectId?: string
    ): Promise<AdvancedSemanticFragment> {
        const embedding = await this.embedding.generateEmbedding(content);
        const now = Date.now();

        const memory: AdvancedSemanticFragment = {
            id: this.generateId(),
            content,
            embedding,
            source: 'user_explicit',
            sourceId,
            category,
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
            projectId,
            createdAt: now,
            updatedAt: now
        };

        // Check for contradictions and resolve
        await this.handleContradictions(memory);

        // Store
        await this.storeAdvancedMemory(memory);

        appLogger.info(SERVICE_NAME, `Explicit memory stored: "${content.substring(0, 50)}..."`);
        return memory;
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
        projectId?: string;
    }): Promise<PendingMemory | null> {
        const { content, source, sourceId, sourceContext, category, extractionConfidence, tags, projectId } = params;
        // Check staging buffer limit
        if (this.stagingBuffer.size >= this.config.maxPendingMemories) {
            // Remove oldest pending memory
            const oldest = Array.from(this.stagingBuffer.values())
                .sort((a, b) => a.extractedAt - b.extractedAt)[0];
            this.stagingBuffer.delete(oldest.id);
        }

        const embedding = await this.embedding.generateEmbedding(content);

        // Calculate scores
        const relevanceScore = await this.calculateRelevanceScore(content, category);
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
            suggestedCategory: category,
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
            projectId
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
    getPendingMemories(): PendingMemory[] {
        return Array.from(this.stagingBuffer.values())
            .sort((a, b) => b.extractedAt - a.extractedAt);
    }

    /**
     * Confirm a pending memory (user validation)
     */
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
            projectId: pending.projectId,
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

    // ========================================================================
    // CONTEXT-AWARE RECALL
    // ========================================================================

    /**
     * Recall memories with full context awareness
     */
    async recall(context: RecallContext): Promise<RecallResult> {
        const queryEmbedding = await this.embedding.generateEmbedding(context.query);
        const limit = context.limit ?? this.config.defaultRecallLimit;

        // Get candidate memories
        let candidates = await this.searchMemoriesByVector(queryEmbedding, limit * 3);

        // Apply filters
        candidates = this.applyRecallFilters(candidates, context);

        // Calculate final scores with all factors
        const scores = new Map<string, MemoryScoreFactors>();
        const scoredCandidates: Array<{ memory: AdvancedSemanticFragment; finalScore: number }> = [];

        for (const memory of candidates) {
            const factors = this.calculateMemoryScore(memory, queryEmbedding);
            scores.set(memory.id, factors);

            const finalScore =
                factors.baseImportance * 0.2 +
                factors.recencyBoost * 0.15 +
                factors.accessBoost * 0.1 +
                factors.relevanceScore * 0.4 +
                factors.confidenceWeight * 0.15;

            scoredCandidates.push({ memory, finalScore });
        }

        // Sort by score and apply diversity
        scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);

        let results = scoredCandidates.slice(0, limit).map(c => c.memory);

        // Apply diversity if requested
        if (context.diversityFactor && context.diversityFactor > 0) {
            results = this.applyDiversity(scoredCandidates, limit, context.diversityFactor);
        }

        // Update access tracking
        for (const memory of results) {
            await this.updateAccessTracking(memory.id);
        }

        return {
            memories: results,
            scores,
            totalMatches: candidates.length,
            queryEmbedding
        };
    }

    /**
     * Simple recall for backwards compatibility
     */
    async recallRelevantFacts(query: string, limit: number = 5): Promise<AdvancedSemanticFragment[]> {
        const result = await this.recall({ query, limit });
        return result.memories;
    }

    // ========================================================================
    // EPISODIC MEMORY (Conversations)
    // ========================================================================

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
            const res = await this.callLLM(
                [{ role: 'system', content: 'You are an expert at analyzing and summarizing conversations.' }, { role: 'user', content: prompt }],
                model ?? (await this.getAvailableModel()) ?? 'gpt-4o-mini',
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
        const facts = await this.recallRelevantFacts(query, 3);
        const episodes = await this.recallEpisodes(query, 2);

        let context = '';
        if (facts.length > 0) {
            context += 'Related Facts:\n' + facts.map(f => `- ${f.content}`).join('\n') + '\n\n';
        }
        if (episodes.length > 0) {
            context += 'Related Episodes:\n' + episodes.map(e => `- ${e.summary}`).join('\n');
        }
        return context;
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
        const similar = await this.searchMemoriesByVector(embedding, 10);
        const candidates: ContradictionCandidate[] = [];

        if (similar.length === 0) { return candidates; }

        // Use LLM to detect contradictions
        const model = await this.getAvailableModel();
        if (!model) { return candidates; }

        const existingContents = similar.map(m => ({
            id: m.id,
            content: m.content
        }));

        const prompt = `Analyze if the new fact contradicts any existing facts.

New Fact: "${content}"

Existing Facts:
${existingContents.map((e, i) => `${i + 1}. [${e.id}] ${e.content}`).join('\n')}

Return a JSON array of contradictions found. For each contradiction include:
- existingId: the ID of the contradicting fact
- conflictType: "direct" (complete opposite), "partial" (some conflict), or "temporal" (outdated info)
- explanation: brief explanation of the conflict
- resolution: "keep_new", "keep_old", "keep_both", or "merge"

If no contradictions, return an empty array [].

Example output:
[{"existingId": "abc123", "conflictType": "direct", "explanation": "User previously preferred dark mode, now prefers light", "resolution": "keep_new"}]`;

        try {
            const response = await this.callLLM(
                [{ role: 'user', content: prompt }],
                model
            );

            const parsed = safeJsonParse<Array<{
                existingId: string;
                conflictType: string;
                explanation: string;
                resolution: string;
            }>>(response.content.replace(/```json|```/g, '').trim(), []);

            for (const c of parsed) {
                const existing = similar.find(m => m.id === c.existingId);
                if (existing) {
                    candidates.push({
                        existingMemoryId: c.existingId,
                        existingContent: existing.content,
                        conflictType: c.conflictType as 'direct' | 'partial' | 'temporal',
                        conflictExplanation: c.explanation,
                        suggestedResolution: c.resolution as 'keep_new' | 'keep_old' | 'keep_both' | 'merge'
                    });
                }
            }
        } catch (error) {
            appLogger.warn(SERVICE_NAME, `Contradiction detection failed: ${error}`);
        }

        return candidates;
    }

    /**
     * Handle contradictions when storing a new memory
     */
    private async handleContradictions(memory: AdvancedSemanticFragment): Promise<void> {
        const contradictions = await this.findContradictions(memory.content, memory.embedding);

        for (const contradiction of contradictions) {
            if (contradiction.suggestedResolution === 'keep_new') {
                // Archive the old memory
                await this.updateMemoryStatus(contradiction.existingMemoryId, 'contradicted');
                memory.contradictsIds.push(contradiction.existingMemoryId);
            } else if (contradiction.suggestedResolution === 'merge') {
                // Will be handled by consolidation
                memory.relatedMemoryIds.push(contradiction.existingMemoryId);
            }
            // 'keep_both' and 'keep_old' - no action needed
        }
    }

    // ========================================================================
    // MEMORY CONSOLIDATION
    // ========================================================================

    /**
     * Find similar memories for potential consolidation
     */
    private async findSimilarMemories(embedding: number[]): Promise<SimilarMemoryCandidate[]> {
        const similar = await this.searchMemoriesByVector(embedding, 5);
        const candidates: SimilarMemoryCandidate[] = [];

        for (const memory of similar) {
            const similarity = this.cosineSimilarity(embedding, memory.embedding);

            if (similarity >= this.config.consolidation.similarityThreshold) {
                candidates.push({
                    memoryId: memory.id,
                    content: memory.content,
                    similarityScore: similarity,
                    canMerge: similarity >= this.config.consolidation.autoMergeThreshold,
                    mergeStrategy: similarity >= 0.95 ? 'replace' : similarity >= 0.85 ? 'append' : 'generalize'
                });
            }
        }

        return candidates;
    }

    /**
     * Attempt to consolidate a new memory with existing similar ones
     */
    private async attemptConsolidation(
        newMemory: AdvancedSemanticFragment,
        similarCandidates: SimilarMemoryCandidate[]
    ): Promise<ConsolidationResult> {
        if (!this.config.consolidation.enabled || similarCandidates.length === 0) {
            return { action: 'none', affectedMemoryIds: [], explanation: 'Consolidation disabled or no candidates' };
        }

        const autoMergeCandidates = similarCandidates.filter(c => c.canMerge);

        if (autoMergeCandidates.length === 0) {
            // Just link related memories
            for (const candidate of similarCandidates) {
                newMemory.relatedMemoryIds.push(candidate.memoryId);
            }
            return { action: 'linked', affectedMemoryIds: similarCandidates.map(c => c.memoryId), explanation: 'Linked to similar memories' };
        }

        // Merge with the most similar
        const bestMatch = autoMergeCandidates.sort((a, b) => b.similarityScore - a.similarityScore)[0];
        const existingMemory = await this.getMemoryById(bestMatch.memoryId);

        if (!existingMemory) {
            return { action: 'none', affectedMemoryIds: [], explanation: 'Could not find existing memory' };
        }

        if (bestMatch.mergeStrategy === 'replace') {
            // New memory is essentially the same - update existing
            existingMemory.content = newMemory.content;
            existingMemory.updatedAt = Date.now();
            existingMemory.accessCount++;
            await this.updateAdvancedMemory(existingMemory);

            return {
                action: 'merged',
                resultingMemoryId: existingMemory.id,
                affectedMemoryIds: [existingMemory.id],
                explanation: 'Replaced with more recent identical memory'
            };
        }

        if (bestMatch.mergeStrategy === 'append') {
            // Append new information
            const model = await this.getAvailableModel();
            if (model) {
                const mergedContent = await this.mergeMemoryContents(
                    existingMemory.content,
                    newMemory.content,
                    model
                );

                existingMemory.content = mergedContent;
                existingMemory.embedding = await this.embedding.generateEmbedding(mergedContent);
                existingMemory.updatedAt = Date.now();
                await this.updateAdvancedMemory(existingMemory);

                return {
                    action: 'merged',
                    resultingMemoryId: existingMemory.id,
                    affectedMemoryIds: [existingMemory.id],
                    explanation: 'Appended new information to existing memory'
                };
            }
        }

        return { action: 'none', affectedMemoryIds: [], explanation: 'No consolidation action taken' };
    }

    /**
     * Merge two memory contents using LLM
     */
    private async mergeMemoryContents(
        existing: string,
        newContent: string,
        model: string
    ): Promise<string> {
        const prompt = `Merge these two related facts into a single, comprehensive fact:

Existing: "${existing}"
New: "${newContent}"

Return only the merged fact, no explanation.`;

        try {
            const response = await this.callLLM(
                [{ role: 'user', content: prompt }],
                model
            );
            return response.content.trim().replace(/^["']|["']$/g, '');
        } catch {
            return `${existing}. Additionally: ${newContent}`;
        }
    }

    // ========================================================================
    // MEMORY DECAY
    // ========================================================================

    /**
     * Run decay maintenance on all memories
     */
    async runDecayMaintenance(): Promise<void> {
        if (!this.config.decay.enabled) { return; }

        const allMemories = await this.getAllAdvancedMemories();
        const now = Date.now();

        for (const memory of allMemories) {
            if (memory.status !== 'confirmed') { continue; }

            const newImportance = this.calculateDecayedImportance(memory, now);

            if (newImportance !== memory.importance) {
                memory.importance = newImportance;
                memory.updatedAt = now;

                // Auto-archive if below threshold
                if (newImportance < this.config.decay.archiveThreshold) {
                    memory.status = 'archived';
                    appLogger.debug(SERVICE_NAME, `Auto-archived memory: ${memory.id}`);
                }

                await this.updateAdvancedMemory(memory);
            }
        }

        appLogger.info(SERVICE_NAME, `Decay maintenance completed for ${allMemories.length} memories`);
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
            project: 0.7,
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
            project: 0.75,
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
            'i am', 'i\'m', 'my name', 'i prefer', 'i like', 'i use', 'i work',
            'i want', 'i need', 'always', 'never', 'usually', 'remember',
            'note that', 'keep in mind', 'don\'t forget', 'important:',
            // Turkish indicators (for localized fact detection)
            'benim', 'ben', 'adım', 'tercih', 'severim', 'kullanıyorum', 'çalışıyorum'
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
2. Category: preference, personal, project, technical, workflow, relationship, fact, or instruction
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
                category: f.category as MemoryCategory,
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
        const allMemories = await this.getAllAdvancedMemories();
        const pending = this.getPendingMemories();

        const byStatus: Record<MemoryStatus, number> = {
            pending: pending.length,
            confirmed: 0,
            archived: 0,
            contradicted: 0,
            merged: 0
        };

        const byCategory: Record<MemoryCategory, number> = {
            preference: 0,
            personal: 0,
            project: 0,
            technical: 0,
            workflow: 0,
            relationship: 0,
            fact: 0,
            instruction: 0
        };

        const bySource: Record<MemorySource, number> = {
            user_explicit: 0,
            user_implicit: 0,
            system: 0,
            conversation: 0,
            tool_result: 0
        };

        let totalConfidence = 0;
        let totalImportance = 0;
        let contradictions = 0;
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        let recentlyAccessed = 0;
        let recentlyCreated = 0;

        for (const memory of allMemories) {
            byStatus[memory.status]++;
            byCategory[memory.category]++;
            bySource[memory.source]++;
            totalConfidence += memory.confidence;
            totalImportance += memory.importance;
            contradictions += memory.contradictsIds.length;

            if (memory.lastAccessedAt > oneDayAgo) { recentlyAccessed++; }
            if (memory.createdAt > oneDayAgo) { recentlyCreated++; }
        }

        return {
            total: allMemories.length,
            byStatus,
            byCategory,
            bySource,
            averageConfidence: allMemories.length > 0 ? totalConfidence / allMemories.length : 0,
            averageImportance: allMemories.length > 0 ? totalImportance / allMemories.length : 0,
            pendingValidation: pending.length,
            contradictions,
            recentlyAccessed,
            recentlyCreated,
            totalEmbeddingSize: allMemories.reduce((sum, m) => sum + m.embedding.length * 4, 0)
        };
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Apply diversity to search results
     */
    private applyDiversity(
        scoredCandidates: Array<{ memory: AdvancedSemanticFragment; finalScore: number }>,
        limit: number,
        diversityFactor: number
    ): AdvancedSemanticFragment[] {
        const results: AdvancedSemanticFragment[] = [];
        const usedCategories = new Set<MemoryCategory>();

        for (const candidate of scoredCandidates) {
            if (results.length >= limit) { break; }

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

    /**
     * Apply recall filters
     */
    private applyRecallFilters(
        memories: AdvancedSemanticFragment[],
        context: RecallContext
    ): AdvancedSemanticFragment[] {
        return memories.filter(m => this.matchesRecallFilters(m, context));
    }

    private matchesRecallFilters(m: AdvancedSemanticFragment, context: RecallContext): boolean {
        return (
            this.matchesBasicFilters(m, context) &&
            this.matchesTimeFilters(m, context) &&
            this.matchesScoreFilters(m, context) &&
            this.matchesStatusFilters(m, context)
        );
    }

    private matchesBasicFilters(m: AdvancedSemanticFragment, context: RecallContext): boolean {
        if (context.projectId && m.projectId !== context.projectId) { return false; }
        if (context.categories && !context.categories.includes(m.category)) { return false; }
        if (context.tags && !context.tags.some(t => m.tags.includes(t))) { return false; }
        return true;
    }

    private matchesTimeFilters(m: AdvancedSemanticFragment, context: RecallContext): boolean {
        if (context.createdAfter && m.createdAt < context.createdAfter) { return false; }
        if (context.createdBefore && m.createdAt > context.createdBefore) { return false; }
        return true;
    }

    private matchesScoreFilters(m: AdvancedSemanticFragment, context: RecallContext): boolean {
        if (context.minConfidence && m.confidence < context.minConfidence) { return false; }
        if (context.minImportance && m.importance < context.minImportance) { return false; }
        return true;
    }

    private matchesStatusFilters(m: AdvancedSemanticFragment, context: RecallContext): boolean {
        if (!context.includeArchived && m.status === 'archived') { return false; }
        if (!context.includePending && m.status === 'pending') { return false; }
        return true;
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
        await this.db.storeAdvancedMemory(memory);
    }

    private async updateAdvancedMemory(memory: AdvancedSemanticFragment): Promise<void> {
        await this.db.updateAdvancedMemory(memory);
    }

    private async getMemoryById(id: string): Promise<AdvancedSemanticFragment | null> {
        return this.db.getAdvancedMemoryById(id);
    }

    private async getAllAdvancedMemories(): Promise<AdvancedSemanticFragment[]> {
        return this.db.getAllAdvancedMemories();
    }

    private async searchMemoriesByVector(embedding: number[], limit: number): Promise<AdvancedSemanticFragment[]> {
        return this.db.searchAdvancedMemories(embedding, limit);
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
        await this.db.savePendingMemory(pending);
    }

    private async deletePendingMemory(id: string): Promise<void> {
        await this.db.deletePendingMemory(id);
    }

    private async loadPendingMemories(): Promise<void> {
        const pending = await this.db.getAllPendingMemories();
        for (const p of pending) {
            this.stagingBuffer.set(p.id, p);
        }
        appLogger.info(SERVICE_NAME, `Loaded ${pending.length} pending memories`);
    }

    // ========================================================================
    // LLM HELPERS
    // ========================================================================

    private async getAvailableModel(): Promise<string | null> {
        if (this.cachedOllamaModel) { return this.cachedOllamaModel; }

        try {
            const res = await fetch('http://127.0.0.1:11434/api/tags');
            if (!res.ok) { return null; }

            const data = await res.json() as OllamaTagsResponse;
            const installed = data.models.map(m => m.name.toLowerCase());

            for (const preferred of PREFERRED_MODELS) {
                const match = installed.find(m => m === preferred || m.startsWith(preferred.split(':')[0]));
                if (match) {
                    this.cachedOllamaModel = match;
                    appLogger.info(SERVICE_NAME, `Using Ollama model: ${match}`);
                    return match;
                }
            }

            if (installed.length > 0) {
                this.cachedOllamaModel = installed[0];
                return installed[0];
            }
        } catch {
            appLogger.debug(SERVICE_NAME, 'Ollama not available');
        }

        return null;
    }

    private async callLLM(messages: ChatMessage[], model: string, provider: string = 'ollama'): Promise<{ content: string }> {
        return this.llmService.chat(messages, model, [], provider);
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
            projectId?: string | null;
        }
    ): Promise<AdvancedSemanticFragment | null> {
        const memory = await this.getMemoryById(id);
        if (!memory) {
            appLogger.warn(SERVICE_NAME, `Memory not found for edit: ${id}`);
            return null;
        }

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

        if (updates.projectId !== undefined) {
            memory.projectId = updates.projectId ?? undefined;
        }

        memory.updatedAt = Date.now();

        await this.updateAdvancedMemory(memory);
        appLogger.info(SERVICE_NAME, `Memory edited: ${id}`);
        return memory;
    }

    /**
     * Archive a memory (soft delete)
     */
    async archiveMemory(id: string): Promise<boolean> {
        const memory = await this.getMemoryById(id);
        if (!memory) {
            return false;
        }

        memory.status = 'archived';
        memory.updatedAt = Date.now();
        await this.updateAdvancedMemory(memory);
        appLogger.info(SERVICE_NAME, `Memory archived: ${id}`);
        return true;
    }

    /**
     * Restore an archived memory
     */
    async restoreMemory(id: string): Promise<boolean> {
        const memory = await this.getMemoryById(id);
        if (memory?.status !== 'archived') {
            return false;
        }

        memory.status = 'confirmed';
        memory.updatedAt = Date.now();
        await this.updateAdvancedMemory(memory);
        appLogger.info(SERVICE_NAME, `Memory restored: ${id}`);
        return true;
    }

    /**
     * Archive multiple memories
     */
    async archiveMemories(ids: string[]): Promise<{ archived: number; failed: string[] }> {
        let archived = 0;
        const failed: string[] = [];

        for (const id of ids) {
            const success = await this.archiveMemory(id);
            if (success) {
                archived++;
            } else {
                failed.push(id);
            }
        }

        return { archived, failed };
    }

    /**
     * Get a single memory by ID (public method)
     */
    async getMemory(id: string): Promise<AdvancedSemanticFragment | null> {
        return this.getMemoryById(id);
    }
}
