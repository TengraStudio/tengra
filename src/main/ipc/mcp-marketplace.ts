import { createHash } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { McpMarketplaceService } from '@main/services/mcp/mcp-marketplace.service';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { SettingsService } from '@main/services/system/settings.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { JsonValue } from '@shared/types/common';
import { MCPServerConfig } from '@shared/types/settings';
import { ipcMain } from 'electron';
import { z } from 'zod';

interface MarketplaceResponse {
    success: boolean;
    error?: string;
    [key: string]: unknown;
}

const EmptyArgsSchema = z.tuple([]);
const ServerIdSchema = z.string().trim().min(1).max(120);
const CategorySchema = z.string().trim().min(1).max(120);
const QuerySchema = z.string().trim().min(1).max(500);
const VersionSchema = z.string().trim().min(1).max(64);
const MarketplaceValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const SettingsFieldSchema = z.object({
    type: z.enum(['string', 'number', 'integer', 'boolean']).optional(),
    enum: z.array(MarketplaceValueSchema).optional(),
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(400).optional()
});
const SettingsSchema = z.object({
    type: z.literal('object').optional(),
    properties: z.record(z.string(), SettingsFieldSchema).optional(),
    required: z.array(z.string().trim().min(1).max(120)).max(128).optional()
});
const MarketplacePatchSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    command: z.string().trim().min(1).max(2048).optional(),
    args: z.array(z.string()).max(128).optional(),
    description: z.string().trim().max(4000).optional(),
    enabled: z.boolean().optional(),
    category: z.string().trim().max(120).optional(),
    publisher: z.string().trim().max(120).optional(),
    version: z.string().trim().max(64).optional(),
    isOfficial: z.boolean().optional(),
    capabilities: z.array(z.string().trim().min(1).max(120)).max(64).optional(),
    dependencies: z.array(ServerIdSchema).max(64).optional(),
    conflictsWith: z.array(ServerIdSchema).max(64).optional(),
    sandbox: z.object({
        enabled: z.boolean().optional(),
        maxMemoryMb: z.number().int().positive().max(65536).optional(),
        maxCpuPercent: z.number().int().min(1).max(100).optional()
    }).optional(),
    storage: z.object({
        dataPath: z.string().trim().min(1).max(260).optional(),
        quotaMb: z.number().int().positive().max(1048576).optional(),
        migrationVersion: z.number().int().positive().max(100000).optional()
    }).optional(),
    updatePolicy: z.object({
        channel: z.enum(['stable', 'beta', 'alpha']).optional(),
        autoUpdate: z.boolean().optional(),
        scheduleCron: z.string().trim().max(120).optional(),
        signatureSha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/).optional(),
        lastCheckedAt: z.number().int().nonnegative().optional(),
        lastUpdatedAt: z.number().int().nonnegative().optional()
    }).optional(),
    settingsSchema: SettingsSchema.optional(),
    settingsValues: z.record(z.string(), MarketplaceValueSchema).optional(),
    settingsVersion: z.number().int().positive().max(100000).optional(),
    integrityHash: z.string().trim().regex(/^[a-fA-F0-9]{64}$/).optional(),
    tools: z.array(
        z.object({
            name: z.string().trim().min(1),
            description: z.string().optional(),
        })
    ).optional(),
}).passthrough();

const getErrorMessage = (error: Error): string =>
    error instanceof Error ? error.message : String(error);

const isJsonObject = (value: JsonValue | undefined): value is Record<string, JsonValue> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const computeIntegrityHash = (server: Pick<MCPServerConfig, 'id' | 'name' | 'command' | 'args' | 'version'>): string => {
    const payload = JSON.stringify({
        id: server.id,
        name: server.name,
        command: server.command,
        args: server.args ?? [],
        version: server.version ?? '0.0.0'
    });
    return createHash('sha256').update(payload).digest('hex');
};

const validateSettingsValues = (
    schemaValue: JsonValue | undefined,
    valuesValue: JsonValue | undefined
): void => {
    if (!schemaValue || !valuesValue) {
        return;
    }

    if (!isJsonObject(schemaValue) || !isJsonObject(valuesValue)) {
        throw new Error('Invalid extension settings payload');
    }

    const propertiesValue = schemaValue.properties;
    const requiredValue = schemaValue.required;
    if (!isJsonObject(propertiesValue)) {
        return;
    }

    const requiredFields = Array.isArray(requiredValue)
        ? requiredValue.filter((field): field is string => typeof field === 'string')
        : [];
    for (const fieldName of requiredFields) {
        if (!(fieldName in valuesValue)) {
            throw new Error(`Missing required setting: ${fieldName}`);
        }
    }

    for (const [fieldName, fieldDefValue] of Object.entries(propertiesValue)) {
        if (!(fieldName in valuesValue)) {
            continue;
        }
        if (!isJsonObject(fieldDefValue)) {
            continue;
        }

        const fieldType = typeof fieldDefValue.type === 'string' ? fieldDefValue.type : undefined;
        const currentValue = valuesValue[fieldName];
        const isValidType =
            fieldType === undefined ||
            (fieldType === 'string' && typeof currentValue === 'string') ||
            (fieldType === 'number' && typeof currentValue === 'number') ||
            (fieldType === 'integer' && typeof currentValue === 'number' && Number.isInteger(currentValue)) ||
            (fieldType === 'boolean' && typeof currentValue === 'boolean');
        if (!isValidType) {
            throw new Error(`Invalid setting type for ${fieldName}`);
        }

        if (Array.isArray(fieldDefValue.enum) && fieldDefValue.enum.length > 0) {
            const enumMatches = fieldDefValue.enum.some(entry => entry === currentValue);
            if (!enumMatches) {
                throw new Error(`Invalid enum setting value for ${fieldName}`);
            }
        }
    }
};

const ensureInstallableServerConfig = (serverConfig: MCPServerConfig, existingServers: MCPServerConfig[]): void => {
    const installedIds = new Set(existingServers.map(server => server.id));
    const missingDependencies = (serverConfig.dependencies ?? []).filter(dep => !installedIds.has(dep));
    if (missingDependencies.length > 0) {
        throw new Error(`Missing dependencies: ${missingDependencies.join(', ')}`);
    }

    const conflictingIds = (serverConfig.conflictsWith ?? []).filter(conflictId => installedIds.has(conflictId));
    if (conflictingIds.length > 0) {
        throw new Error(`Conflict detected with installed servers: ${conflictingIds.join(', ')}`);
    }

    const reverseConflicts = existingServers
        .filter(server => (server.conflictsWith ?? []).includes(serverConfig.id))
        .map(server => server.id);
    if (reverseConflicts.length > 0) {
        throw new Error(`Installed server conflict detected: ${reverseConflicts.join(', ')}`);
    }
};

const ensureServerCanBeEnabled = (targetServer: MCPServerConfig, allServers: MCPServerConfig[]): void => {
    const enabledIds = new Set(allServers.filter(server => server.enabled).map(server => server.id));
    const missingDependencies = (targetServer.dependencies ?? []).filter(dep => !enabledIds.has(dep));
    if (missingDependencies.length > 0) {
        throw new Error(`Enable blocked by missing enabled dependencies: ${missingDependencies.join(', ')}`);
    }

    const activeConflicts = (targetServer.conflictsWith ?? []).filter(conflictId => enabledIds.has(conflictId));
    if (activeConflicts.length > 0) {
        throw new Error(`Enable blocked by conflict: ${activeConflicts.join(', ')}`);
    }

    const reverseConflicts = allServers
        .filter(server => server.enabled && (server.conflictsWith ?? []).includes(targetServer.id))
        .map(server => server.id);
    if (reverseConflicts.length > 0) {
        throw new Error(`Enable blocked by existing reverse conflict: ${reverseConflicts.join(', ')}`);
    }
};

const createMarketplaceHandler = <T extends Record<string, unknown>, Args extends unknown[] = unknown[]>(
    name: string,
    handler: (...args: Args) => Promise<T>,
    argsSchema?: z.ZodTuple<[]> | z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]>
) => {
    return createValidatedIpcHandler<MarketplaceResponse, Args>(
        name,
        async (_event, ...args) => {
            const result = await handler(...args);
            return { success: true, ...result };
        },
        {
            argsSchema,
            schemaVersion: 1,
            onError: (error) => ({ success: false, error: getErrorMessage(error) }),
        }
    );
};

/**
 * IPC handlers for MCP Marketplace operations
 */
export function registerMcpMarketplaceHandlers(
    marketplaceService: McpMarketplaceService,
    settingsService: SettingsService,
    mcpPluginService: McpPluginService
) {
    const parseCommand = (commandLine: string | undefined): { command: string; args: string[] } => {
        const cmdParts = commandLine?.split(' ') ?? [];
        return {
            command: cmdParts[0] ?? '',
            args: cmdParts.slice(1)
        };
    };

    ipcMain.handle('mcp:marketplace:list', createMarketplaceHandler('mcp:marketplace:list', async () => {
        const servers = await marketplaceService.listServers();
        return { servers };
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:search', createMarketplaceHandler('mcp:marketplace:search', async (query: string) => {
        const servers = await marketplaceService.searchServers(query);
        return { servers };
    }, z.tuple([QuerySchema])));

    ipcMain.handle('mcp:marketplace:filter', createMarketplaceHandler('mcp:marketplace:filter', async (category: string) => {
        const servers = await marketplaceService.filterByCategory(category);
        return { servers };
    }, z.tuple([CategorySchema])));

    ipcMain.handle('mcp:marketplace:categories', createMarketplaceHandler('mcp:marketplace:categories', async () => {
        const categories = await marketplaceService.getCategories();
        return { categories };
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:install', createMarketplaceHandler('mcp:marketplace:install', async (serverId: string) => {
        const servers = await marketplaceService.listServers();
        const server = servers.find(s => s.id === serverId);

        if (!server) {
            throw new Error('Server not found in marketplace');
        }

        const { command, args } = parseCommand(server.command);
        if (!command) {
            throw new Error('Server command is missing from marketplace metadata');
        }

        const serverConfig: MCPServerConfig = {
            id: server.id,
            name: server.name,
            command,
            args,
            description: server.description,
            enabled: false,
            category: server.categories?.[0],
            publisher: server.publisher,
            version: server.version,
            isOfficial: server.isOfficial,
            capabilities: server.capabilities ?? server.categories ?? [],
            dependencies: server.dependencies ?? [],
            conflictsWith: server.conflictsWith ?? [],
            sandbox: {
                enabled: true,
                maxMemoryMb: 256,
                maxCpuPercent: 50
            },
            storage: {
                dataPath: `mcp-storage/${server.id}`,
                quotaMb: server.storage?.quotaMb ?? 256,
                migrationVersion: 1
            },
            updatePolicy: {
                channel: server.updatePolicy?.channel ?? 'stable',
                autoUpdate: server.updatePolicy?.autoUpdate ?? true,
                scheduleCron: server.updatePolicy?.scheduleCron,
                signatureSha256: server.updatePolicy?.signatureSha256
            },
            settingsSchema: server.settingsSchema,
            settingsValues: {},
            settingsVersion: server.settingsVersion ?? 1,
            installedAt: Date.now(),
            updatedAt: Date.now()
        };

        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];

        if (existing.some(s => s.id === serverId)) {
            throw new Error('Server already installed');
        }
        ensureInstallableServerConfig(serverConfig, existing);
        validateSettingsValues(
            serverConfig.settingsSchema as JsonValue | undefined,
            serverConfig.settingsValues as JsonValue | undefined
        );
        const integrityHash = computeIntegrityHash(serverConfig);
        serverConfig.integrityHash = integrityHash;
        serverConfig.updatePolicy = {
            ...serverConfig.updatePolicy,
            signatureSha256: serverConfig.updatePolicy?.signatureSha256 ?? integrityHash
        };

        const versionHistory = settings.mcpServerVersionHistory ?? {};
        versionHistory[serverId] = [
            ...(versionHistory[serverId] ?? []),
            server.version ?? '0.0.0'
        ];

        await settingsService.saveSettings({
            mcpUserServers: [...existing, serverConfig],
            mcpServerVersionHistory: versionHistory
        });

        appLogger.info('MCP Marketplace', `Installed server: ${server.name}`);
        return {};
    }, z.tuple([ServerIdSchema])));

    ipcMain.handle('mcp:marketplace:uninstall', createMarketplaceHandler('mcp:marketplace:uninstall', async (serverId: string) => {
        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];
        const dependents = existing
            .filter(server => (server.dependencies ?? []).includes(serverId))
            .map(server => server.id);
        if (dependents.length > 0) {
            throw new Error(`Cannot uninstall server; required by: ${dependents.join(', ')}`);
        }
        const filtered = existing.filter(s => s.id !== serverId);

        if (filtered.length === existing.length) {
            throw new Error('Server not found');
        }

        await settingsService.saveSettings({
            mcpUserServers: filtered
        });

        appLogger.info('MCP Marketplace', `Uninstalled server: ${serverId}`);
        return {};
    }, z.tuple([ServerIdSchema])));

    ipcMain.handle('mcp:marketplace:installed', createMarketplaceHandler('mcp:marketplace:installed', async () => {
        const settings = settingsService.getSettings();
        const userServers = settings.mcpUserServers ?? [];
        const internalPlugins = await mcpPluginService.listPlugins();

        const internalServers: MCPServerConfig[] = internalPlugins
            .filter(p => p.source === 'core')
            .map(p => ({
                id: p.name,
                name: p.name,
                command: 'internal',
                args: [],
                description: p.description,
                enabled: true,
                tools: p.actions.map(a => ({ name: a.name, description: a.description || '' })),
                category: 'Internal',
                isOfficial: true,
                version: '1.0.0'
            }));

        const allServers = [...internalServers, ...userServers];
        return { servers: allServers };
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:toggle', createMarketplaceHandler('mcp:marketplace:toggle', async (serverId: string, enabled: boolean) => {
        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];
        const serverToToggle = existing.find(server => server.id === serverId);
        if (!serverToToggle) {
            throw new Error('Server not found');
        }
        if (enabled) {
            ensureServerCanBeEnabled(serverToToggle, existing);
        }

        const updated = existing.map(s =>
            s.id === serverId ? { ...s, enabled } : s
        );

        await settingsService.saveSettings({
            mcpUserServers: updated
        });

        appLogger.info('MCP Marketplace', `${enabled ? 'Enabled' : 'Disabled'} server: ${serverId}`);
        return {};
    }, z.tuple([ServerIdSchema, z.boolean()])));

    ipcMain.handle('mcp:marketplace:refresh', createMarketplaceHandler('mcp:marketplace:refresh', async () => {
        await marketplaceService.refreshCache();
        return {};
    }, EmptyArgsSchema));

    ipcMain.handle('mcp:marketplace:update-config', createMarketplaceHandler('mcp:marketplace:update-config', async (serverId: string, patch: Partial<MCPServerConfig>) => {
        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];
        const current = existing.find(s => s.id === serverId);
        if (!current) {
            throw new Error('Server not found');
        }

        const nextVersion = patch.version ?? current.version ?? '0.0.0';
        const versionHistory = settings.mcpServerVersionHistory ?? {};
        const previous = versionHistory[serverId] ?? [];

        if (previous[previous.length - 1] !== nextVersion) {
            versionHistory[serverId] = [...previous, nextVersion];
        }

        const updated = existing.map(s => {
            if (s.id !== serverId) {
                return s;
            }
            const commandInput = patch.command ? parseCommand(patch.command) : { command: s.command, args: s.args };
            const mergedServer: MCPServerConfig = {
                ...s,
                ...patch,
                command: commandInput.command,
                args: patch.args ?? commandInput.args,
                previousVersion: s.version,
                updatedAt: Date.now()
            };
            validateSettingsValues(
                mergedServer.settingsSchema as JsonValue | undefined,
                mergedServer.settingsValues as JsonValue | undefined
            );
            ensureInstallableServerConfig(
                mergedServer,
                existing.filter(existingServer => existingServer.id !== serverId)
            );
            if (mergedServer.enabled) {
                ensureServerCanBeEnabled(
                    mergedServer,
                    existing
                        .filter(existingServer => existingServer.id !== serverId)
                        .concat(mergedServer)
                );
            }

            const computedIntegrityHash = computeIntegrityHash(mergedServer);
            if (patch.integrityHash && patch.integrityHash !== computedIntegrityHash) {
                throw new Error('Integrity verification failed');
            }
            mergedServer.integrityHash = computedIntegrityHash;
            mergedServer.updatePolicy = {
                channel: mergedServer.updatePolicy?.channel ?? 'stable',
                autoUpdate: mergedServer.updatePolicy?.autoUpdate ?? true,
                scheduleCron: mergedServer.updatePolicy?.scheduleCron,
                signatureSha256: mergedServer.updatePolicy?.signatureSha256 ?? computedIntegrityHash,
                lastCheckedAt: mergedServer.updatePolicy?.lastCheckedAt,
                lastUpdatedAt: Date.now()
            };
            return mergedServer;
        });

        await settingsService.saveSettings({
            mcpUserServers: updated,
            mcpServerVersionHistory: versionHistory
        });

        return {};
    }, z.tuple([ServerIdSchema, MarketplacePatchSchema as z.ZodType<Partial<MCPServerConfig>>])));

    ipcMain.handle('mcp:marketplace:version-history', createMarketplaceHandler('mcp:marketplace:version-history', async (serverId: string) => {
        const settings = settingsService.getSettings();
        const history = settings.mcpServerVersionHistory?.[serverId] ?? [];
        return { history };
    }, z.tuple([ServerIdSchema])));

    ipcMain.handle('mcp:marketplace:rollback-version', createMarketplaceHandler('mcp:marketplace:rollback-version', async (serverId: string, targetVersion: string) => {
        const settings = settingsService.getSettings();
        const history = settings.mcpServerVersionHistory?.[serverId] ?? [];
        if (!history.includes(targetVersion)) {
            throw new Error('Target version not found in history');
        }

        const existing = settings.mcpUserServers ?? [];
        const updated = existing.map(s => s.id === serverId ? {
            ...s,
            previousVersion: s.version,
            version: targetVersion,
            updatedAt: Date.now()
        } : s);

        await settingsService.saveSettings({ mcpUserServers: updated });
        return {};
    }, z.tuple([ServerIdSchema, VersionSchema])));

    ipcMain.handle('mcp:marketplace:debug', createMarketplaceHandler('mcp:marketplace:debug', async () => {
        const pluginMetrics = mcpPluginService.getDispatchMetrics();
        const settings = settingsService.getSettings();
        return {
            metrics: {
                pluginMetrics,
                installedCount: (settings.mcpUserServers ?? []).length,
                pendingPermissions: (settings.mcpPermissionRequests ?? []).filter(r => r.status === 'pending').length
            }
        };
    }, EmptyArgsSchema));
}
