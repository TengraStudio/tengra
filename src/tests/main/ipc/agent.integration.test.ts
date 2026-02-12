import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
const mockIpcMainHandlers = new Map<string, (...args: any[]) => any>();
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
            mockIpcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn((channel: string) => {
            mockIpcMainHandlers.delete(channel);
        }),
    },
}));

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock IPC wrapper
vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createSafeIpcHandler: (_name: string, handler: (...args: any[]) => any, fallback: any) => async (...args: any[]) => {
        try {
            const result = await handler(...args);
            return result;
        } catch {
            return fallback;
        }
    },
}));

// Mock sanitize util
vi.mock('@shared/utils/sanitize.util', () => ({
    safeJsonParse: vi.fn((jsonString: string, fallback: any) => {
        try {
            return JSON.parse(jsonString);
        } catch {
            return fallback;
        }
    }),
}));

// Mock AgentService
vi.mock('@main/services/llm/agent.service', () => ({
    AgentService: vi.fn(),
}));

// Import the module under test AFTER mocks
import { registerAgentIpc } from '@main/ipc/agent';

describe('Agent IPC Integration', () => {
    let mockAgentService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();

        mockAgentService = {
            getAllAgents: vi.fn(),
            getAgent: vi.fn(),
        };

        registerAgentIpc(mockAgentService);
    });

    it('should register expected handlers', () => {
        expect(mockIpcMainHandlers.has('agent:get-all')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:get')).toBe(true);
        expect(mockIpcMainHandlers.size).toBe(2);
    });

    describe('agent:get-all', () => {
        it('should return all agents', async () => {
            const mockAgents = [
                { id: 'agent-1', name: 'Assistant', model: 'gpt-4' },
                { id: 'agent-2', name: 'Coder', model: 'claude-3' },
            ];
            vi.mocked(mockAgentService.getAllAgents).mockResolvedValue(mockAgents);

            const handler = mockIpcMainHandlers.get('agent:get-all');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(mockAgentService.getAllAgents).toHaveBeenCalled();
            expect(result).toEqual(mockAgents);
        });

        it('should return empty array when no agents', async () => {
            vi.mocked(mockAgentService.getAllAgents).mockResolvedValue([]);

            const handler = mockIpcMainHandlers.get('agent:get-all');
            const result = await handler!({});

            expect(result).toEqual([]);
        });

        it('should return empty array on service error', async () => {
            vi.mocked(mockAgentService.getAllAgents).mockRejectedValue(new Error('Database error'));

            const handler = mockIpcMainHandlers.get('agent:get-all');
            const result = await handler!({});

            expect(result).toEqual([]);
        });

        it('should serialize agents to JSON safely', async () => {
            const mockAgents = [
                { id: 'agent-1', name: 'Test', config: { temperature: 0.7 } },
            ];
            vi.mocked(mockAgentService.getAllAgents).mockResolvedValue(mockAgents);

            const handler = mockIpcMainHandlers.get('agent:get-all');
            const result = await handler!({});

            // Result should be JSON-serializable
            expect(JSON.stringify(result)).toBeTruthy();
        });
    });

    describe('agent:get', () => {
        it('should return agent by ID', async () => {
            const mockAgent = { id: 'agent-1', name: 'Assistant', model: 'gpt-4', config: {} };
            vi.mocked(mockAgentService.getAgent).mockResolvedValue(mockAgent);

            const handler = mockIpcMainHandlers.get('agent:get');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'agent-1');

            expect(mockAgentService.getAgent).toHaveBeenCalledWith('agent-1');
            expect(result).toEqual(mockAgent);
        });

        it('should return null for nonexistent agent', async () => {
            vi.mocked(mockAgentService.getAgent).mockResolvedValue(null);

            const handler = mockIpcMainHandlers.get('agent:get');
            const result = await handler!({}, 'nonexistent-id');

            expect(result).toBe(null);
        });

        it('should return null on service error', async () => {
            vi.mocked(mockAgentService.getAgent).mockRejectedValue(new Error('Not found'));

            const handler = mockIpcMainHandlers.get('agent:get');
            const result = await handler!({}, 'error-id');

            expect(result).toBe(null);
        });

        it('should handle different ID formats', async () => {
            const handler = mockIpcMainHandlers.get('agent:get');
            vi.mocked(mockAgentService.getAgent).mockResolvedValue({ id: 'test', name: 'Test' });

            await handler!({}, 'simple-id');
            expect(mockAgentService.getAgent).toHaveBeenCalledWith('simple-id');

            await handler!({}, 'uuid-1234-5678-90ab');
            expect(mockAgentService.getAgent).toHaveBeenCalledWith('uuid-1234-5678-90ab');

            await handler!({}, '12345');
            expect(mockAgentService.getAgent).toHaveBeenCalledWith('12345');
        });
    });
});
