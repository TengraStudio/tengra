/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ExternalMcpPlugin } from '@main/mcp/external-plugin';
import { IMcpPlugin, NativeMcpPlugin } from '@main/mcp/plugin-base';
import { McpDeps } from '@main/mcp/server-utils';
import { McpDispatchResult } from '@main/mcp/types';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject } from '@shared/types/common';
import { MCPServerConfig, McpPermission, McpPermissionProfile } from '@shared/types/settings';

const MCP_PLUGIN_MESSAGE_KEY = {
    PERMISSION_REQUEST_NOT_FOUND: 'mainProcess.mcpPlugin.permissionRequestNotFound',
    PLUGIN_NOT_FOUND: 'mainProcess.mcpPlugin.pluginNotFound',
    PLUGIN_DISABLED: 'mainProcess.mcpPlugin.pluginDisabled',
    PERMISSION_DENIED_FOR_ACTION: 'mainProcess.mcpPlugin.permissionDeniedForAction',
    PERMISSION_REQUIRED_FOR_ACTION: 'mainProcess.mcpPlugin.permissionRequiredForAction',
    GRANULAR_PERMISSION_DENIED: 'mainProcess.mcpPlugin.granularPermissionDenied'
} as const;

const MCP_PLUGIN_ERROR_MESSAGE = {
    PERMISSION_REQUEST_NOT_FOUND: 'Permission request not found',
    PLUGIN_NOT_FOUND: 'MCP Plugin \'{{pluginName}}\' not found.',
    PLUGIN_DISABLED: 'Plugin \'{{pluginName}}\' is disabled. Enable it in Settings > MCP.',
    PERMISSION_DENIED_FOR_ACTION: 'Permission denied for action \'{{actionName}}\'',
    PERMISSION_REQUIRED_FOR_ACTION: 'Permission required for \'{{pluginName}}:{{actionName}}\'. Approve it in MCP settings.',
    GRANULAR_PERMISSION_DENIED: 'MCP Server \'{{pluginName}}\' does not have permission for \'{{category}}\' actions (Action: {{actionName}}).'
} as const;

function interpolateMessage(
    template: string,
    params: Record<string, string | number>
): string {
    return Object.entries(params).reduce((message, [key, value]) => {
        return message.replace(`{{${key}}}`, String(value));
    }, template);
}

export class McpPluginService extends BaseService {
    private plugins = new Map<string, IMcpPlugin>();
    private dispatchMetrics = new Map<string, { count: number; errors: number; totalDurationMs: number; lastDurationMs: number; lastError?: string }>();

    constructor(
        private settingsService: SettingsService,
        private mcpDeps: McpDeps
    ) {
        super('McpPluginService');
    }

    private getStorageRootPath(): string {
        const settingsDirectory = path.dirname(this.settingsService.getSettingsPath());
        return path.join(settingsDirectory, 'mcp-storage');
    }

    private resolveServerStoragePath(serverId: string, configuredPath?: string): string {
        const safeServerId = serverId.replace(/[^a-zA-Z0-9-_]/g, '-');
        const storageRoot = this.getStorageRootPath();
        const normalizedConfiguredPath = configuredPath?.replace(/^\.+[\\/]/, '');
        const resolvedPath = normalizedConfiguredPath
            ? path.resolve(storageRoot, normalizedConfiguredPath)
            : path.join(storageRoot, safeServerId);
        const normalizedStorageRoot = path.resolve(storageRoot);
        if (!resolvedPath.startsWith(normalizedStorageRoot)) {
            throw new Error(`Invalid MCP storage path for server: ${serverId}`);
        }
        fs.mkdirSync(resolvedPath, { recursive: true });
        return resolvedPath;
    }

    private buildPluginEnvironment(
        serverConfig: {
            id: string;
            env?: Record<string, string>;
            storage?: { dataPath?: string; quotaMb?: number };
        }
    ): Record<string, string> {
        const storagePath = this.resolveServerStoragePath(serverConfig.id, serverConfig.storage?.dataPath);
        const storageQuotaMb = serverConfig.storage?.quotaMb ?? 256;
        return {
            ...(serverConfig.env ?? {}),
            TENGRA_MCP_STORAGE_PATH: storagePath,
            TENGRA_MCP_STORAGE_QUOTA_MB: String(storageQuotaMb)
        };
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing MCP Plugin Architecture...');

        // 1. Load User Plugins (External)
        const settings = this.settingsService.getSettings();
        const userPlugins = settings.mcpUserServers ?? [];
        for (const config of userPlugins) {
            const plugin = new ExternalMcpPlugin(config.name, config.description ?? '', {
                command: config.command,
                args: config.args,
                env: this.buildPluginEnvironment({
                    id: config.id,
                    env: config.env,
                    storage: config.storage
                }),
                tools: config.tools
            });
            this.plugins.set(plugin.name, plugin);
        }

        // 2. Register Native Rust Plugins
        const nativePlugins = [
            {
                name: 'filesystem',
                description: 'Native high-performance filesystem tools',
                actions: [
                    { name: 'read', description: 'Read a file from disk' },
                    { name: 'write', description: 'Write a file to disk' },
                    { name: 'list', description: 'List directory contents' },
                    { name: 'extract_strings', description: 'Extract strings from binary/text files' },
                    { name: 'unzip', description: 'Extract a zip archive' },
                    { name: 'download_file', description: 'Download a file from a URL' }
                ]
            },
            {
                name: 'terminal',
                description: 'Native persistent terminal and shell command execution',
                actions: [
                    { name: 'run_command', description: 'Execute a command in a persistent terminal session' },
                    { name: 'list_sessions', description: 'List active terminal sessions' },
                    { name: 'resize', description: 'Resize a terminal window' },
                    { name: 'kill_session', description: 'Terminate a terminal session' }
                ]
            },
            {
                name: 'git',
                description: 'Native Git integration using libgit2',
                actions: [
                    { name: 'status', description: 'Get the status of a Git repository' },
                    { name: 'diff', description: 'Get the diff of a Git repository' },
                    { name: 'blame', description: 'Get the blame information for a file' },
                    { name: 'log', description: 'Show the commit logs' },
                    { name: 'add', description: 'Add file contents to the index' },
                    { name: 'commit', description: 'Record changes to the repository' },
                    { name: 'push', description: 'Update remote refs along with associated objects' },
                    { name: 'pull', description: 'Fetch from and integrate with another repository or a local branch' },
                    { name: 'checkout', description: 'Switch branches or restore working tree files' },
                    { name: 'branches', description: 'List local branches' }
                ]
            },
            {
                name: 'web',
                description: 'Native web scraping and search tools',
                actions: [
                    { name: 'search', description: 'Search the web for information' },
                    { name: 'read_page', description: 'Read and extract content from a web page' },
                    { name: 'fetch_json', description: 'Fetch JSON data from a URL' }
                ]
            },
            {
                name: 'crawler',
                description: 'High-performance web crawler and content extractor',
                actions: [
                    { name: 'crawl', description: 'Deep crawl a website and extract structured content' }
                ]
            },
            {
                name: 'system',
                description: 'Native system monitoring and process management',
                actions: [
                    { name: 'get_info', description: 'Get system hardware and OS information' },
                    { name: 'env_vars', description: 'List system environment variables' },
                    { name: 'process_list', description: 'List running processes with resource usage' },
                    { name: 'kill_process', description: 'Terminate a system process' },
                    { name: 'disk_space', description: 'Get disk space information' }
                ]
            },
            {
                name: 'network',
                description: 'Native network diagnostic and interface tools',
                actions: [
                    { name: 'list_interfaces', description: 'List network interfaces and IP addresses' },
                    { name: 'check_port', description: 'Check if a specific port is open' },
                    { name: 'active_ports', description: 'List active development ports' },
                    { name: 'ping', description: 'Send ICMP ECHO_REQUEST to network hosts' },
                    { name: 'traceroute', description: 'Print the route packets trace to network host' },
                    { name: 'whois', description: 'Lookup domain registration information' }
                ]
            },
            {
                name: 'internet',
                description: 'Native internet-based utility tools',
                actions: [
                    { name: 'weather', description: 'Get current weather and forecast for a location' }
                ]
            },
            {
                name: 'workspace',
                description: 'Native workspace and container management',
                actions: [
                    { name: 'listContainers', description: 'List Docker containers' },
                    { name: 'stats', description: 'Get Docker container resource usage stats' },
                    { name: 'listImages', description: 'List Docker images' }
                ]
            },
            {
                name: 'llm',
                description: 'Native LLM sidecar and model management',
                actions: [
                    { name: 'listModels', description: 'List available local LLM models (Ollama)' },
                    { name: 'ps', description: 'Show running LLM models' }
                ]
            },
            {
                name: 'search',
                description: 'Fast local search using ripgrep engine',
                actions: [
                    { name: 'grep', description: 'High-speed text search across files' }
                ]
            },
            {
                name: 'analysis',
                description: 'Native code analysis and LSP management',
                actions: [
                    { name: 'lsp_status', description: 'Check status of language servers' },
                    { name: 'symbols', description: 'Extract symbols from a file' }
                ]
            }
        ];

        for (const p of nativePlugins) {
            const plugin = new NativeMcpPlugin(this.mcpDeps.proxy, p.name, p.description, p.actions);
            this.plugins.set(plugin.name, plugin);
        }

        this.logInfo(`Loaded ${this.plugins.size} MCP plugins (${nativePlugins.length} native).`);
    }

    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up MCP plugins...');
        for (const plugin of this.plugins.values()) {
            await plugin.dispose();
        }
        this.plugins.clear();
    }

    async listPlugins() {
        const settings = this.settingsService.getSettings();
        const userServers = settings.mcpUserServers ?? [];
        const result = [];
        for (const [name, plugin] of this.plugins.entries()) {
            const actions = await plugin.getActions();
            const config = userServers.find(s => s.name === name || s.id === name);
            const fallbackProfile = !config && plugin.source === 'core'
                ? 'full-access'
                : settings.mcpPermissionProfile ?? 'read-only';
            result.push({
                name,
                id: config?.id ?? name,
                description: plugin.description,
                source: plugin.source,
                isAlive: plugin.isAlive(),
                permissionProfile: config?.permissionProfile ?? fallbackProfile,
                permissions: config?.permissions ?? this.getPermissionsByProfile(config?.permissionProfile ?? fallbackProfile),
                actions
            });
        }
        return result;
    }

    private getPermissionsByProfile(profile: McpPermissionProfile): McpPermission[] {
        switch (profile) {
            case 'read-only': return ['read'];
            case 'workspace-only': return ['read', 'write'];
            case 'network-enabled': return ['read', 'network'];
            case 'destructive': return ['read', 'write', 'delete'];
            case 'full-access': 
            default:
                return ['read', 'write', 'delete', 'network', 'execute'];
        }
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


    private getActionCategory(actionName: string): McpPermission {
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

    async dispatch(pluginName: string, actionName: string, args: JsonObject): Promise<McpDispatchResult> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            return {
                success: false,
                error: interpolateMessage(MCP_PLUGIN_ERROR_MESSAGE.PLUGIN_NOT_FOUND, { pluginName }),
                messageKey: MCP_PLUGIN_MESSAGE_KEY.PLUGIN_NOT_FOUND,
                messageParams: { pluginName }
            };
        }

        const settings = this.settingsService.getSettings();
        const disabledServers = settings.mcpDisabledServers ?? [];
        if (disabledServers.includes(pluginName)) {
            return {
                success: false,
                error: interpolateMessage(MCP_PLUGIN_ERROR_MESSAGE.PLUGIN_DISABLED, { pluginName }),
                messageKey: MCP_PLUGIN_MESSAGE_KEY.PLUGIN_DISABLED,
                messageParams: { pluginName }
            };
        }

        const userServers = settings.mcpUserServers ?? [];
        const serverConfig = userServers.find(s => s.id === pluginName || s.name === pluginName);

        if (serverConfig && !serverConfig.enabled) {
            return {
                success: false,
                error: interpolateMessage(MCP_PLUGIN_ERROR_MESSAGE.PLUGIN_DISABLED, { pluginName }),
                messageKey: MCP_PLUGIN_MESSAGE_KEY.PLUGIN_DISABLED,
                messageParams: { pluginName }
            };
        }

        // GRANULAR PERMISSION CHECK
        if (serverConfig) {
            const actionCategory = this.getActionCategory(actionName);
            const permissions = serverConfig.permissions ?? this.getPermissionsByProfile(serverConfig.permissionProfile ?? settings.mcpPermissionProfile ?? 'read-only');
            
            if (!permissions.includes(actionCategory)) {
                return {
                    success: false,
                    error: interpolateMessage(MCP_PLUGIN_ERROR_MESSAGE.GRANULAR_PERMISSION_DENIED, { 
                        pluginName, 
                        category: actionCategory,
                        actionName 
                    }),
                    messageKey: MCP_PLUGIN_MESSAGE_KEY.GRANULAR_PERMISSION_DENIED,
                    messageParams: { pluginName, category: actionCategory, actionName }
                };
            }
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

    async registerPlugin(config: MCPServerConfig) {
        const { name, description = '', command, args, env } = config;
        if (this.plugins.has(name)) {
            throw new Error(`Plugin '${name}' already exists.`);
        }

        const storage = config.storage ?? { dataPath: `mcp-storage/${name}`, quotaMb: 256, migrationVersion: 1 };
        const plugin = new ExternalMcpPlugin(name, description, {
            command,
            args,
            env: this.buildPluginEnvironment({
                id: config.id,
                env,
                storage
            }),
            tools: config.tools
        });
        await plugin.initialize();
        this.plugins.set(name, plugin);

        const settings = this.settingsService.getSettings();
        const userServers = [...(settings.mcpUserServers ?? []), {
            ...config,
            description,
            storage,
            enabled: config.enabled ?? false,
            tools: config.tools ?? [],
            permissions: config.permissions ?? this.getPermissionsByProfile(config.permissionProfile ?? settings.mcpPermissionProfile ?? 'read-only')
        }];
        await this.settingsService.saveSettings({ mcpUserServers: userServers });

        return { success: true };
    }

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
