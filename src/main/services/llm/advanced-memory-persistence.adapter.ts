/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DatabaseService } from '@main/services/data/database.service';
import {
    AdvancedSemanticFragment,
    PendingMemory,
    SharedMemoryMergeConflict,
    SharedMemoryNamespace
} from '@shared/types/advanced-memory';

export class AdvancedMemoryPersistenceAdapter {
    constructor(private readonly db: DatabaseService) {}

    async storeAdvancedMemory(memory: AdvancedSemanticFragment): Promise<void> {
        await this.db.storeAdvancedMemory(memory);
    }

    async updateAdvancedMemory(memory: AdvancedSemanticFragment): Promise<void> {
        await this.db.updateAdvancedMemory(memory);
    }

    async getMemoryById(id: string): Promise<AdvancedSemanticFragment | null> {
        return this.db.getAdvancedMemoryById(id);
    }

    async getAllAdvancedMemories(): Promise<AdvancedSemanticFragment[]> {
        return this.db.getAllAdvancedMemories();
    }

    async searchMemoriesByVector(embedding: number[], limit: number): Promise<AdvancedSemanticFragment[]> {
        return this.db.searchAdvancedMemories(embedding, limit);
    }

    async savePendingMemory(pending: PendingMemory): Promise<void> {
        await this.db.savePendingMemory(pending);
    }

    async deletePendingMemory(id: string): Promise<void> {
        await this.db.deletePendingMemory(id);
    }

    async loadPendingMemories(stagingBuffer: Map<string, PendingMemory>): Promise<number> {
        const pending = await this.db.getAllPendingMemories();
        for (const item of pending) {
            stagingBuffer.set(item.id, item);
        }
        return pending.length;
    }

    async upsertSharedMemoryNamespace(namespace: SharedMemoryNamespace): Promise<void> {
        await this.db.upsertSharedMemoryNamespace(namespace);
    }

    async getSharedMemoryNamespaceById(namespaceId: string): Promise<SharedMemoryNamespace | null> {
        return this.db.getSharedMemoryNamespaceById(namespaceId);
    }

    async appendSharedMemoryConflicts(namespaceId: string, conflicts: SharedMemoryMergeConflict[]): Promise<void> {
        await this.db.appendSharedMemoryConflicts(namespaceId, conflicts);
    }

    async getSharedMemoryConflictCount(namespaceId: string): Promise<number> {
        return this.db.getSharedMemoryConflictCount(namespaceId);
    }
}
