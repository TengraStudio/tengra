import { appLogger } from '@main/logging/logger';
import { McpMarketplaceService } from '@main/services/mcp/mcp-marketplace.service';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { SettingsService } from '@main/services/system/settings.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
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
    tools: z.array(
        z.object({
            name: z.string().trim().min(1),
            description: z.string().optional(),
        })
    ).optional(),
}).passthrough();

const getErrorMessage = (error: Error): string =>
    error instanceof Error ? error.message : String(error);

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
            installedAt: Date.now(),
            updatedAt: Date.now()
        };

        const settings = settingsService.getSettings();
        const existing = settings.mcpUserServers ?? [];

        if (existing.some(s => s.id === serverId)) {
            throw new Error('Server already installed');
        }

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
            return {
                ...s,
                ...patch,
                command: commandInput.command,
                args: patch.args ?? commandInput.args,
                previousVersion: s.version,
                updatedAt: Date.now()
            };
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
