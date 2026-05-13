/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'crypto';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { McpDispatchResult } from '@main/mcp/types';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { SettingsService } from '@main/services/system/settings.service';
import { MCP_CHANNELS, MCP_PERMISSIONS_CHANNELS } from '@shared/constants/ipc-channels';
import { ToolDefinition } from '@shared/types/ai/chat';
import { JsonObject } from '@shared/types/common';
import { AppSettings, McpPermission, MCPServerConfig } from '@shared/types/system/settings';

type McpInstallConfig = Omit<MCPServerConfig, 'id'> & { id?: string };
type McpActionPolicy = 'allow' | 'deny' | 'ask';
type McpPermissionRequest = NonNullable<AppSettings['mcpPermissionRequests']>[number];

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
 * McpDispatcherService
 * This class handles IPC requests for MCP operations and acts as a bridge
 * between the renderer and the modular McpPluginService.
 */
export class McpDispatcherService {
    static readonly serviceName = 'mcpDispatcherService';
    static readonly dependencies = ['settingsService', 'pluginService'] as const;
    constructor(
        private settingsService: SettingsService,
        private pluginService: McpPluginService
    ) { }

    @ipc(MCP_CHANNELS.LIST)
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
                if (this.getExplicitActionPermission(settings, plugin.name, action.name) === 'deny') {
                    continue;
                }
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

    @ipc(MCP_CHANNELS.DISPATCH)
    async handleDispatch(serviceName: string, actionName: string, args: JsonObject) {
        const result = await this.dispatch(serviceName, actionName, args);
        return result;
    }

    async dispatch(serviceName: string, actionName: string, args: JsonObject): Promise<McpDispatchResult> {
        if (!this.pluginService) {
            return { success: false, error: 'MCP Plugin Service not initialized' };
        }
        const permission = await this.checkActionPermission(serviceName, actionName, args);
        if (!permission.allowed) {
            return {
                success: false,
                service: serviceName,
                action: actionName,
                error: permission.error
            };
        }
        return this.pluginService.dispatch(serviceName, actionName, args);
    }

    @ipc(MCP_CHANNELS.DEBUG_METRICS)
    async getDebugMetrics() {
        if (!this.pluginService) {
            return [];
        }
        return this.pluginService.getDispatchMetrics();
    }

    @ipc(MCP_PERMISSIONS_CHANNELS.LIST_REQUESTS)
    async getPermissionRequests(): Promise<McpPermissionRequest[]> {
        return this.settingsService.getSettings().mcpPermissionRequests ?? [];
    }

    @ipc(MCP_PERMISSIONS_CHANNELS.SET)
    async setActionPermission(service: string, action: string, policy: McpActionPolicy) {
        const settings = this.settingsService.getSettings();
        const requestStatus: McpPermissionRequest['status'] =
            policy === 'allow' ? 'approved' : policy === 'deny' ? 'denied' : 'pending';
        const pendingRequests = (settings.mcpPermissionRequests ?? []).map(request => {
            if (request.service !== service || request.action !== action || request.status !== 'pending') {
                return request;
            }
            return {
                ...request,
                status: requestStatus
            };
        });

        await this.settingsService.saveSettings({
            mcpActionPermissions: {
                ...(settings.mcpActionPermissions ?? {}),
                [this.getPrimaryPermissionKey(service, action)]: policy
            },
            mcpPermissionRequests: pendingRequests
        });

        return { success: true };
    }

    @ipc(MCP_PERMISSIONS_CHANNELS.RESOLVE_REQUEST)
    async resolvePermissionRequest(requestId: string, decision: 'approved' | 'denied') {
        const settings = this.settingsService.getSettings();
        const requests = settings.mcpPermissionRequests ?? [];
        const request = requests.find(item => item.id === requestId);
        if (!request) {
            return { success: false, error: 'Permission request not found' };
        }

        const nextPolicy: McpActionPolicy = decision === 'approved' ? 'allow' : 'deny';
        await this.settingsService.saveSettings({
            mcpActionPermissions: {
                ...(settings.mcpActionPermissions ?? {}),
                [this.getPrimaryPermissionKey(request.service, request.action)]: nextPolicy
            },
            mcpPermissionRequests: requests.map(item => (
                item.id === requestId
                    ? { ...item, status: decision }
                    : item
            ))
        });

        return { success: true };
    }

    private async checkActionPermission(
        service: string,
        action: string,
        args: JsonObject
    ): Promise<{ allowed: true } | { allowed: false; error: string }> {
        const settings = this.settingsService.getSettings();
        const policy = this.getExplicitActionPermission(settings, service, action);

        if (!policy || policy === 'allow') {
            return { allowed: true };
        }

        if (policy === 'deny') {
            return {
                allowed: false,
                error: `MCP action permission denied for ${service}:${action}`
            };
        }

        await this.ensurePermissionRequest(settings, service, action, args);
        return {
            allowed: false,
            error: `MCP action permission required for ${service}:${action}`
        };
    }

    private async ensurePermissionRequest(
        settings: AppSettings,
        service: string,
        action: string,
        args: JsonObject
    ): Promise<void> {
        const requests = settings.mcpPermissionRequests ?? [];
        const existing = requests.find(request => (
            request.service === service &&
            request.action === action &&
            request.status === 'pending'
        ));

        if (existing) {
            return;
        }

        const nextRequests: McpPermissionRequest[] = [
            ...requests,
            {
                id: randomUUID(),
                service,
                action,
                createdAt: Date.now(),
                argsPreview: this.createArgsPreview(args),
                status: 'pending' as const
            }
        ].slice(-100);

        await this.settingsService.saveSettings({ mcpPermissionRequests: nextRequests });
    }

    private createArgsPreview(args: JsonObject): string {
        try {
            const serialized = JSON.stringify(args);
            return serialized.length > 500 ? `${serialized.slice(0, 497)}...` : serialized;
        } catch {
            return '[unserializable arguments]';
        }
    }

    private getExplicitActionPermission(
        settings: AppSettings,
        service: string,
        action: string
    ): McpActionPolicy | undefined {
        const permissions = settings.mcpActionPermissions ?? {};
        for (const key of this.getPermissionKeys(service, action)) {
            const policy = permissions[key];
            if (policy) {
                return policy;
            }
        }
        return undefined;
    }

    private getPrimaryPermissionKey(service: string, action: string): string {
        return `${service}:${action}`;
    }

    private getPermissionKeys(service: string, action: string): string[] {
        return [
            this.getPrimaryPermissionKey(service, action),
            `${service}.${action}`,
            `mcp__${service}__${action}`
        ];
    }

    @ipc(MCP_CHANNELS.INSTALL)
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

    @ipc(MCP_CHANNELS.UNINSTALL)
    async uninstallService(name: string) {
        if (!this.pluginService) {
            return { success: false };
        }
        await this.pluginService.unregisterPlugin(name);
        return { success: true };
    }

    @ipc(MCP_CHANNELS.TOGGLE)
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

