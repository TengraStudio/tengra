import { ipcMain } from 'electron';

import { appLogger } from '@main/logging/logger';
import { McpMarketplaceService } from '@main/services/mcp/mcp-marketplace.service';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { SettingsService } from '@main/services/system/settings.service';
import { MCPServerConfig } from '@shared/types/settings';

/**
 * IPC handlers for MCP Marketplace operations
 */
export function registerMcpMarketplaceHandlers(
    marketplaceService: McpMarketplaceService,
    settingsService: SettingsService,
    mcpPluginService: McpPluginService
) {
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
            const cmdParts = server.command?.split(' ') || [];
            const command = cmdParts[0] || '';
            const args = cmdParts.slice(1);

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
                isOfficial: server.isOfficial
            };

            // Add to settings
            const settings = settingsService.getSettings();
            const existing = settings.mcpUserServers || [];

            // Check if already installed
            if (existing.some(s => s.id === serverId)) {
                return { success: false, error: 'Server already installed' };
            }

            await settingsService.saveSettings({
                mcpUserServers: [...existing, serverConfig]
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
            const existing = settings.mcpUserServers || [];

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
            const userServers = settings.mcpUserServers || [];

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
            const existing = settings.mcpUserServers || [];

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
}
