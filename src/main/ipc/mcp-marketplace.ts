import { appLogger } from '@main/logging/logger';
import { McpMarketplaceService } from '@main/services/mcp/mcp-marketplace.service';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { SettingsService } from '@main/services/system/settings.service';
import { MCPServerConfig } from '@shared/types/settings';
import { ipcMain } from 'electron';

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

    /**
     * List all available servers from marketplace
     */
    ipcMain.handle('mcp:marketplace:list', async () => {
        try {
            const servers = await marketplaceService.listServers();
            return { success: true, servers };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to list servers: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Search marketplace servers
     */
    ipcMain.handle('mcp:marketplace:search', async (_event, query: string) => {
        try {
            const servers = await marketplaceService.searchServers(query);
            return { success: true, servers };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to search servers: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Filter servers by category
     */
    ipcMain.handle('mcp:marketplace:filter', async (_event, category: string) => {
        try {
            const servers = await marketplaceService.filterByCategory(category);
            return { success: true, servers };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to filter servers: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Get all categories
     */
    ipcMain.handle('mcp:marketplace:categories', async () => {
        try {
            const categories = await marketplaceService.getCategories();
            return { success: true, categories };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to get categories: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Install an MCP server from marketplace
     */
    ipcMain.handle('mcp:marketplace:install', async (_event, serverId: string) => {
        try {
            const servers = await marketplaceService.listServers();
            const server = servers.find(s => s.id === serverId);

            if (!server) {
                return { success: false, error: 'Server not found in marketplace' };
            }

            // Parse command into command and args
            const { command, args } = parseCommand(server.command);

            // Create server config
            const serverConfig: MCPServerConfig = {
                id: server.id,
                name: server.name,
                command,
                args,
                description: server.description,
                enabled: false, // Default disabled, user must enable
                category: server.categories?.[0],
                publisher: server.publisher,
                version: server.version,
                isOfficial: server.isOfficial,
                installedAt: Date.now(),
                updatedAt: Date.now()
            };

            // Add to settings
            const settings = settingsService.getSettings();
            const existing = settings.mcpUserServers ?? [];

            // Check if already installed
            if (existing.some(s => s.id === serverId)) {
                return { success: false, error: 'Server already installed' };
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
            return { success: true };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to install server: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Uninstall an MCP server
     */
    ipcMain.handle('mcp:marketplace:uninstall', async (_event, serverId: string) => {
        try {
            const settings = settingsService.getSettings();
            const existing = settings.mcpUserServers ?? [];

            const filtered = existing.filter(s => s.id !== serverId);

            if (filtered.length === existing.length) {
                return { success: false, error: 'Server not found' };
            }

            await settingsService.saveSettings({
                mcpUserServers: filtered
            });

            appLogger.info('MCP Marketplace', `Uninstalled server: ${serverId}`);
            return { success: true };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to uninstall server: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Get list of installed servers (includes both internal built-in tools and user-installed marketplace servers)
     */
    ipcMain.handle('mcp:marketplace:installed', async () => {
        try {
            const settings = settingsService.getSettings();
            const userServers = settings.mcpUserServers ?? [];

            // Get internal built-in plugins
            const internalPlugins = await mcpPluginService.listPlugins();

            // Convert core plugins to MCPServerConfig format
            const internalServers: MCPServerConfig[] = internalPlugins
                .filter(p => p.source === 'core') // Only include core/built-in plugins
                .map(p => ({
                    id: p.name,
                    name: p.name,
                    command: 'internal',
                    args: [],
                    description: p.description,
                    enabled: true, // Core tools are always enabled
                    tools: p.actions.map(a => ({ name: a.name, description: a.description || '' })),
                    category: 'Internal',
                    isOfficial: true,
                    version: '1.0.0'
                }));

            // Merge internal and user servers
            const allServers = [...internalServers, ...userServers];

            return { success: true, servers: allServers };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to get installed servers: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Enable/disable an installed MCP server
     */
    ipcMain.handle('mcp:marketplace:toggle', async (_event, serverId: string, enabled: boolean) => {
        try {
            const settings = settingsService.getSettings();
            const existing = settings.mcpUserServers ?? [];

            const updated = existing.map(s =>
                s.id === serverId ? { ...s, enabled } : s
            );

            await settingsService.saveSettings({
                mcpUserServers: updated
            });

            appLogger.info('MCP Marketplace', `${enabled ? 'Enabled' : 'Disabled'} server: ${serverId}`);
            return { success: true };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to toggle server: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Refresh marketplace cache
     */
    ipcMain.handle('mcp:marketplace:refresh', async () => {
        try {
            await marketplaceService.refreshCache();
            return { success: true };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to refresh cache: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Update installed server configuration
     */
    ipcMain.handle('mcp:marketplace:update-config', async (_event, serverId: string, patch: Partial<MCPServerConfig>) => {
        try {
            const settings = settingsService.getSettings();
            const existing = settings.mcpUserServers ?? [];
            const current = existing.find(s => s.id === serverId);
            if (!current) {
                return { success: false, error: 'Server not found' };
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

            return { success: true };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to update config: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Return version history for a server
     */
    ipcMain.handle('mcp:marketplace:version-history', async (_event, serverId: string) => {
        try {
            const settings = settingsService.getSettings();
            const history = settings.mcpServerVersionHistory?.[serverId] ?? [];
            return { success: true, history };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to get version history: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Rollback installed server to a known version (metadata-level rollback)
     */
    ipcMain.handle('mcp:marketplace:rollback-version', async (_event, serverId: string, targetVersion: string) => {
        try {
            const settings = settingsService.getSettings();
            const history = settings.mcpServerVersionHistory?.[serverId] ?? [];
            if (!history.includes(targetVersion)) {
                return { success: false, error: 'Target version not found in history' };
            }

            const existing = settings.mcpUserServers ?? [];
            const updated = existing.map(s => s.id === serverId ? {
                ...s,
                previousVersion: s.version,
                version: targetVersion,
                updatedAt: Date.now()
            } : s);

            await settingsService.saveSettings({ mcpUserServers: updated });
            return { success: true };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to rollback version: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    /**
     * Diagnostics for MCP operations
     */
    ipcMain.handle('mcp:marketplace:debug', async () => {
        try {
            const pluginMetrics = mcpPluginService.getDispatchMetrics();
            const settings = settingsService.getSettings();
            return {
                success: true,
                metrics: {
                    pluginMetrics,
                    installedCount: (settings.mcpUserServers ?? []).length,
                    pendingPermissions: (settings.mcpPermissionRequests ?? []).filter(r => r.status === 'pending').length
                }
            };
        } catch (error) {
            appLogger.error('MCP Marketplace', `Failed to get debug metrics: ${error}`);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
}
