import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
const mockIpcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();
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

// Mock sanitize util
vi.mock('@shared/utils/sanitize.util', () => ({
    safeJsonParse: vi.fn((jsonString: string, fallback: TestValue) => {
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
    let mockAgentService: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();

        mockAgentService = {
            getAllAgents: vi.fn(),
            getAgent: vi.fn(),
            createAgent: vi.fn(),
            deleteAgent: vi.fn(),
            cloneAgent: vi.fn(),
            exportAgent: vi.fn(),
            importAgent: vi.fn(),
            getAgentTemplatesLibrary: vi.fn(),
            validateAgentTemplate: vi.fn(),
            recoverAgentFromArchive: vi.fn(),
        };

        registerAgentIpc(() => null, mockAgentService as never as Parameters<typeof registerAgentIpc>[1]);
    });

    it('should register expected handlers', () => {
        expect(mockIpcMainHandlers.has('agent:get-all')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:get')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:create')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:delete')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:clone')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:export')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:import')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:get-templates-library')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:validate-template')).toBe(true);
        expect(mockIpcMainHandlers.has('agent:recover')).toBe(true);
        expect(mockIpcMainHandlers.size).toBe(10);
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
            expect(result).toEqual({ success: true, data: mockAgents });
        });

        it('should return empty array when no agents', async () => {
            vi.mocked(mockAgentService.getAllAgents).mockResolvedValue([]);

            const handler = mockIpcMainHandlers.get('agent:get-all');
            const result = await handler!({});

            expect(result).toEqual({ success: true, data: [] });
        });

        it('should return empty array on service error', async () => {
            vi.mocked(mockAgentService.getAllAgents).mockRejectedValue(new Error('Database error'));

            const handler = mockIpcMainHandlers.get('agent:get-all');
            const result = await handler!({});

            expect(result).toEqual({ success: true, data: [] });
        });

        it('should serialize agents to JSON safely', async () => {
            const mockAgents = [
                { id: 'agent-1', name: 'Test', config: { temperature: 0.7 } },
            ];
            vi.mocked(mockAgentService.getAllAgents).mockResolvedValue(mockAgents);

            const handler = mockIpcMainHandlers.get('agent:get-all');
            const result = await handler!({}) as { success: boolean; data: TestValue };

            // Result should be JSON-serializable
            expect(JSON.stringify(result.data)).toBeTruthy();
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
            expect(result).toEqual({ success: true, data: mockAgent });
        });

        it('should return null for nonexistent agent', async () => {
            vi.mocked(mockAgentService.getAgent).mockResolvedValue(null);

            const handler = mockIpcMainHandlers.get('agent:get');
            const result = await handler!({}, 'nonexistent-id');

            expect(result).toEqual({ success: true, data: null });
        });

        it('should return null on service error', async () => {
            vi.mocked(mockAgentService.getAgent).mockRejectedValue(new Error('Not found'));

            const handler = mockIpcMainHandlers.get('agent:get');
            const result = await handler!({}, 'error-id');

            expect(result).toEqual({ success: true, data: null });
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

    describe('agent:create', () => {
        it('should call service createAgent with parsed payload', async () => {
            vi.mocked(mockAgentService.createAgent).mockResolvedValue({
                success: true,
                id: 'agent-1',
                workspacePath: '/tmp/workspace',
            });
            const handler = mockIpcMainHandlers.get('agent:create');
            const payload = {
                agent: {
                    name: 'CustomAgent',
                    description: 'test',
                    systemPrompt: 'This is a custom prompt',
                    tools: ['code_search'],
                    parentModel: 'gpt-4o',
                },
                options: { createWorkspace: true },
            };

            const result = await handler!({}, payload);

            expect(mockAgentService.createAgent).toHaveBeenCalledWith({
                name: 'CustomAgent',
                description: 'test',
                systemPrompt: 'This is a custom prompt',
                tools: ['code_search'],
                parentModel: 'gpt-4o',
                id: undefined,
                color: undefined,
            }, { createWorkspace: true });
            expect(result).toEqual({
                success: true,
                data: {
                    success: true,
                    id: 'agent-1',
                    workspacePath: '/tmp/workspace',
                }
            });
        });
    });

    describe('agent:delete', () => {
        it('should call service deleteAgent with options', async () => {
            vi.mocked(mockAgentService.deleteAgent).mockResolvedValue({
                success: true,
                archivedId: 'archive-1',
                recoveryToken: 'recover_1',
            });
            const handler = mockIpcMainHandlers.get('agent:delete');

            const result = await handler!({}, 'agent-1', { confirm: true, softDelete: true });

            expect(mockAgentService.deleteAgent).toHaveBeenCalledWith('agent-1', { confirm: true, softDelete: true });
            expect(result).toEqual({
                success: true,
                data: {
                    success: true,
                    archivedId: 'archive-1',
                    recoveryToken: 'recover_1',
                }
            });
        });
    });
});

