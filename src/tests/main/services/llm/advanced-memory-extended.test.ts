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
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach,describe, expect, it, vi } from 'vitest';

describe('AdvancedMemoryService Extended Scenarios', () => {
    let service: AdvancedMemoryService;
    let mockDb: any;
    let mockEmbedding: any;
    let mockLlm: any;
    let mockSettings: any;
    let mockResolver: any;

    beforeEach(() => {
        mockDb = {
            storeAdvancedMemory: vi.fn().mockResolvedValue(undefined),
            savePendingMemory: vi.fn().mockResolvedValue(undefined),
            deletePendingMemory: vi.fn().mockResolvedValue(undefined),
            searchAdvancedMemories: vi.fn().mockResolvedValue([]),
            getAdvancedMemoryById: vi.fn().mockResolvedValue(null),
            updateAdvancedMemory: vi.fn().mockResolvedValue(undefined),
            getAllPendingMemories: vi.fn().mockResolvedValue([]),
            getAllAdvancedMemories: vi.fn().mockResolvedValue([]),
        };

        mockEmbedding = {
            generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        };

        mockLlm = {
            chat: vi.fn(),
            getAvailableProviders: vi.fn().mockResolvedValue(['openai']),
        };

        mockSettings = {
            getSettings: vi.fn().mockReturnValue({
                ai: {
                    preferredMemoryModels: ['llama3.2:1b']
                }
            }),
        };

        mockResolver = {
            resolve: vi.fn().mockResolvedValue({ model: 'gpt-4o', provider: 'openai', source: 'remote' }),
        };

        service = new AdvancedMemoryService(
            {
                db: mockDb as DatabaseService,
                embedding: mockEmbedding as EmbeddingService,
                llmService: mockLlm as LLMService,
                settings: mockSettings as SettingsService,
                backgroundModelResolver: mockResolver as any
            }
        );
    });

    it('should extract and stage facts from a message', async () => {
        // Mock LLM extraction response
        mockLlm.chat.mockResolvedValue({
            content: JSON.stringify([
                { content: 'User prefers coffee', category: 'preference', confidence: 0.6, tags: ['coffee'] }
            ]),
            role: 'assistant'
        });

        const result = await service.extractAndStageFromMessage('I prefer drinking coffee in the morning instead of tea.', 'msg-1');

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('User prefers coffee');
        expect(mockDb.savePendingMemory).toHaveBeenCalled();
    });

    it('should remember explicit facts with high confidence', async () => {
        const memory = await service.rememberExplicit('My birthday is May 1st', 'msg-2');

        expect(memory.content).toBe('My birthday is May 1st');
        expect(memory.confidence).toBe(1.0);
        expect(memory.importance).toBe(0.9);
        expect(mockDb.storeAdvancedMemory).toHaveBeenCalled();
    });

    it('should confirm a pending memory and store it', async () => {
        mockLlm.chat.mockResolvedValue({
            content: JSON.stringify([{ content: 'Fact A', category: 'fact', confidence: 0.6, tags: [] }]),
            role: 'assistant'
        });
        const pending = await service.extractAndStageFromMessage('Note that Fact A is definitely true.', 'msg-3');
        expect(pending).toHaveLength(1);
        const pendingId = pending[0].id;

        // Confirm it
        const confirmed = await service.confirmPendingMemory(pendingId, 'user');

        expect(confirmed).toBeDefined();
        expect(confirmed?.content).toBe('Fact A');
        expect(mockDb.storeAdvancedMemory).toHaveBeenCalled();
        expect(mockDb.deletePendingMemory).toHaveBeenCalledWith(pendingId);
    });

    it('should reject a pending memory and remove it from staging', async () => {
        mockLlm.chat.mockResolvedValue({
            content: JSON.stringify([{ content: 'Fact B', category: 'fact', confidence: 0.6, tags: [] }]),
            role: 'assistant'
        });
        const pending = await service.extractAndStageFromMessage('I want you to remember that Fact B is potentially true.', 'msg-4');
        expect(pending).toHaveLength(1);
        const pendingId = pending[0].id;

        await service.rejectPendingMemory(pendingId, 'not true');

        expect(mockDb.deletePendingMemory).toHaveBeenCalledWith(pendingId);
    });
});

