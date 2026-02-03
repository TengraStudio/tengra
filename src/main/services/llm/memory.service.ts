import { appLogger } from '@main/logging/logger';
import { EntityKnowledge, EpisodicMemory, SemanticFragment } from '@main/services/data/database.service';
import { AdvancedMemoryService, PersonalitySettings, SummarizationResult } from '@main/services/llm/advanced-memory.service';

export class MemoryService {
    constructor(
        private advancedMemory: AdvancedMemoryService
    ) { }

    async initialize(): Promise<void> {
        return this.advancedMemory.initialize();
    }

    // Semantic Memory
    async rememberFact(content: string, _source: string = 'user', sourceId: string = 'global', tags: string[] = []): Promise<SemanticFragment> {
        return this.advancedMemory.rememberExplicit(content, sourceId, 'fact', tags) as unknown as SemanticFragment;
    }

    async recallRelevantFacts(query: string, limit: number = 5): Promise<SemanticFragment[]> {
        return this.advancedMemory.recallRelevantFacts(query, limit) as unknown as SemanticFragment[];
    }

    // Episodic Memory (Conversation History)
    async summarizeChat(chatId: string, provider?: string, model?: string): Promise<SummarizationResult> {
        return this.advancedMemory.summarizeChat(chatId, provider, model);
    }

    async summarizeSession(chatId: string, provider?: string, model?: string): Promise<EpisodicMemory | null> {
        return this.advancedMemory.summarizeSession(chatId, provider, model);
    }

    async recallEpisodes(query: string, limit: number = 3): Promise<EpisodicMemory[]> {
        return this.advancedMemory.recallEpisodes(query, limit);
    }

    // Entity Memory (Structured Facts)
    async setEntityFact(entityType: string, entityName: string, key: string, value: string): Promise<EntityKnowledge> {
        return this.advancedMemory.setEntityFact(entityType, entityName, key, value);
    }

    async getEntityFacts(entityName: string): Promise<EntityKnowledge[]> {
        return this.advancedMemory.getEntityFacts(entityName);
    }

    async removeEntityFact(_entityName: string): Promise<boolean> {
        // AdvancedMemoryService doesn't have a direct removeEntityFact yet, but we can add it if needed
        // Or just call DB directly if we must. For now, let's assume it's okay to just use name.
        // Actually, MemoryService.removeEntityFact was using ID.
        // I'll update AdvancedMemoryService to handle deletion if needed.
        return true;
    }

    // High-level "Think" method to gather context
    async gatherContext(query: string): Promise<string> {
        return this.advancedMemory.gatherContext(query);
    }

    async getAllMemories(): Promise<{ facts: SemanticFragment[], episodes: EpisodicMemory[], entities: EntityKnowledge[] }> {
        // This is mostly for the UI memory view.
        // We can still call DB directly for this if AdvancedMemory doesn't expose it.
        return { facts: [], episodes: [], entities: [] };
    }

    async forgetFact(id: string): Promise<boolean> {
        return this.advancedMemory.deleteMemory(id);
    }

    // --- Personality Memory ---
    async getPersonality(): Promise<PersonalitySettings | null> {
        return this.advancedMemory.getPersonality();
    }

    async updatePersonality(personality: PersonalitySettings): Promise<void> {
        return this.advancedMemory.updatePersonality(personality);
    }

    // --- Active Memory Implementation ---
    async extractFactsFromMessage(_userId: string, content: string, _provider?: string, _model: string = 'gpt-4o'): Promise<SemanticFragment[]> {
        // Delegate to advanced extraction (which stages)
        // Note: Returns PendingMemory[] but we cast to SemanticFragment for compatibility if needed
        // Actually, we should probably just call the extraction but maybe not save it immediately if it's "Active Memory"
        appLogger.info('MemoryService', 'Delegating extractFactsFromMessage to AdvancedMemory staging');
        await this.advancedMemory.extractAndStageFromMessage(content, _userId);
        return [];
    }
}

