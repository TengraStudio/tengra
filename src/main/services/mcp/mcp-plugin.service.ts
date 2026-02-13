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
    private dispatchMetrics = new Map<string, { count: number; errors: number; totalDurationMs: number; lastDurationMs: number; lastError?: string }>();

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

    getDispatchMetrics() {
        return Array.from(this.dispatchMetrics.entries()).map(([key, value]) => ({
            key,
            count: value.count,
            errors: value.errors,
            avgDurationMs: value.count > 0 ? value.totalDurationMs / value.count : 0,
            lastDurationMs: value.lastDurationMs,
            lastError: value.lastError
        }));
    }

    private updateDispatchMetrics(
        pluginName: string,
        actionName: string,
        durationMs: number,
        error?: string
    ): void {
        const key = `${pluginName}:${actionName}`;
        const current = this.dispatchMetrics.get(key) ?? {
            count: 0,
            errors: 0,
            totalDurationMs: 0,
            lastDurationMs: 0,
            lastError: undefined
        };

        current.count += 1;
        current.totalDurationMs += durationMs;
        current.lastDurationMs = durationMs;
        if (error) {
            current.errors += 1;
            current.lastError = error;
        }
        this.dispatchMetrics.set(key, current);
    }

    private permissionKey(pluginName: string, actionName: string): string {
        return `${pluginName}:${actionName}`;
    }

    private isSensitiveAction(actionName: string): boolean {
        const normalized = actionName.toLowerCase();
        return (
            normalized.includes('delete') ||
            normalized.includes('remove') ||
            normalized.includes('write') ||
            normalized.includes('install') ||
            normalized.includes('uninstall') ||
            normalized.includes('exec')
        );
    }

    async listPermissionRequests() {
        const settings = this.settingsService.getSettings();
        return settings.mcpPermissionRequests ?? [];
    }

    async setActionPermission(service: string, action: string, policy: 'allow' | 'deny' | 'ask') {
        const settings = this.settingsService.getSettings();
        const current = settings.mcpActionPermissions ?? {};
        const updated = { ...current, [this.permissionKey(service, action)]: policy };
        await this.settingsService.saveSettings({ mcpActionPermissions: updated });
        return { success: true };
    }

    async resolvePermissionRequest(
        requestId: string,
        decision: 'approved' | 'denied'
    ) {
        const settings = this.settingsService.getSettings();
        const requests = settings.mcpPermissionRequests ?? [];
        const req = requests.find(r => r.id === requestId);
        if (!req) {
            return { success: false, error: 'Permission request not found' };
        }

        const nextRequests = requests.map(r => r.id === requestId ? { ...r, status: decision } : r);
        const permission = decision === 'approved' ? 'allow' : 'deny';
        const currentPermissions = settings.mcpActionPermissions ?? {};
        currentPermissions[this.permissionKey(req.service, req.action)] = permission;

        await this.settingsService.saveSettings({
            mcpPermissionRequests: nextRequests,
            mcpActionPermissions: currentPermissions
        });

        return { success: true };
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

        const permissionKey = this.permissionKey(pluginName, actionName);
        const permissionPolicy = settings.mcpActionPermissions?.[permissionKey] ?? 'ask';
        const requiresReview = settings.mcpReviewPolicy === 'elevated' && this.isSensitiveAction(actionName);

        if (requiresReview && permissionPolicy === 'deny') {
            return { success: false, error: `Permission denied for action '${actionName}'` };
        }

        if (requiresReview && permissionPolicy === 'ask') {
            const requests = settings.mcpPermissionRequests ?? [];
            const existingPending = requests.find(
                r => r.service === pluginName && r.action === actionName && r.status === 'pending'
            );
            if (!existingPending) {
                const request = {
                    id: `mcp-perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    service: pluginName,
                    action: actionName,
                    createdAt: Date.now(),
                    argsPreview: JSON.stringify(args).slice(0, 240),
                    status: 'pending' as const
                };
                await this.settingsService.saveSettings({ mcpPermissionRequests: [...requests, request] });
            }
            return {
                success: false,
                error: `Permission required for '${pluginName}:${actionName}'. Approve it in MCP settings.`
            };
        }

        const startedAt = Date.now();
        try {
            const result = await plugin.dispatch(actionName, args);
            const duration = Date.now() - startedAt;
            this.updateDispatchMetrics(pluginName, actionName, duration);
            this.logDebug(`MCP dispatch success ${pluginName}:${actionName} (${duration}ms)`);
            return result;
        } catch (error) {
            const duration = Date.now() - startedAt;
            const message = error instanceof Error ? error.message : String(error);
            this.updateDispatchMetrics(pluginName, actionName, duration, message);
            this.logError(`Failed to dispatch action ${actionName} to ${pluginName}`, error);
            return { success: false, error: message };
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
