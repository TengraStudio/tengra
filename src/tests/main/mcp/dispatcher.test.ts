/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

type TestValue = string | number | boolean | string[] | any[];

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
                { id: 'git', name: 'git', description: 'Git operations', source: 'core' as const, actions: [{ name: 'status', description: 'Get status' }], isAlive: true },
                { id: 'docker', name: 'docker', description: 'Docker ops', source: 'core' as const, actions: [], isAlive: true }
            ];
            pluginService = createMockPluginService({
                listPlugins: vi.fn().mockResolvedValue(mockPlugins)
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const result = await dispatcher.listServices();

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                id: 'git',
                name: 'git',
                description: 'Git operations',
                source: 'core',
                permissionProfile: undefined,
                permissions: undefined,
                isEnabled: true,
                isAlive: true,
                actions: [{ name: 'status', description: 'Get status' }],
                version: undefined
            });
        });

        it('should mark disabled servers correctly', async () => {
            settingsService = createMockSettingsService({ mcpDisabledServers: ['docker'] });
            const mockPlugins = [
                { id: 'git', name: 'git', description: 'Git', source: 'core' as const, actions: [], isAlive: true },
                { id: 'docker', name: 'docker', description: 'Docker', source: 'core' as const, actions: [], isAlive: true }
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
    });

    describe('getToolDefinitions', () => {
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
            expect(tools[1].function.name).toBe('mcp__git__log');
        });

        it('should only expose tools allowed by granular permissions', async () => {
            const mockPlugins = [{
                name: 'terminal',
                description: 'Terminal operations',
                source: 'external' as const,
                permissions: ['read'] as const,
                actions: [
                    { name: 'list_sessions', description: 'List sessions' },
                    { name: 'run_command', description: 'Run command' }
                ]
            }];
            pluginService = createMockPluginService({
                listPlugins: vi.fn().mockResolvedValue(mockPlugins)
            });
            dispatcher = new McpDispatcher(new Set<string>(), settingsService, pluginService);

            const tools = await dispatcher.getToolDefinitions();

            expect(tools.map(tool => tool.function.name)).toEqual(['mcp__terminal__list_sessions']);
        });
    });

    describe('permission management (obsolete)', () => {
        it('should return empty for getPermissionRequests (now handled by settings)', async () => {
            const result = await dispatcher.getPermissionRequests();
            expect(result).toEqual([]);
        });

        it('should return success for setActionPermission (compatibility mode)', async () => {
            const result = await dispatcher.setActionPermission('git', 'delete', 'deny');
            expect(result.success).toBe(true);
        });

        it('should return success for resolvePermissionRequest (compatibility mode)', async () => {
            const result = await dispatcher.resolvePermissionRequest('req-1', 'approved');
            expect(result.success).toBe(true);
        });
    });

    describe('install/uninstall', () => {
        it('should delegate install to pluginService', async () => {
            const result = await dispatcher.installService({
                name: 'my-plugin',
                command: 'node',
                args: []
            });
            expect(result.success).toBe(true);
            expect(pluginService.registerPlugin).toHaveBeenCalled();
        });

        it('should delegate uninstall to pluginService', async () => {
            const result = await dispatcher.uninstallService('my-plugin');
            expect(result.success).toBe(true);
            expect(pluginService.unregisterPlugin).toHaveBeenCalledWith('my-plugin');
        });
    });
});
