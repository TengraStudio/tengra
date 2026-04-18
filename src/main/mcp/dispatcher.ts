/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { McpDispatchResult } from '@main/mcp/types';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { SettingsService } from '@main/services/system/settings.service';
import { ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { MCPServerConfig, McpPermission } from '@shared/types/settings';

type McpInstallConfig = Omit<MCPServerConfig, 'id'> & { id?: string };

function getActionPermissionCategory(actionName: string): McpPermission {
    const normalized = actionName.toLowerCase();

    if (
        normalized.includes('delete') ||
        normalized.includes('remove') ||
        normalized.includes('uninstall') ||
        normalized.includes('purge') ||
        normalized.includes('format') ||
        normalized.includes('drop') ||
        normalized.includes('terminate') ||
        normalized.includes('kill')
    ) {
        return 'delete';
    }

    if (
        normalized.includes('exec') ||
        normalized.includes('run') ||
        normalized.includes('shell') ||
        normalized.includes('terminal') ||
        normalized.includes('command')
    ) {
        return 'execute';
    }

    if (
        normalized.includes('write') ||
        normalized.includes('create') ||
        normalized.includes('update') ||
        normalized.includes('edit') ||
        normalized.includes('patch') ||
        normalized.includes('save') ||
        normalized.includes('install') ||
        normalized.includes('append') ||
        normalized.includes('add') ||
        normalized.includes('commit') ||
        normalized.includes('push') ||
        normalized.includes('pull') ||
        normalized.includes('checkout')
    ) {
        return 'write';
    }

    if (
        normalized.includes('http') ||
        normalized.includes('fetch') ||
        normalized.includes('curl') ||
        normalized.includes('search') ||
        normalized.includes('lookup') ||
        normalized.includes('network') ||
        normalized.includes('cloud') ||
        (normalized.includes('api') && !normalized.includes('local')) ||
        normalized.includes('browsing') ||
        normalized.includes('scrape') ||
        normalized.includes('crawl') ||
        normalized.includes('download') ||
        normalized.includes('weather') ||
        normalized.includes('ping') ||
        normalized.includes('traceroute') ||
        normalized.includes('whois')
    ) {
        return 'network';
    }

    return 'read';
}

/**
 * McpDispatcher (Legacy Wrapper)
 * This class now acts as a bridge between the old MCP dispatcher interface
 * and the new modular McpPluginService.
 */
export class McpDispatcher {
    constructor(
        // we keep the services parameter for compatibility, but it's ignored if pluginService is used
        _ignoredServices: Set<string>,
        private settingsService: SettingsService,
        private pluginService?: McpPluginService
    ) { }

    setPluginService(service: McpPluginService) {
        this.pluginService = service;
    }

    async listServices() {
        if (!this.pluginService) {
            return [];
        }
        const plugins = await this.pluginService.listPlugins();
        const settings = this.settingsService.getSettings();
        const disabled = settings.mcpDisabledServers ?? [];
        const userServers = settings.mcpUserServers ?? [];

        return plugins.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            source: p.source,
            permissionProfile: p.permissionProfile,
            permissions: p.permissions,
            isEnabled: !disabled.includes(p.name)
                && (userServers.find(server => server.id === p.id || server.name === p.name)?.enabled ?? true),
            isAlive: p.isAlive,
            actions: p.actions,
            version: (p as { version?: string }).version,
        }));
    }

    async getToolDefinitions(): Promise<ToolDefinition[]> {
        if (!this.pluginService) {
            return [];
        }
        const plugins = await this.pluginService.listPlugins();
        const settings = this.settingsService.getSettings();

        // Get disabled servers from legacy setting
        const disabledServers = settings.mcpDisabledServers ?? [];

        // Get user MCP servers and their enabled status
        const userServers = settings.mcpUserServers ?? [];
        const tools: ToolDefinition[] = [];

        for (const plugin of plugins) {
            // Skip if disabled in legacy setting
            if (disabledServers.includes(plugin.name)) {
                continue;
            }

            // For user servers, check the enabled flag
            const userServer = userServers.find(s => s.id === plugin.name || s.name === plugin.name);
            if (userServer && !userServer.enabled) {
                continue;
            }

            // Core plugins are always enabled, so include their tools
            const allowedPermissions = Array.isArray(plugin.permissions)
                ? plugin.permissions
                : undefined;
            for (const action of plugin.actions) {
                if (allowedPermissions && !allowedPermissions.includes(getActionPermissionCategory(action.name))) {
                    continue;
                }
                const toolName = `mcp__${plugin.name}__${action.name}`;
                tools.push({
                    type: 'function',
                    function: {
                        name: toolName,
                        description: `[MCP: ${plugin.name}] ${action.description}`,
                        parameters: {
                            type: 'object',
                            properties: {},
                            additionalProperties: true
                        }
                    }
                });
            }
        }
        return tools;
    }

    async dispatch(serviceName: string, actionName: string, args: JsonObject): Promise<McpDispatchResult> {
        if (!this.pluginService) {
            return { success: false, error: 'MCP Plugin Service not initialized' };
        }
        return this.pluginService.dispatch(serviceName, actionName, args);
    }

    async getDebugMetrics() {
        if (!this.pluginService) {
            return [];
        }
        return this.pluginService.getDispatchMetrics();
    }

    /**
     * @deprecated Used by old permission center, now using granular system in settings
     */
    async getPermissionRequests() {
        return [];
    }

    /**
     * @deprecated Use MCPServersTab in UI to set granular permissions
     */
    async setActionPermission(_service: string, _action: string, _policy: 'allow' | 'deny' | 'ask') {
        return { success: true };
    }

    /**
     * @deprecated Per-action requests are obsolete
     */
    async resolvePermissionRequest(_requestId: string, _decision: 'approved' | 'denied') {
        return { success: true };
    }

    async installService(config: McpInstallConfig) {
        if (!this.pluginService) {
            return { success: false };
        }
        try {
            await this.pluginService.registerPlugin({
                ...config,
                id: config.id ?? config.name,
            });
            return { success: true };
        } catch (e) {
            appLogger.error('MCP', `Failed to install service ${config.name}`, e as Error);
            return { success: false, error: (e as Error).message };
        }
    }

    async uninstallService(name: string) {
        if (!this.pluginService) {
            return { success: false };
        }
        await this.pluginService.unregisterPlugin(name);
        return { success: true };
    }

    async toggleService(name: string, enabled: boolean) {
        const settings = this.settingsService.getSettings();
        let disabled = [...(settings.mcpDisabledServers ?? [])];

        if (enabled) {
            disabled = disabled.filter(s => s !== name);
        } else {
            if (!disabled.includes(name)) {
                disabled.push(name);
            }
        }

        await this.settingsService.saveSettings({ mcpDisabledServers: disabled });
        return { success: true, isEnabled: enabled };
    }
}
