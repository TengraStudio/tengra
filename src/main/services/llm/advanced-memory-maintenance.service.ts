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
import { DatabaseService } from '@main/services/data/database.service';
import { ChatMessage } from '@main/types/llm.types';
import {
    AdvancedMemoryConfig,
    AdvancedSemanticFragment,
    createEmptyMemoryCategoryCounts,
    MEMORY_CATEGORY_VALUES,
    MemoryCategory,
    MemorySource,
    MemoryStatistics,
    MemoryStatus,
    normalizeMemoryCategory,
    PendingMemory,
} from '@shared/types/advanced-memory';

const SERVICE_NAME = 'AdvancedMemoryService';

interface MaintenanceDependencies {
    config: AdvancedMemoryConfig
    db: DatabaseService
    stagingBuffer: Map<string, PendingMemory>
    getAllAdvancedMemories: () => Promise<AdvancedSemanticFragment[]>
    updateAdvancedMemory: (memory: AdvancedSemanticFragment) => Promise<void>
    getMemoryById: (id: string) => Promise<AdvancedSemanticFragment | null>
    getPendingMemories: () => PendingMemory[]
    getAvailableModel: () => Promise<string | null>
    callLLM: (
        messages: ChatMessage[],
        model: string,
        provider?: string
    ) => Promise<{ content: string }>
    editMemory: (
        id: string,
        updates: Partial<AdvancedSemanticFragment> & { editReason?: string }
    ) => Promise<AdvancedSemanticFragment | null>
    calculateDecayedImportance: (
        memory: AdvancedSemanticFragment,
        now: number
    ) => number
}

export class AdvancedMemoryMaintenanceService {
    constructor(private readonly deps: MaintenanceDependencies) {}

    async runDecayMaintenance(): Promise<void> {
        if (!this.deps.config.decay.enabled) {
            return;
        }

        const allMemories = await this.deps.getAllAdvancedMemories();
        const now = Date.now();

        for (const memory of allMemories) {
            if (memory.status !== 'confirmed') {
                continue;
            }

            if (memory.expiresAt && memory.expiresAt < now) {
                memory.status = 'archived';
                await this.deps.updateAdvancedMemory(memory);
                continue;
            }

            const newImportance = this.deps.calculateDecayedImportance(memory, now);
            if (newImportance === memory.importance) {
                continue;
            }

            memory.importance = newImportance;
            memory.updatedAt = now;

            if (newImportance < this.deps.config.decay.archiveThreshold) {
                memory.status = 'archived';
                appLogger.debug(SERVICE_NAME, `Auto-archived memory: ${memory.id}`);
            }

            await this.deps.updateAdvancedMemory(memory);
        }

        appLogger.info(
            SERVICE_NAME,
            `Decay maintenance completed for ${allMemories.length} memories`
        );
    }

    async getStatistics(): Promise<MemoryStatistics> {
        const allMemories = await this.deps.getAllAdvancedMemories();
        const pending = this.deps.getPendingMemories();

        const byStatus: Record<MemoryStatus, number> = {
            pending: pending.length,
            confirmed: 0,
            archived: 0,
            contradicted: 0,
            merged: 0,
        };

        const byCategory: Record<MemoryCategory, number> = createEmptyMemoryCategoryCounts();

        const bySource: Record<MemorySource, number> = {
            user_explicit: 0,
            user_implicit: 0,
            system: 0,
            conversation: 0,
            tool_result: 0,
        };

        let totalConfidence = 0;
        let totalImportance = 0;
        let contradictions = 0;
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        let recentlyAccessed = 0;
        let recentlyCreated = 0;

        for (const memory of allMemories) {
            byStatus[memory.status] += 1;
            byCategory[memory.category] += 1;
            bySource[memory.source] += 1;
            totalConfidence += memory.confidence;
            totalImportance += memory.importance;
            contradictions += memory.contradictsIds.length;

            if (memory.lastAccessedAt > oneDayAgo) {
                recentlyAccessed += 1;
            }
            if (memory.createdAt > oneDayAgo) {
                recentlyCreated += 1;
            }
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
            totalEmbeddingSize: allMemories.reduce(
                (sum, memory) => sum + memory.embedding.length * 4,
                0
            ),
        };
    }

    async clearExistingMemories(): Promise<void> {
        const existing = await this.deps.getAllAdvancedMemories();
        for (let index = 0; index < existing.length; index += 1) {
            await this.deps.db.deleteAdvancedMemory(existing[index].id);
        }

        const pending = await this.deps.db.getAllPendingMemories();
        for (let index = 0; index < pending.length; index += 1) {
            await this.deps.db.deletePendingMemory(pending[index].id);
        }

        this.deps.stagingBuffer.clear();
    }

    async archiveMemory(id: string): Promise<boolean> {
        const memory = await this.deps.getMemoryById(id);
        if (!memory) {
            return false;
        }

        memory.status = 'archived';
        memory.updatedAt = Date.now();
        await this.deps.updateAdvancedMemory(memory);
        appLogger.info(SERVICE_NAME, `Memory archived: ${id}`);
        return true;
    }

    async restoreMemory(id: string): Promise<boolean> {
        const memory = await this.deps.getMemoryById(id);
        if (memory?.status !== 'archived') {
            return false;
        }

        memory.status = 'confirmed';
        memory.updatedAt = Date.now();
        await this.deps.updateAdvancedMemory(memory);
        appLogger.info(SERVICE_NAME, `Memory restored: ${id}`);
        return true;
    }

    async archiveMemories(
        ids: string[]
    ): Promise<{ archived: number; failed: string[] }> {
        let archived = 0;
        const failed: string[] = [];

        for (const id of ids) {
            const success = await this.archiveMemory(id);
            if (success) {
                archived += 1;
                continue;
            }
            failed.push(id);
        }

        return { archived, failed };
    }

    async recategorizeMemories(memoryIds?: string[]): Promise<number> {
        const memories = memoryIds
            ? await Promise.all(memoryIds.map(id => this.deps.getMemoryById(id)))
            : await this.deps.getAllAdvancedMemories();

        const validMemories = memories.filter(
            (memory): memory is AdvancedSemanticFragment => memory !== null
        );
        const model = await this.deps.getAvailableModel();
        if (!model || validMemories.length === 0) {
            return 0;
        }

        let updatedCount = 0;
        const validCategories: MemoryCategory[] = [...MEMORY_CATEGORY_VALUES];
        const categoryList = validCategories.join(', ');

        for (const memory of validMemories) {
            const prompt = `Identify the best category for this fact from: ${categoryList}.
Fact: "${memory.content}"
Current Category: ${memory.category}
Return only the category name.`;

            try {
                const response = await this.deps.callLLM([{ role: 'user', content: prompt }], model);
                const nextCategory = normalizeMemoryCategory(response.content
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z]/g, ''));

                if (!nextCategory || !validCategories.includes(nextCategory) || nextCategory === memory.category) {
                    continue;
                }

                await this.deps.editMemory(memory.id, {
                    category: nextCategory,
                    editReason: 'Auto-recategorization',
                });
                updatedCount += 1;
            } catch (error) {
                appLogger.warn(
                    SERVICE_NAME,
                    `Recategorization failed for ${memory.id}: ${String(error)}`
                );
            }
        }

        return updatedCount;
    }

    async cleanupExpiredMemories(): Promise<number> {
        const now = Date.now();
        const allMemories = await this.deps.getAllAdvancedMemories();
        let count = 0;

        for (const memory of allMemories) {
            if (!memory.expiresAt || memory.expiresAt >= now || memory.status === 'archived') {
                continue;
            }

            const archived = await this.archiveMemory(memory.id);
            if (archived) {
                count += 1;
            }
        }

        if (count > 0) {
            appLogger.info(SERVICE_NAME, `Cleaned up ${count} expired memories`);
        }
        return count;
    }
}
