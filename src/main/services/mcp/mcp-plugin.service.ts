import { ExternalMcpPlugin } from '@main/mcp/external-plugin';
import { IMcpPlugin, InternalMcpPlugin } from '@main/mcp/plugin-base';
import { buildMcpServices } from '@main/mcp/registry';
import { McpDeps } from '@main/mcp/server-utils';
import { McpDispatchResult } from '@main/mcp/types';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject } from '@shared/types/common';

/**
 * McpPluginService manages the lifecycle and dispatching of MCP tool plugins.
 * It supports both internal (TypeScript) and external (standalone process) plugins.
 */
export class McpPluginService extends BaseService {
    private plugins = new Map<string, IMcpPlugin>();

    constructor(
        private settingsService: SettingsService,
        private mcpDeps: McpDeps
    ) {
        super('McpPluginService');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing MCP Plugin Architecture...');

        // 1. Load Built-in Core Plugins (Internal)
        const coreServices = buildMcpServices(this.mcpDeps);
        for (const service of coreServices) {
            const plugin = new InternalMcpPlugin(service);
            this.plugins.set(plugin.name, plugin);
        }

        // 2. Load User Plugins (External)
        const settings = this.settingsService.getSettings();
        const userPlugins = settings.mcpUserServers ?? [];
        for (const config of userPlugins) {
            const plugin = new ExternalMcpPlugin(config.name, config.description ?? '', {
                command: config.command,
                args: config.args,
                env: config.env
            });
            this.plugins.set(plugin.name, plugin);
        }

        this.logInfo(`Loaded ${this.plugins.size} MCP plugins.`);
    }

    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up MCP plugins...');
        for (const plugin of this.plugins.values()) {
            await plugin.dispose();
        }
        this.plugins.clear();
    }

    /**
     * Get all registered plugins
     */
    async listPlugins() {
        const result = [];
        for (const [name, plugin] of this.plugins.entries()) {
            const actions = await plugin.getActions();
            result.push({
                name,
                description: plugin.description,
                source: plugin.source,
                isAlive: plugin.isAlive(),
                actions
            });
        }
        return result;
    }

    /**
     * Dispatch an action to a specific plugin
     */
    async dispatch(pluginName: string, actionName: string, args: JsonObject): Promise<McpDispatchResult> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            return { success: false, error: `MCP Plugin '${pluginName}' not found.` };
        }

        // Check if plugin is enabled (user must explicitly enable MCPs)
        const settings = this.settingsService.getSettings();
        const userServers = settings.mcpUserServers ?? [];
        const serverConfig = userServers.find(s => s.id === pluginName || s.name === pluginName);

        // If it's a user server, check if it's enabled
        if (serverConfig && !serverConfig.enabled) {
            return { success: false, error: `Plugin '${pluginName}' is disabled. Enable it in Settings > MCP.` };
        }

        try {
            return await plugin.dispatch(actionName, args);
        } catch (error) {
            this.logError(`Failed to dispatch action ${actionName} to ${pluginName}`, error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Register a new external plugin
     */
    async registerPlugin(name: string, description: string, command: string, args: string[], env?: Record<string, string>) {
        if (this.plugins.has(name)) {
            throw new Error(`Plugin '${name}' already exists.`);
        }

        const plugin = new ExternalMcpPlugin(name, description, { command, args, env });
        await plugin.initialize();
        this.plugins.set(name, plugin);

        // Update settings persistence
        const settings = this.settingsService.getSettings();
        const userServers = [...(settings.mcpUserServers ?? []), {
            id: name,
            name,
            description,
            command,
            args,
            env,
            enabled: false,
            tools: []
        }];
        await this.settingsService.saveSettings({ mcpUserServers: userServers });

        return { success: true };
    }

    /**
     * Unregister a plugin
     */
    async unregisterPlugin(name: string) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            return;
        }

        await plugin.dispose();
        this.plugins.delete(name);

        const settings = this.settingsService.getSettings();
        const userServers = (settings.mcpUserServers ?? []).filter(s => s.name !== name);
        await this.settingsService.saveSettings({ mcpUserServers: userServers });
    }
}
