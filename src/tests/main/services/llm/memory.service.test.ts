/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EntityKnowledge, EpisodicMemory, SemanticFragment } from '@main/services/data/database.service';
import { AdvancedMemoryService, PersonalitySettings, SummarizationResult } from '@main/services/llm/advanced-memory.service';
import { MemoryService } from '@main/services/llm/memory.service';
import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

function createMockAdvancedMemory() {
    return {
        initialize: vi.fn(async () => undefined),
        rememberExplicit: vi.fn(async (): Promise<SemanticFragment> => ({
            id: 'fact-1',
            content: 'test fact',
            embedding: [0.1],
            source: 'user',
            sourceId: 'global',
            tags: [],
            createdAt: Date.now(),
        }) as never as SemanticFragment),
        recallRelevantFacts: vi.fn(async (): Promise<SemanticFragment[]> => []),
        summarizeChat: vi.fn(async (): Promise<SummarizationResult> => ({
            summary: 'test summary',
            messageCount: 5,
            success: true,
        }) as never as SummarizationResult),
        summarizeSession: vi.fn(async (): Promise<EpisodicMemory | null> => null),
        recallEpisodes: vi.fn(async (): Promise<EpisodicMemory[]> => []),
        setEntityFact: vi.fn(async (): Promise<EntityKnowledge> => ({
            id: 'ek-1',
            entityType: 'user',
            entityName: 'Alice',
            key: 'role',
            value: 'developer',
        }) as never as EntityKnowledge),
        getEntityFacts: vi.fn(async (): Promise<EntityKnowledge[]> => []),
        getAllEntityFacts: vi.fn(async (): Promise<EntityKnowledge[]> => []),
        deleteEntityFacts: vi.fn(async () => true),
        gatherContext: vi.fn(async () => 'context text'),
        deleteMemory: vi.fn(async () => true),
        getAllAdvancedMemories: vi.fn(async () => []),
        getAllEpisodes: vi.fn(async () => []),
        getPersonality: vi.fn(async (): Promise<PersonalitySettings | null> => null),
        updatePersonality: vi.fn(async () => undefined),
        extractAndStageFromMessage: vi.fn(async () => []),
    };
}

describe('MemoryService', () => {
    let service: MemoryService;
    let mockAdvanced: ReturnType<typeof createMockAdvancedMemory>;

    beforeEach(() => {
        vi.restoreAllMocks();
        mockAdvanced = createMockAdvancedMemory();
        service = new MemoryService(mockAdvanced as never as AdvancedMemoryService);
    });

    describe('initialize', () => {
        it('delegates to advancedMemory.initialize', async () => {
            await service.initialize();
            expect(mockAdvanced.initialize).toHaveBeenCalledOnce();
        });
    });

    describe('rememberFact', () => {
        it('delegates to advancedMemory.rememberExplicit', async () => {
            const result = await service.rememberFact('test fact', 'user', 'global', ['tag1']);
            expect(mockAdvanced.rememberExplicit).toHaveBeenCalledWith('test fact', 'global', 'fact', ['tag1']);
            expect(result).toBeDefined();
        });
    });

    describe('recallRelevantFacts', () => {
        it('delegates with query and limit', async () => {
            await service.recallRelevantFacts('query', 10);
            expect(mockAdvanced.recallRelevantFacts).toHaveBeenCalledWith('query', 10);
        });

        it('uses default limit of 5', async () => {
            await service.recallRelevantFacts('query');
            expect(mockAdvanced.recallRelevantFacts).toHaveBeenCalledWith('query', 5);
        });
    });

    describe('summarizeChat', () => {
        it('delegates to advancedMemory', async () => {
            const result = await service.summarizeChat('chat-1', 'openai', 'gpt-4');
            expect(mockAdvanced.summarizeChat).toHaveBeenCalledWith('chat-1', 'openai', 'gpt-4');
            expect(result).toBeDefined();
        });
    });

    describe('summarizeSession', () => {
        it('delegates to advancedMemory', async () => {
            await service.summarizeSession('chat-1');
            expect(mockAdvanced.summarizeSession).toHaveBeenCalledWith('chat-1', undefined, undefined);
        });
    });

    describe('recallEpisodes', () => {
        it('uses default limit of 3', async () => {
            await service.recallEpisodes('query');
            expect(mockAdvanced.recallEpisodes).toHaveBeenCalledWith('query', 3);
        });
    });

    describe('setEntityFact', () => {
        it('delegates to advancedMemory', async () => {
            const result = await service.setEntityFact('user', 'Alice', 'role', 'dev');
            expect(mockAdvanced.setEntityFact).toHaveBeenCalledWith('user', 'Alice', 'role', 'dev');
            expect(result).toBeDefined();
        });
    });

    describe('getEntityFacts', () => {
        it('delegates to advancedMemory', async () => {
            await service.getEntityFacts('Alice');
            expect(mockAdvanced.getEntityFacts).toHaveBeenCalledWith('Alice');
        });
    });

    describe('removeEntityFact', () => {
        it('returns true (stub implementation)', async () => {
            const result = await service.removeEntityFact('Alice');
            expect(result).toBe(true);
            expect(mockAdvanced.getAllEntityFacts).toHaveBeenCalledOnce();
            expect(mockAdvanced.deleteEntityFacts).toHaveBeenCalledWith('Alice');
        });
    });

    describe('gatherContext', () => {
        it('delegates to advancedMemory', async () => {
            const result = await service.gatherContext('query');
            expect(result).toBe('context text');
            expect(mockAdvanced.gatherContext).toHaveBeenCalledWith('query');
        });
    });

    describe('getAllMemories', () => {
        it('returns empty collections', async () => {
            const result = await service.getAllMemories();
            expect(result).toEqual({ facts: [], episodes: [], entities: [] });
        });
    });

    describe('forgetFact', () => {
        it('delegates to advancedMemory.deleteMemory', async () => {
            const result = await service.forgetFact('fact-1');
            expect(result).toBe(true);
            expect(mockAdvanced.deleteMemory).toHaveBeenCalledWith('fact-1');
        });
    });

    describe('personality', () => {
        it('getPersonality delegates to advancedMemory', async () => {
            await service.getPersonality();
            expect(mockAdvanced.getPersonality).toHaveBeenCalled();
        });

        it('updatePersonality delegates to advancedMemory', async () => {
            const personality = { tone: 'friendly' } as never as PersonalitySettings;
            await service.updatePersonality(personality);
            expect(mockAdvanced.updatePersonality).toHaveBeenCalledWith(personality);
        });
    });

    describe('extractFactsFromMessage', () => {
        it('delegates to extractAndStageFromMessage and returns empty array', async () => {
            const result = await service.extractFactsFromMessage('user-1', 'some content', 'openai', 'gpt-4');
            expect(mockAdvanced.extractAndStageFromMessage).toHaveBeenCalledWith('some content', 'user-1');
            expect(result).toEqual([]);
        });
    });
});
