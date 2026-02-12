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

// Mock rate limiter
vi.mock('@main/utils/rate-limiter.util', () => ({
    withRateLimit: vi.fn(async (_key: string, fn: () => any) => await fn()),
}));

// Mock ToolExecutor
vi.mock('@main/tools/tool-executor', () => ({
    ToolExecutor: vi.fn(),
}));

// Mock CommandService
vi.mock('@main/services/system/command.service', () => ({
    CommandService: vi.fn(),
}));

// Import the module under test AFTER mocks
import { registerToolsIpc } from '@main/ipc/tools';
import { withRateLimit } from '@main/utils/rate-limiter.util';

describe('Tools IPC Integration', () => {
    let mockToolExecutor: any;
    let mockCommandService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();

        mockToolExecutor = {
            execute: vi.fn(),
            getToolDefinitions: vi.fn(),
        };

        mockCommandService = {
            killCommand: vi.fn(),
        };

        registerToolsIpc(mockToolExecutor, mockCommandService);
    });

    it('should register expected handlers', () => {
        expect(mockIpcMainHandlers.has('tools:execute')).toBe(true);
        expect(mockIpcMainHandlers.has('tools:kill')).toBe(true);
        expect(mockIpcMainHandlers.has('tools:getDefinitions')).toBe(true);
        expect(mockIpcMainHandlers.size).toBe(3);
    });

    describe('tools:execute', () => {
        it('should execute tool with valid arguments', async () => {
            const mockResult = { success: true, output: 'Tool executed' };
            vi.mocked(mockToolExecutor.execute).mockResolvedValue(mockResult);

            const handler = mockIpcMainHandlers.get('tools:execute');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'test-tool', { param: 'value' });

            expect(withRateLimit).toHaveBeenCalledWith('tools', expect.any(Function));
            expect(mockToolExecutor.execute).toHaveBeenCalledWith('test-tool', { param: 'value' });
            expect(result).toEqual(mockResult);
        });

        it('should handle different tool names', async () => {
            const handler = mockIpcMainHandlers.get('tools:execute');

            vi.mocked(mockToolExecutor.execute).mockResolvedValue({ success: true });

            await handler!({}, 'bash', { command: 'ls' });
            expect(mockToolExecutor.execute).toHaveBeenCalledWith('bash', { command: 'ls' });

            await handler!({}, 'read_file', { path: '/test.txt' });
            expect(mockToolExecutor.execute).toHaveBeenCalledWith('read_file', { path: '/test.txt' });

            await handler!({}, 'write_file', { path: '/test.txt', content: 'data' });
            expect(mockToolExecutor.execute).toHaveBeenCalledWith('write_file', { path: '/test.txt', content: 'data' });
        });

        it('should propagate tool execution errors', async () => {
            vi.mocked(mockToolExecutor.execute).mockRejectedValue(new Error('Tool execution failed'));

            const handler = mockIpcMainHandlers.get('tools:execute');

            await expect(handler!({}, 'failing-tool', {})).rejects.toThrow('Tool execution failed');
        });

        it('should apply rate limiting', async () => {
            const handler = mockIpcMainHandlers.get('tools:execute');
            vi.mocked(mockToolExecutor.execute).mockResolvedValue({ success: true });

            await handler!({}, 'test-tool', {});

            expect(withRateLimit).toHaveBeenCalledWith('tools', expect.any(Function));
        });
    });

    describe('tools:kill', () => {
        it('should kill command with valid ID', async () => {
            vi.mocked(mockCommandService.killCommand).mockReturnValue(true);

            const handler = mockIpcMainHandlers.get('tools:kill');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'tool-call-123');

            expect(mockCommandService.killCommand).toHaveBeenCalledWith('tool-call-123');
            expect(result).toBe(true);
        });

        it('should handle kill failure', async () => {
            vi.mocked(mockCommandService.killCommand).mockReturnValue(false);

            const handler = mockIpcMainHandlers.get('tools:kill');
            const result = await handler!({}, 'nonexistent-id');

            expect(result).toBe(false);
        });

        it('should accept different ID formats', async () => {
            const handler = mockIpcMainHandlers.get('tools:kill');
            vi.mocked(mockCommandService.killCommand).mockReturnValue(true);

            await handler!({}, 'simple-id');
            expect(mockCommandService.killCommand).toHaveBeenCalledWith('simple-id');

            await handler!({}, 'uuid-1234-5678-90ab');
            expect(mockCommandService.killCommand).toHaveBeenCalledWith('uuid-1234-5678-90ab');
        });
    });

    describe('tools:getDefinitions', () => {
        it('should return tool definitions', async () => {
            const mockDefinitions = [
                { name: 'bash', description: 'Run bash commands', parameters: {} },
                { name: 'read_file', description: 'Read file contents', parameters: {} },
            ];
            vi.mocked(mockToolExecutor.getToolDefinitions).mockResolvedValue(mockDefinitions);

            const handler = mockIpcMainHandlers.get('tools:getDefinitions');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(mockToolExecutor.getToolDefinitions).toHaveBeenCalled();
            expect(result).toEqual(mockDefinitions);
        });

        it('should return empty array on error', async () => {
            vi.mocked(mockToolExecutor.getToolDefinitions).mockRejectedValue(new Error('Failed to get definitions'));

            const handler = mockIpcMainHandlers.get('tools:getDefinitions');
            const result = await handler!({});

            expect(result).toEqual([]);
        });

        it('should serialize definitions to JSON', async () => {
            const mockDefinitions = [
                { name: 'test', description: 'Test tool', parameters: { type: 'object' } },
            ];
            vi.mocked(mockToolExecutor.getToolDefinitions).mockResolvedValue(mockDefinitions);

            const handler = mockIpcMainHandlers.get('tools:getDefinitions');
            const result = await handler!({});

            // Result should be plain JSON (serializable)
            expect(JSON.stringify(result)).toBeTruthy();
            expect(result).toEqual(mockDefinitions);
        });

        it('should handle empty tool list', async () => {
            vi.mocked(mockToolExecutor.getToolDefinitions).mockResolvedValue([]);

            const handler = mockIpcMainHandlers.get('tools:getDefinitions');
            const result = await handler!({});

            expect(result).toEqual([]);
        });
    });
});
