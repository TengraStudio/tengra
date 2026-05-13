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
import {
    AdvancedMemoryConfig,
    AdvancedSemanticFragment,
    ConsolidationResult,
    ContradictionCandidate,
    SimilarMemoryCandidate,
} from '@shared/types/advanced-memory';
import { safeJsonParse } from '@shared/utils/sanitize.util';

const SERVICE_NAME = 'AdvancedMemoryService';

interface IndexingDependencies {
    config: AdvancedMemoryConfig
    generateEmbedding: (content: string) => Promise<number[]>
    searchMemoriesByVector: (
        embedding: number[],
        limit: number
    ) => Promise<AdvancedSemanticFragment[]>
    getAvailableModel: () => Promise<string | null>
    callLLM: (
        messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>,
        model: string,
        provider?: string
    ) => Promise<{ content: string }>
    getMemoryById: (id: string) => Promise<AdvancedSemanticFragment | null>
    updateAdvancedMemory: (memory: AdvancedSemanticFragment) => Promise<void>
    updateMemoryStatus: (
        id: string,
        status: AdvancedSemanticFragment['status']
    ) => Promise<void>
    cosineSimilarity: (left: number[], right: number[]) => number
}

export class AdvancedMemoryIndexingService {
    static readonly serviceName = 'advancedMemoryIndexingService';
    static readonly dependencies = ['deps'] as const;
    constructor(private readonly deps: IndexingDependencies) {}

    async findContradictions(
        content: string,
        embedding: number[]
    ): Promise<ContradictionCandidate[]> {
        const similar = await this.deps.searchMemoriesByVector(embedding, 10);
        const candidates: ContradictionCandidate[] = [];

        if (similar.length === 0) {
            return candidates;
        }

        const model = await this.deps.getAvailableModel();
        if (!model) {
            return candidates;
        }

        const existingContents = similar.map(memory => ({
            id: memory.id,
            content: memory.content,
        }));

        const prompt = `Analyze if the new fact contradicts any existing facts.

New Fact: "${content}"

Existing Facts:
${existingContents.map((entry, index) => `${index + 1}. [${entry.id}] ${entry.content}`).join('\n')}

Return a JSON array of contradictions found. For each contradiction include:
- existingId: the ID of the contradicting fact
- conflictType: "direct" (complete opposite), "partial" (some conflict), or "temporal" (outdated info)
- explanation: brief explanation of the conflict
- resolution: "keep_new", "keep_old", "keep_both", or "merge"

If no contradictions, return an empty array [].

Example output:
[{"existingId": "abc123", "conflictType": "direct", "explanation": "User previously preferred dark mode, now prefers light", "resolution": "keep_new"}]`;

        try {
            const response = await this.deps.callLLM([{ role: 'user', content: prompt }], model);
            const parsed = safeJsonParse<
                Array<{
                    existingId: string
                    conflictType: string
                    explanation: string
                    resolution: string
                }>
            >(response.content.replace(/```json|```/g, '').trim(), []);

            for (const contradiction of parsed) {
                const existing = similar.find(memory => memory.id === contradiction.existingId);
                if (!existing) {
                    continue;
                }

                candidates.push({
                    existingMemoryId: contradiction.existingId,
                    existingContent: existing.content,
                    conflictType: contradiction.conflictType as 'direct' | 'partial' | 'temporal',
                    conflictExplanation: contradiction.explanation,
                    suggestedResolution: contradiction.resolution as
                        | 'keep_new'
                        | 'keep_old'
                        | 'keep_both'
                        | 'merge',
                });
            }
        } catch (error) {
            appLogger.warn(SERVICE_NAME, `Contradiction detection failed: ${String(error)}`);
        }

        return candidates;
    }

    async handleContradictions(memory: AdvancedSemanticFragment): Promise<void> {
        const contradictions = await this.findContradictions(memory.content, memory.embedding);

        for (const contradiction of contradictions) {
            if (contradiction.suggestedResolution === 'keep_new') {
                await this.deps.updateMemoryStatus(
                    contradiction.existingMemoryId,
                    'contradicted'
                );
                memory.contradictsIds.push(contradiction.existingMemoryId);
                continue;
            }

            if (contradiction.suggestedResolution === 'merge') {
                memory.relatedMemoryIds.push(contradiction.existingMemoryId);
            }
        }
    }

    async findSimilarMemories(
        embedding: number[]
    ): Promise<SimilarMemoryCandidate[]> {
        const similar = await this.deps.searchMemoriesByVector(embedding, 5);
        const candidates: SimilarMemoryCandidate[] = [];

        for (const memory of similar) {
            const similarity = this.deps.cosineSimilarity(embedding, memory.embedding);
            if (similarity < this.deps.config.consolidation.similarityThreshold) {
                continue;
            }

            candidates.push({
                memoryId: memory.id,
                content: memory.content,
                similarityScore: similarity,
                canMerge: similarity >= this.deps.config.consolidation.autoMergeThreshold,
                mergeStrategy:
                    similarity >= 0.95
                        ? 'replace'
                        : similarity >= 0.85
                            ? 'append'
                            : 'generalize',
            });
        }

        return candidates;
    }

    async attemptConsolidation(
        newMemory: AdvancedSemanticFragment,
        similarCandidates: SimilarMemoryCandidate[]
    ): Promise<ConsolidationResult> {
        if (!this.deps.config.consolidation.enabled || similarCandidates.length === 0) {
            return {
                action: 'none',
                affectedMemoryIds: [],
                explanation: 'Consolidation disabled or no candidates',
            };
        }

        const autoMergeCandidates = similarCandidates.filter(candidate => candidate.canMerge);
        if (autoMergeCandidates.length === 0) {
            for (const candidate of similarCandidates) {
                newMemory.relatedMemoryIds.push(candidate.memoryId);
            }

            return {
                action: 'linked',
                affectedMemoryIds: similarCandidates.map(candidate => candidate.memoryId),
                explanation: 'Linked to similar memories',
            };
        }

        const bestMatch = autoMergeCandidates.sort(
            (left, right) => right.similarityScore - left.similarityScore
        )[0];
        const existingMemory = await this.deps.getMemoryById(bestMatch.memoryId);

        if (!existingMemory) {
            return {
                action: 'none',
                affectedMemoryIds: [],
                explanation: 'Could not find existing memory',
            };
        }

        if (bestMatch.mergeStrategy === 'replace') {
            existingMemory.content = newMemory.content;
            existingMemory.updatedAt = Date.now();
            existingMemory.accessCount += 1;
            await this.deps.updateAdvancedMemory(existingMemory);

            return {
                action: 'merged',
                resultingMemoryId: existingMemory.id,
                affectedMemoryIds: [existingMemory.id],
                explanation: 'Replaced with more recent identical memory',
            };
        }

        if (bestMatch.mergeStrategy === 'append') {
            const model = await this.deps.getAvailableModel();
            if (model) {
                const mergedContent = await this.mergeMemoryContents(
                    existingMemory.content,
                    newMemory.content,
                    model
                );

                existingMemory.content = mergedContent;
                existingMemory.embedding = await this.deps.generateEmbedding(mergedContent);
                existingMemory.updatedAt = Date.now();
                await this.deps.updateAdvancedMemory(existingMemory);

                return {
                    action: 'merged',
                    resultingMemoryId: existingMemory.id,
                    affectedMemoryIds: [existingMemory.id],
                    explanation: 'Appended new information to existing memory',
                };
            }
        }

        return {
            action: 'none',
            affectedMemoryIds: [],
            explanation: 'No consolidation action taken',
        };
    }

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
            const response = await this.deps.callLLM([{ role: 'user', content: prompt }], model);
            return response.content.trim().replace(/^["']|["']$/g, '');
        } catch {
            return `${existing}. Additionally: ${newContent}`;
        }
    }
}

