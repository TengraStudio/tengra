import { DatabaseService } from '@main/services/data/database.service';
import { AdvancedSemanticFragment, PendingMemory } from '@shared/types/advanced-memory';

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
}
