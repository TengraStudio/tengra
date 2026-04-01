import { appLogger } from '@main/logging/logger';
import { McpDispatchResult } from '@main/mcp/types';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { SettingsService } from '@main/services/system/settings.service';
import { ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';

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

        return plugins.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            source: p.source,
            isEnabled: !disabled.includes(p.name),
            isAlive: p.isAlive,
            actions: p.actions
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
            for (const action of plugin.actions) {
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

    async getPermissionRequests() {
        if (!this.pluginService) {
            return [];
        }
        return this.pluginService.listPermissionRequests();
    }

    async setActionPermission(service: string, action: string, policy: 'allow' | 'deny' | 'ask') {
        if (!this.pluginService) {
            return { success: false, error: 'MCP Plugin Service not initialized' };
        }
        return this.pluginService.setActionPermission(service, action, policy);
    }

    async resolvePermissionRequest(requestId: string, decision: 'approved' | 'denied') {
        if (!this.pluginService) {
            return { success: false, error: 'MCP Plugin Service not initialized' };
        }
        return this.pluginService.resolvePermissionRequest(requestId, decision);
    }

    async installService(config: { name: string; description?: string; command: string; args: string[]; env?: Record<string, string> }) {
        if (!this.pluginService) {
            return { success: false };
        }
        try {
            await this.pluginService.registerPlugin(config.name, config.description ?? '', config.command, config.args, config.env);
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
