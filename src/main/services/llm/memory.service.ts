/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { EntityKnowledge, EpisodicMemory, SemanticFragment } from '@main/services/data/database.service';
import { AdvancedMemoryService, PersonalitySettings, SummarizationResult } from '@main/services/llm/advanced-memory.service';
import { MEMORY_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

const MemoryIdSchema = z.string().min(1).max(128);
const MemoryContentSchema = z.string().min(1).max(10 * 1024);
const MemoryQuerySchema = z.string().min(1).max(1024);
const MemoryFieldSchema = z.string().min(1).max(256);
const MemoryTagsSchema = z.array(z.string().min(1).max(64)).max(20).default([]);

export class MemoryService {
    constructor(
        private advancedMemory: AdvancedMemoryService
    ) { }

    async initialize(): Promise<void> {
        return this.advancedMemory.initialize();
    }

    @ipc(MEMORY_CHANNELS.GET_ALL)
    async getAllMemoriesIpc(_event: IpcMainInvokeEvent) {
        return await this.getAllMemories();
    }

    @ipc(MEMORY_CHANNELS.DELETE_FACT)
    async deleteFactIpc(_event: IpcMainInvokeEvent, factId: string) {
        const validatedId = MemoryIdSchema.parse(factId);
        const success = await this.forgetFact(validatedId);
        return { success };
    }

    @ipc(MEMORY_CHANNELS.DELETE_ENTITY)
    async deleteEntityIpc(_event: IpcMainInvokeEvent, entityId: string) {
        const validatedId = MemoryIdSchema.parse(entityId);
        const success = await this.removeEntityFact(validatedId);
        return { success };
    }

    @ipc(MEMORY_CHANNELS.ADD_FACT)
    async addFactIpc(_event: IpcMainInvokeEvent, content: string, tags: string[]) {
        const validatedContent = MemoryContentSchema.parse(content);
        const validatedTags = MemoryTagsSchema.parse(tags);
        const fragment = await this.rememberFact(validatedContent, 'manual', 'user-added', validatedTags);
        return { success: true, id: fragment.id };
    }

    @ipc(MEMORY_CHANNELS.SET_ENTITY_FACT)
    async setEntityFactIpc(
        _event: IpcMainInvokeEvent,
        entityType: string,
        entityName: string,
        key: string,
        value: string
    ) {
        const vType = MemoryFieldSchema.parse(entityType);
        const vName = MemoryFieldSchema.parse(entityName);
        const vKey = MemoryFieldSchema.parse(key);
        const vValue = MemoryContentSchema.parse(value);
        const knowledge = await this.setEntityFact(vType, vName, vKey, vValue);
        return { success: true, id: knowledge.id };
    }

    @ipc(MEMORY_CHANNELS.SEARCH)
    async searchIpc(_event: IpcMainInvokeEvent, query: string) {
        const validatedQuery = MemoryQuerySchema.parse(query);
        const facts = await this.recallRelevantFacts(validatedQuery, 10);
        const episodes = await this.recallEpisodes(validatedQuery, 5);
        return { facts, episodes };
    }

    // Semantic Memory
    async rememberFact(content: string, _source: string = 'user', sourceId: string = 'global', tags: string[] = []): Promise<SemanticFragment> {
        return this.advancedMemory.rememberExplicit(content, sourceId, 'fact', tags) as RuntimeValue as SemanticFragment;
    }

    async recallRelevantFacts(query: string, limit: number = 5): Promise<SemanticFragment[]> {
        return this.advancedMemory.recallRelevantFacts(query, limit) as RuntimeValue as SemanticFragment[];
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
        const normalized = _entityName.trim();
        if (!normalized) {
            return false;
        }

        const allEntities = await this.advancedMemory.getAllEntityFacts();
        const directEntityName = allEntities.find(entity => entity.entityName === normalized);
        if (directEntityName) {
            return this.advancedMemory.deleteEntityFacts(directEntityName.entityName);
        }

        const byId = allEntities.find(entity => entity.id === normalized);
        if (byId) {
            return this.advancedMemory.deleteEntityFacts(byId.entityName);
        }

        return this.advancedMemory.deleteEntityFacts(normalized);
    }

    // High-level "Think" method to gather context
    async gatherContext(query: string): Promise<string> {
        return this.advancedMemory.gatherContext(query);
    }

    async getAllMemories(): Promise<{ facts: SemanticFragment[], episodes: EpisodicMemory[], entities: EntityKnowledge[] }> {
        const [facts, episodes, entities] = await Promise.all([
            this.advancedMemory.getAllAdvancedMemories(),
            this.advancedMemory.getAllEpisodes(),
            this.advancedMemory.getAllEntityFacts(),
        ]);

        const mappedFacts = facts.map(memory => ({
            id: memory.id,
            content: memory.content,
            embedding: memory.embedding,
            source: memory.source,
            sourceId: memory.sourceId,
            tags: memory.tags,
            importance: memory.importance,
            workspacePath: memory.workspaceId,
            createdAt: memory.createdAt,
            updatedAt: memory.updatedAt,
        })) as SemanticFragment[];

        return { facts: mappedFacts, episodes, entities };
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


