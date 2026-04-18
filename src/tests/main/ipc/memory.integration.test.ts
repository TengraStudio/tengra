/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Import module under test
import { registerMemoryIpc } from '@main/ipc/memory';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIpcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

// Mock memory service
const mockMemoryService = {
    getAllMemories: vi.fn(),
    forgetFact: vi.fn(),
    removeEntityFact: vi.fn(),
    rememberFact: vi.fn(),
    setEntityFact: vi.fn(),
    recallRelevantFacts: vi.fn(),
    recallEpisodes: vi.fn(),
};

// Mock electron
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: TestValue[]) => TestValue | Promise<TestValue>) => {
            mockIpcMainHandlers.set(channel, async (...args: TestValue[]) => Promise.resolve(handler(...args)));
        }),
        removeHandler: vi.fn((channel: string) => {
            mockIpcMainHandlers.delete(channel);
        }),
    },
}));

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock IPC wrapper

describe('Memory IPC Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();
        
        // Register handlers
        registerMemoryIpc(() => null, mockMemoryService as never);
    });

    describe('memory:getAll', () => {
        it('should get all memories (facts, episodes, entities)', async () => {
            const mockMemories = {
                facts: [{ id: '1', content: 'Fact 1' }],
                episodes: [{ id: '2', content: 'Episode 1' }],
                entities: [{ id: '3', name: 'Entity 1' }],
            };
            mockMemoryService.getAllMemories.mockResolvedValue(mockMemories);
            
            const handler = mockIpcMainHandlers.get('memory:getAll');
            expect(handler).toBeDefined();
            
            const result = await handler!({});
            
            expect(mockMemoryService.getAllMemories).toHaveBeenCalled();
            expect(result).toEqual(mockMemories);
        });

        it('should return empty arrays on error', async () => {
            mockMemoryService.getAllMemories.mockRejectedValue(new Error('Database error'));
            
            const handler = mockIpcMainHandlers.get('memory:getAll');
            const result = await handler!({});
            
            expect(result).toEqual({
                facts: [],
                episodes: [],
                entities: [],
            });
        });
    });

    describe('memory:addFact', () => {
        it('should add fact with valid content and tags', async () => {
            const mockFragment = { id: 'fact-123', content: 'New fact' };
            mockMemoryService.rememberFact.mockResolvedValue(mockFragment);
            
            const handler = mockIpcMainHandlers.get('memory:addFact');
            expect(handler).toBeDefined();
            
            const result = await handler!({}, 'New fact', ['tag1', 'tag2']);
            
            expect(mockMemoryService.rememberFact).toHaveBeenCalledWith(
                'New fact',
                'manual',
                'user-added',
                ['tag1', 'tag2']
            );
            expect(result).toEqual({ success: true, id: 'fact-123' });
        });

        it('should reject invalid content', async () => {
            const handler = mockIpcMainHandlers.get('memory:addFact');
            
            const result1 = await handler!({}, '', []);
            const result2 = await handler!({}, 123, []);
            const result3 = await handler!({}, 'a'.repeat(20000), []);
            
            expect(result1).toEqual({ success: false, id: '' });
            expect(result2).toEqual({ success: false, id: '' });
            expect(result3).toEqual({ success: false, id: '' });
            expect(mockMemoryService.rememberFact).not.toHaveBeenCalled();
        });

        it('should sanitize tags array', async () => {
            mockMemoryService.rememberFact.mockResolvedValue({ id: '1' });
            
            const handler = mockIpcMainHandlers.get('memory:addFact');
            await handler!({}, 'Test fact', ['valid', '', '  whitespace  ', 123, 'another']);
            
            const calledTags = mockMemoryService.rememberFact.mock.calls[0][3];
            expect(calledTags).toEqual(expect.arrayContaining(['valid', 'whitespace', 'another']));
            expect(calledTags).not.toContain('');
            expect(calledTags).not.toContain(123);
        });

        it('should limit tags to maximum count (20)', async () => {
            mockMemoryService.rememberFact.mockResolvedValue({ id: '1' });
            
            const handler = mockIpcMainHandlers.get('memory:addFact');
            const manyTags = Array.from({ length: 30 }, (_, i) => `tag${i}`);
            
            await handler!({}, 'Test fact', manyTags);
            
            const calledTags = mockMemoryService.rememberFact.mock.calls[0][3];
            expect(calledTags.length).toBeLessThanOrEqual(20);
        });
    });

    describe('memory:deleteFact', () => {
        it('should delete fact by valid ID', async () => {
            mockMemoryService.forgetFact.mockResolvedValue(true);
            
            const handler = mockIpcMainHandlers.get('memory:deleteFact');
            expect(handler).toBeDefined();
            
            const result = await handler!({}, 'fact-123');
            
            expect(mockMemoryService.forgetFact).toHaveBeenCalledWith('fact-123');
            expect(result).toEqual({ success: true });
        });

        it('should return failure for invalid ID', async () => {
            const handler = mockIpcMainHandlers.get('memory:deleteFact');
            
            const result1 = await handler!({}, '');
            const result2 = await handler!({}, 123);
            const result3 = await handler!({}, 'a'.repeat(200));
            
            expect(result1).toEqual({ success: false });
            expect(result2).toEqual({ success: false });
            expect(result3).toEqual({ success: false });
            expect(mockMemoryService.forgetFact).not.toHaveBeenCalled();
        });

        it('should trim ID before deletion', async () => {
            mockMemoryService.forgetFact.mockResolvedValue(true);
            
            const handler = mockIpcMainHandlers.get('memory:deleteFact');
            await handler!({}, '  fact-123  ');
            
            expect(mockMemoryService.forgetFact).toHaveBeenCalledWith('fact-123');
        });
    });

    describe('memory:deleteEntity', () => {
        it('should delete entity by valid ID', async () => {
            mockMemoryService.removeEntityFact.mockResolvedValue(true);
            
            const handler = mockIpcMainHandlers.get('memory:deleteEntity');
            expect(handler).toBeDefined();
            
            const result = await handler!({}, 'entity-456');
            
            expect(mockMemoryService.removeEntityFact).toHaveBeenCalledWith('entity-456');
            expect(result).toEqual({ success: true });
        });

        it('should return failure for invalid ID', async () => {
            const handler = mockIpcMainHandlers.get('memory:deleteEntity');
            
            const result = await handler!({}, '');
            
            expect(result).toEqual({ success: false });
            expect(mockMemoryService.removeEntityFact).not.toHaveBeenCalled();
        });
    });

    describe('memory:setEntityFact', () => {
        it('should set entity fact with valid parameters', async () => {
            const mockKnowledge = { id: 'knowledge-789' };
            mockMemoryService.setEntityFact.mockResolvedValue(mockKnowledge);
            
            const handler = mockIpcMainHandlers.get('memory:setEntityFact');
            expect(handler).toBeDefined();
            
            const result = await handler!({}, 'person', 'John Doe', 'occupation', 'Engineer');
            
            expect(mockMemoryService.setEntityFact).toHaveBeenCalledWith(
                'person',
                'John Doe',
                'occupation',
                'Engineer'
            );
            expect(result).toEqual({ success: true, id: 'knowledge-789' });
        });

        it('should reject invalid parameters', async () => {
            const handler = mockIpcMainHandlers.get('memory:setEntityFact');
            
            const result1 = await handler!({}, '', 'John', 'key', 'value');
            const result2 = await handler!({}, 'person', '', 'key', 'value');
            const result3 = await handler!({}, 'person', 'John', '', 'value');
            const result4 = await handler!({}, 'person', 'John', 'key', '');
            
            expect(result1).toEqual({ success: false, id: '' });
            expect(result2).toEqual({ success: false, id: '' });
            expect(result3).toEqual({ success: false, id: '' });
            expect(result4).toEqual({ success: false, id: '' });
            expect(mockMemoryService.setEntityFact).not.toHaveBeenCalled();
        });

        it('should trim all parameters', async () => {
            mockMemoryService.setEntityFact.mockResolvedValue({ id: '1' });
            
            const handler = mockIpcMainHandlers.get('memory:setEntityFact');
            await handler!({}, '  person  ', '  John  ', '  key  ', '  value  ');
            
            expect(mockMemoryService.setEntityFact).toHaveBeenCalledWith(
                'person',
                'John',
                'key',
                'value'
            );
        });
    });

    describe('memory:search', () => {
        it('should search memories with valid query', async () => {
            const mockFacts = [{ id: '1', content: 'Fact about search' }];
            const mockEpisodes = [{ id: '2', content: 'Episode about search' }];
            mockMemoryService.recallRelevantFacts.mockResolvedValue(mockFacts);
            mockMemoryService.recallEpisodes.mockResolvedValue(mockEpisodes);
            
            const handler = mockIpcMainHandlers.get('memory:search');
            expect(handler).toBeDefined();
            
            const result = await handler!({}, 'search term');
            
            expect(mockMemoryService.recallRelevantFacts).toHaveBeenCalledWith('search term', 10);
            expect(mockMemoryService.recallEpisodes).toHaveBeenCalledWith('search term', 5);
            expect(result).toEqual({
                facts: mockFacts,
                episodes: mockEpisodes,
            });
        });

        it('should return empty arrays for invalid query', async () => {
            const handler = mockIpcMainHandlers.get('memory:search');
            
            const result1 = await handler!({}, '');
            const result2 = await handler!({}, 'a'.repeat(2000));
            const result3 = await handler!({}, 123);
            
            expect(result1).toEqual({ facts: [], episodes: [] });
            expect(result2).toEqual({ facts: [], episodes: [] });
            expect(result3).toEqual({ facts: [], episodes: [] });
            expect(mockMemoryService.recallRelevantFacts).not.toHaveBeenCalled();
        });

        it('should trim query before search', async () => {
            mockMemoryService.recallRelevantFacts.mockResolvedValue([]);
            mockMemoryService.recallEpisodes.mockResolvedValue([]);
            
            const handler = mockIpcMainHandlers.get('memory:search');
            await handler!({}, '  search term  ');
            
            expect(mockMemoryService.recallRelevantFacts).toHaveBeenCalledWith('search term', 10);
            expect(mockMemoryService.recallEpisodes).toHaveBeenCalledWith('search term', 5);
        });
    });
});

