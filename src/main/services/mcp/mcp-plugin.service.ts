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
import * as fs from 'fs';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { ExternalMcpPlugin } from '@main/mcp/external-plugin';
import { IMcpPlugin, NativeMcpPlugin } from '@main/mcp/plugin-base';
import { McpDeps } from '@main/mcp/server-utils';
import { McpDispatchResult } from '@main/mcp/types';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { t } from '@main/utils/i18n.util';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { MCP_CHANNELS, MCP_PERMISSIONS_CHANNELS } from '@shared/constants/ipc-channels';
import { JsonObject, RuntimeValue } from '@shared/types/common';
import { McpPermission, McpPermissionProfile,MCPServerConfig } from '@shared/types/settings';

const MAX_SERVICE_NAME_LENGTH = 128;
const MAX_ACTION_NAME_LENGTH = 128;

type McpActionPolicy = 'allow' | 'deny' | 'ask';

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

    private validateServiceName(value: RuntimeValue): string {
        if (typeof value !== 'string') {throw new Error('Invalid service name');}
        const trimmed = value.trim();
        if (!trimmed || trimmed.length > MAX_SERVICE_NAME_LENGTH) {throw new Error('Service name too long or empty');}
        return trimmed;
    }

    private validateActionName(value: RuntimeValue): string {
        if (typeof value !== 'string') {throw new Error('Invalid action name');}
        const trimmed = value.trim();
        if (!trimmed || trimmed.length > MAX_ACTION_NAME_LENGTH) {throw new Error('Action name too long or empty');}
        return trimmed;
    }

    @ipc(MCP_CHANNELS.LIST)
    async listServicesIpc(): Promise<RuntimeValue> {
        const plugins = await this.listPlugins();
        const settings = this.settingsService.getSettings();
        const disabled = settings.mcpDisabledServers ?? [];
        const userServers = settings.mcpUserServers ?? [];

        return serializeToIpc(plugins.map(p => ({
            ...p,
            isEnabled: !disabled.includes(p.name)
                && (userServers.find(server => server.id === p.id || server.name === p.name)?.enabled ?? true),
        })));
    }

    @ipc(MCP_CHANNELS.DISPATCH)
    async dispatchIpc(serviceRaw: RuntimeValue, actionRaw: RuntimeValue, argsRaw: RuntimeValue): Promise<RuntimeValue> {
        const service = this.validateServiceName(serviceRaw);
        const action = this.validateActionName(actionRaw);
        const args = (argsRaw && typeof argsRaw === 'object' && !Array.isArray(argsRaw)) ? argsRaw as JsonObject : {};
        
        const result = await withOperationGuard('mcp', async () =>
            this.dispatch(service, action, args)
        );
        return serializeToIpc(result);
    }

    @ipc(MCP_CHANNELS.TOGGLE)
    async toggleServiceIpc(serviceRaw: RuntimeValue, enabledRaw: RuntimeValue): Promise<RuntimeValue> {
        const service = this.validateServiceName(serviceRaw);
        const enabled = enabledRaw === true;
        
        const settings = this.settingsService.getSettings();
        let disabled = [...(settings.mcpDisabledServers ?? [])];

        if (enabled) {
            disabled = disabled.filter(s => s !== service);
        } else {
            if (!disabled.includes(service)) {
                disabled.push(service);
            }
        }

        await this.settingsService.saveSettings({ mcpDisabledServers: disabled });
        return serializeToIpc({ success: true, isEnabled: enabled });
    }

    @ipc(MCP_CHANNELS.INSTALL)
    async installServiceIpc(config: MCPServerConfig): Promise<RuntimeValue> {
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid MCP server config');
        }
        const result = await this.registerPlugin(config);
        return serializeToIpc(result);
    }

    @ipc(MCP_CHANNELS.UNINSTALL)
    async uninstallServiceIpc(nameRaw: RuntimeValue): Promise<RuntimeValue> {
        const name = this.validateServiceName(nameRaw);
        await this.unregisterPlugin(name);
        return serializeToIpc({ success: true });
    }

    @ipc(MCP_CHANNELS.DEBUG_METRICS)
    async getDebugMetricsIpc(): Promise<RuntimeValue> {
        return serializeToIpc(this.getDispatchMetrics());
    }

    @ipc(MCP_PERMISSIONS_CHANNELS.LIST_REQUESTS)
    async getPermissionRequestsIpc(): Promise<RuntimeValue> {
        return serializeToIpc(this.settingsService.getSettings().mcpPermissionRequests ?? []);
    }

    @ipc(MCP_PERMISSIONS_CHANNELS.SET)
    async setActionPermissionIpc(serviceRaw: RuntimeValue, actionRaw: RuntimeValue, policyRaw: RuntimeValue): Promise<RuntimeValue> {
        const service = this.validateServiceName(serviceRaw);
        const action = this.validateActionName(actionRaw);
        if (policyRaw !== 'allow' && policyRaw !== 'deny' && policyRaw !== 'ask') {
            throw new Error('Invalid permission policy');
        }

        const settings = this.settingsService.getSettings();
        const requestStatus = (policyRaw === 'allow' ? 'approved' : policyRaw === 'deny' ? 'denied' : 'pending') as 'approved' | 'denied' | 'pending';
        const pendingRequests = (settings.mcpPermissionRequests ?? []).map(request => {
            if (request.service !== service || request.action !== action || request.status !== 'pending') {
                return request;
            }
            return { ...request, status: requestStatus };
        });

        await this.settingsService.saveSettings({
            mcpActionPermissions: {
                ...(settings.mcpActionPermissions ?? {}),
                [`${service}:${action}`]: policyRaw as McpActionPolicy
            },
            mcpPermissionRequests: pendingRequests
        });

        return serializeToIpc({ success: true });
    }

    @ipc(MCP_PERMISSIONS_CHANNELS.RESOLVE_REQUEST)
    async resolvePermissionRequestIpc(requestIdRaw: RuntimeValue, decisionRaw: RuntimeValue): Promise<RuntimeValue> {
        if (typeof requestIdRaw !== 'string' || requestIdRaw.trim().length === 0) {
            throw new Error('Invalid request id');
        }
        if (decisionRaw !== 'approved' && decisionRaw !== 'denied') {
            throw new Error('Invalid decision');
        }

        const settings = this.settingsService.getSettings();
        const requests = settings.mcpPermissionRequests ?? [];
        const request = requests.find(item => item.id === requestIdRaw);
        if (!request) {
            throw new Error('Permission request not found');
        }

        const nextPolicy: McpActionPolicy = decisionRaw === 'approved' ? 'allow' : 'deny';
        await this.settingsService.saveSettings({
            mcpActionPermissions: {
                ...(settings.mcpActionPermissions ?? {}),
                [`${request.service}:${request.action}`]: nextPolicy
            },
            mcpPermissionRequests: requests.map(item => (
                item.id === requestIdRaw
                    ? { ...item, status: decisionRaw as 'approved' | 'denied' }
                    : item
            ))
        });

        return serializeToIpc({ success: true });
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
                    { name: 'read', description: t('auto.readAFileFromDisk') },
                    { name: 'write', description: t('auto.writeAFileToDisk') },
                    { name: 'list', description: t('auto.listDirectoryContents') },
                    { name: 'extract_strings', description: t('auto.extractStringsFromBinarytextFiles') },
                    { name: 'unzip', description: t('auto.extractAZipArchive') },
                    { name: 'download_file', description: t('auto.downloadAFileFromAUrl') }
                ]
            },
            {
                name: 'terminal',
                description: t('auto.nativePersistentTerminalAndShellCommandE'),
                actions: [
                    { name: 'run_command', description: t('auto.executeACommandInAPersistentTerminalSess') },
                    { name: 'list_sessions', description: t('auto.listActiveTerminalSessions') },
                    { name: 'resize', description: t('auto.resizeATerminalWindow') },
                    { name: 'kill_session', description: t('auto.terminateATerminalSession') }
                ]
            },
            {
                name: 'git',
                description: t('auto.nativeGitIntegrationUsingLibgit2'),
                actions: [
                    { name: 'status', description: t('auto.getTheStatusOfAGitRepository') },
                    { name: 'diff', description: t('auto.getTheDiffOfAGitRepository') },
                    { name: 'blame', description: t('auto.getTheBlameInformationForAFile') },
                    { name: 'log', description: t('auto.showTheCommitLogs') },
                    { name: 'add', description: t('auto.addFileContentsToTheIndex') },
                    { name: 'commit', description: t('auto.recordChangesToTheRepository') },
                    { name: 'push', description: 'Update remote refs along with associated objects' },
                    { name: 'pull', description: t('auto.fetchFromAndIntegrateWithAnotherReposito') },
                    { name: 'checkout', description: t('auto.switchBranchesOrRestoreWorkingTreeFiles') },
                    { name: 'branches', description: t('auto.listLocalBranches') }
                ]
            },
            {
                name: 'web',
                description: t('auto.nativeWebScrapingAndSearchTools'),
                actions: [
                    { name: 'search', description: t('auto.searchTheWebForInformation') },
                    { name: 'read_page', description: t('auto.readAndExtractContentFromAWebPage') },
                    { name: 'fetch_json', description: t('auto.fetchJsonDataFromAUrl') }
                ]
            },
            {
                name: 'crawler',
                description: t('auto.highperformanceWebCrawlerAndContentExtra'),
                actions: [
                    { name: 'crawl', description: t('auto.deepCrawlAWebsiteAndExtractStructuredCon') }
                ]
            },
            {
                name: 'system',
                description: 'Native system monitoring and process management',
                actions: [
                    { name: 'get_info', description: 'Get system hardware and OS information' },
                    { name: 'env_vars', description: 'List system environment variables' },
                    { name: 'process_list', description: t('auto.listRunningProcessesWithResourceUsage') },
                    { name: 'kill_process', description: 'Terminate a system process' },
                    { name: 'disk_space', description: t('auto.getDiskSpaceInformation') }
                ]
            },
            {
                name: 'network',
                description: t('auto.nativeNetworkDiagnosticAndInterfaceTools'),
                actions: [
                    { name: 'list_interfaces', description: t('auto.listNetworkInterfacesAndIpAddresses') },
                    { name: 'check_port', description: t('auto.checkIfASpecificPortIsOpen') },
                    { name: 'active_ports', description: t('auto.listActiveDevelopmentPorts') },
                    { name: 'ping', description: t('auto.sendIcmpEchoRequestToNetworkHosts') },
                    { name: 'traceroute', description: t('auto.printTheRoutePacketsTraceToNetworkHost') },
                    { name: 'whois', description: t('auto.lookupDomainRegistrationInformation') }
                ]
            },
            {
                name: 'internet',
                description: t('auto.nativeInternetbasedUtilityTools'),
                actions: [
                    { name: 'weather', description: t('auto.getCurrentWeatherAndForecastForALocation') }
                ]
            },
            {
                name: 'workspace',
                description: 'Native workspace and container management',
                actions: [
                    { name: 'listContainers', description: t('auto.listDockerContainers') },
                    { name: 'stats', description: t('auto.getDockerContainerResourceUsageStats') },
                    { name: 'listImages', description: t('auto.listDockerImages') }
                ]
            },
            {
                name: 'llm',
                description: 'Native LLM sidecar and model management',
                actions: [
                    { name: 'listModels', description: t('auto.listAvailableLocalLlmModelsOllama') },
                    { name: 'ps', description: t('auto.showRunningLlmModels') }
                ]
            },
            {
                name: 'search',
                description: t('auto.fastLocalSearchUsingRipgrepEngine'),
                actions: [
                    { name: 'grep', description: t('auto.highspeedTextSearchAcrossFiles') }
                ]
            },
            {
                name: 'analysis',
                description: 'Native code analysis and LSP management',
                actions: [
                    { name: 'lsp_status', description: t('auto.checkStatusOfLanguageServers') },
                    { name: 'symbols', description: t('auto.extractSymbolsFromAFile') }
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

