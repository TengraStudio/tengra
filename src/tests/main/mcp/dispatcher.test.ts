import { McpDispatcher } from '@main/mcp/dispatcher';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

function createMockSettingsService(overrides: Record<string, TestValue> = {}): SettingsService {
    return {
        getSettings: vi.fn(() => ({
            mcpDisabledServers: [],
            mcpUserServers: [],
            ...overrides
        })),
        saveSettings: vi.fn().mockResolvedValue(undefined)
    } as never as SettingsService;
}

function createMockPluginService(overrides: Partial<McpPluginService> = {}): McpPluginService {
    return {
        listPlugins: vi.fn().mockResolvedValue([]),
        dispatch: vi.fn().mockResolvedValue({ success: true, data: 'ok' }),
        getDispatchMetrics: vi.fn().mockReturnValue([]),
        listPermissionRequests: vi.fn().mockResolvedValue([]),
        setActionPermission: vi.fn().mockResolvedValue({ success: true }),
        resolvePermissionRequest: vi.fn().mockResolvedValue({ success: true }),
        registerPlugin: vi.fn().mockResolvedValue({ success: true }),
        unregisterPlugin: vi.fn().mockResolvedValue(undefined),
        ...overrides
    } as never as McpPluginService;
}

describe('McpDispatcher', () => {
    let dispatcher: McpDispatcher;
    let settingsService: SettingsService;
    let pluginService: McpPluginService;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsService = createMockSettingsService();
        pluginService = createMockPluginService();
        dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);
    });

    describe('listServices', () => {
        it('should return empty array when pluginService is not set', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            const result = await noPluginDispatcher.listServices();
            expect(result).toEqual([]);
        });

        it('should list all registered plugins with their enabled status', async () => {
            const mockPlugins = [
                { name: 'git', description: 'Git operations', source: 'core' as const, actions: [{ name: 'status', description: 'Get status' }] },
                { name: 'docker', description: 'Docker ops', source: 'core' as const, actions: [] }
            ];
            pluginService = createMockPluginService({
                listPlugins: vi.fn().mockResolvedValue(mockPlugins)
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const result = await dispatcher.listServices();

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                name: 'git',
                description: 'Git operations',
                source: 'core',
                isEnabled: true,
                actions: [{ name: 'status', description: 'Get status' }]
            });
        });

        it('should mark disabled servers correctly', async () => {
            settingsService = createMockSettingsService({ mcpDisabledServers: ['docker'] });
            const mockPlugins = [
                { name: 'git', description: 'Git', source: 'core' as const, actions: [] },
                { name: 'docker', description: 'Docker', source: 'core' as const, actions: [] }
            ];
            pluginService = createMockPluginService({
                listPlugins: vi.fn().mockResolvedValue(mockPlugins)
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const result = await dispatcher.listServices();

            expect(result.find(s => s.name === 'docker')?.isEnabled).toBe(false);
            expect(result.find(s => s.name === 'git')?.isEnabled).toBe(true);
        });
    });

    describe('dispatch', () => {
        it('should return error when pluginService is not set', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            const result = await noPluginDispatcher.dispatch('git', 'status', {});
            expect(result.success).toBe(false);
            expect(result.error).toContain('not initialized');
        });

        it('should delegate dispatch to pluginService', async () => {
            const expectedResult = { success: true, data: 'branch: main', service: 'git', action: 'status' };
            pluginService = createMockPluginService({
                dispatch: vi.fn().mockResolvedValue(expectedResult)
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const result = await dispatcher.dispatch('git', 'status', { verbose: true });

            expect(pluginService.dispatch).toHaveBeenCalledWith('git', 'status', { verbose: true });
            expect(result).toEqual(expectedResult);
        });

        it('should handle unknown plugin name by delegating to pluginService', async () => {
            pluginService = createMockPluginService({
                dispatch: vi.fn().mockResolvedValue({ success: false, error: "MCP Plugin 'nonexistent' not found." })
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const result = await dispatcher.dispatch('nonexistent', 'action', {});
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should handle plugin errors during dispatch', async () => {
            pluginService = createMockPluginService({
                dispatch: vi.fn().mockResolvedValue({ success: false, error: 'Plugin crashed' })
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const result = await dispatcher.dispatch('git', 'status', {});
            expect(result.success).toBe(false);
            expect(result.error).toBe('Plugin crashed');
        });

        it('should support concurrent dispatch calls', async () => {
            let callCount = 0;
            pluginService = createMockPluginService({
                dispatch: vi.fn().mockImplementation(async (name: string, action: string) => {
                    callCount++;
                    return { success: true, data: `${name}:${action}:${callCount}` };
                })
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const [r1, r2, r3] = await Promise.all([
                dispatcher.dispatch('git', 'status', {}),
                dispatcher.dispatch('docker', 'list', {}),
                dispatcher.dispatch('git', 'log', {})
            ]);

            expect(r1.success).toBe(true);
            expect(r2.success).toBe(true);
            expect(r3.success).toBe(true);
            expect(pluginService.dispatch).toHaveBeenCalledTimes(3);
        });
    });

    describe('getToolDefinitions', () => {
        it('should return empty array when pluginService is not set', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            const result = await noPluginDispatcher.getToolDefinitions();
            expect(result).toEqual([]);
        });

        it('should generate tool definitions with mcp__ prefix', async () => {
            const mockPlugins = [{
                name: 'git',
                description: 'Git operations',
                source: 'core' as const,
                actions: [
                    { name: 'status', description: 'Get git status' },
                    { name: 'log', description: 'Get git log' }
                ]
            }];
            pluginService = createMockPluginService({
                listPlugins: vi.fn().mockResolvedValue(mockPlugins)
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const tools = await dispatcher.getToolDefinitions();

            expect(tools).toHaveLength(2);
            expect(tools[0].function.name).toBe('mcp__git__status');
            expect(tools[0].function.description).toContain('[MCP: git]');
            expect(tools[1].function.name).toBe('mcp__git__log');
        });

        it('should skip disabled servers', async () => {
            settingsService = createMockSettingsService({ mcpDisabledServers: ['docker'] });
            const mockPlugins = [
                { name: 'git', description: 'Git', source: 'core' as const, actions: [{ name: 'status', description: 'Status' }] },
                { name: 'docker', description: 'Docker', source: 'core' as const, actions: [{ name: 'list', description: 'List' }] }
            ];
            pluginService = createMockPluginService({
                listPlugins: vi.fn().mockResolvedValue(mockPlugins)
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const tools = await dispatcher.getToolDefinitions();

            expect(tools).toHaveLength(1);
            expect(tools[0].function.name).toBe('mcp__git__status');
        });

        it('should skip disabled user servers', async () => {
            settingsService = createMockSettingsService({
                mcpUserServers: [{ id: 'custom', name: 'custom', enabled: false }]
            });
            const mockPlugins = [
                { name: 'custom', description: 'Custom', source: 'user' as const, actions: [{ name: 'run', description: 'Run' }] }
            ];
            pluginService = createMockPluginService({
                listPlugins: vi.fn().mockResolvedValue(mockPlugins)
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const tools = await dispatcher.getToolDefinitions();
            expect(tools).toHaveLength(0);
        });
    });

    describe('installService', () => {
        it('should return error when pluginService is not set', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            const result = await noPluginDispatcher.installService({
                name: 'test', command: 'node', args: ['server.js']
            });
            expect(result.success).toBe(false);
        });

        it('should delegate to pluginService.registerPlugin', async () => {
            const result = await dispatcher.installService({
                name: 'my-plugin',
                description: 'A plugin',
                command: 'node',
                args: ['index.js'],
                env: { API_KEY: '123' }
            });

            expect(result.success).toBe(true);
            expect(pluginService.registerPlugin).toHaveBeenCalledWith({
                id: 'my-plugin',
                name: 'my-plugin',
                description: 'A plugin',
                command: 'node',
                args: ['index.js'],
                env: { API_KEY: '123' }
            });
        });

        it('should handle registration errors', async () => {
            pluginService = createMockPluginService({
                registerPlugin: vi.fn().mockRejectedValue(new Error('Already exists'))
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const result = await dispatcher.installService({
                name: 'dup', command: 'node', args: []
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Already exists');
        });
    });

    describe('uninstallService', () => {
        it('should return error when pluginService is not set', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            const result = await noPluginDispatcher.uninstallService('test');
            expect(result.success).toBe(false);
        });

        it('should delegate to pluginService.unregisterPlugin', async () => {
            const result = await dispatcher.uninstallService('my-plugin');
            expect(result.success).toBe(true);
            expect(pluginService.unregisterPlugin).toHaveBeenCalledWith('my-plugin');
        });
    });

    describe('toggleService', () => {
        it('should disable a service by adding to disabled list', async () => {
            const result = await dispatcher.toggleService('git', false);
            expect(result.success).toBe(true);
            expect(result.isEnabled).toBe(false);
            expect(settingsService.saveSettings).toHaveBeenCalledWith({
                mcpDisabledServers: ['git']
            });
        });

        it('should enable a service by removing from disabled list', async () => {
            settingsService = createMockSettingsService({ mcpDisabledServers: ['git', 'docker'] });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const result = await dispatcher.toggleService('git', true);
            expect(result.success).toBe(true);
            expect(result.isEnabled).toBe(true);
            expect(settingsService.saveSettings).toHaveBeenCalledWith({
                mcpDisabledServers: ['docker']
            });
        });

        it('should not duplicate entries when disabling already disabled service', async () => {
            settingsService = createMockSettingsService({ mcpDisabledServers: ['git'] });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            await dispatcher.toggleService('git', false);
            expect(settingsService.saveSettings).toHaveBeenCalledWith({
                mcpDisabledServers: ['git']
            });
        });
    });

    describe('setPluginService', () => {
        it('should allow setting plugin service after construction', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            expect(await noPluginDispatcher.listServices()).toEqual([]);

            noPluginDispatcher.setPluginService(pluginService);
            const mockPlugins = [{ name: 'test', description: 'Test', source: 'core' as const, actions: [] }];
            (pluginService.listPlugins as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlugins);

            const services = await noPluginDispatcher.listServices();
            expect(services).toHaveLength(1);
        });
    });

    describe('getDebugMetrics', () => {
        it('should return empty array when pluginService is not set', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            const result = await noPluginDispatcher.getDebugMetrics();
            expect(result).toEqual([]);
        });

        it('should delegate to pluginService.getDispatchMetrics', async () => {
            const metrics = [{ key: 'git:status', count: 5, errors: 1, avgDurationMs: 100, lastDurationMs: 80 }];
            pluginService = createMockPluginService({
                getDispatchMetrics: vi.fn().mockReturnValue(metrics)
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const result = await dispatcher.getDebugMetrics();
            expect(result).toEqual(metrics);
        });
    });

    describe('permission management', () => {
        it('should return empty when pluginService not set for getPermissionRequests', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            const result = await noPluginDispatcher.getPermissionRequests();
            expect(result).toEqual([]);
        });

        it('should delegate setActionPermission to pluginService', async () => {
            const result = await dispatcher.setActionPermission('git', 'delete', 'deny');
            expect(result.success).toBe(true);
            expect(pluginService.setActionPermission).toHaveBeenCalledWith('git', 'delete', 'deny');
        });

        it('should return error for setActionPermission without pluginService', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            const result = await noPluginDispatcher.setActionPermission('git', 'delete', 'deny');
            expect(result.success).toBe(false);
        });

        it('should delegate resolvePermissionRequest to pluginService', async () => {
            const result = await dispatcher.resolvePermissionRequest('req-1', 'approved');
            expect(result.success).toBe(true);
            expect(pluginService.resolvePermissionRequest).toHaveBeenCalledWith('req-1', 'approved');
        });

        it('should return error for resolvePermissionRequest without pluginService', async () => {
            const noPluginDispatcher = new McpDispatcher(new Set<string>(), settingsService);
            const result = await noPluginDispatcher.resolvePermissionRequest('req-1', 'denied');
            expect(result.success).toBe(false);
        });
    });
});
