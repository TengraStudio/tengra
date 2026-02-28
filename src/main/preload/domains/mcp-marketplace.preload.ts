import { MCPServerConfig } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface McpMarketplaceBridge {
    list: () => Promise<unknown[]>;
    search: (query: string) => Promise<unknown[]>;
    filter: (category: string) => Promise<unknown[]>;
    categories: () => Promise<string[]>;
    install: (serverId: string) => Promise<{ success: boolean; error?: string }>;
    uninstall: (serverId: string) => Promise<{ success: boolean; error?: string }>;
    installed: () => Promise<unknown[]>;
    toggle: (serverId: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    updateConfig: (serverId: string, patch: Partial<MCPServerConfig>) => Promise<{ success: boolean; error?: string }>;
    versionHistory: (serverId: string) => Promise<unknown[]>;
    rollbackVersion: (serverId: string, targetVersion: string) => Promise<{ success: boolean; error?: string }>;
    debug: () => Promise<Record<string, unknown>>;
    refresh: () => Promise<{ success: boolean }>;
    health: () => Promise<Record<string, unknown>>;
    extensionTemplates: () => Promise<unknown[]>;
    draftExtension: (payload: unknown) => Promise<Record<string, unknown>>;
    securityScan: (serverId: string) => Promise<Record<string, unknown>>;
    reviewsList: (serverId: string) => Promise<unknown[]>;
    submitReview: (serverId: string, payload: unknown) => Promise<Record<string, unknown>>;
    moderateReview: (serverId: string, reviewId: string, payload: unknown) => Promise<Record<string, unknown>>;
    voteReview: (serverId: string, reviewId: string) => Promise<Record<string, unknown>>;
    trackEvent: (payload: unknown) => Promise<Record<string, unknown>>;
    trackCrash: (payload: unknown) => Promise<Record<string, unknown>>;
    getTelemetrySummary: () => Promise<Record<string, unknown>>;
}

export function createMcpMarketplaceBridge(ipc: IpcRenderer): McpMarketplaceBridge {
    return {
        list: () => ipc.invoke('mcp:marketplace:list'),
        search: query => ipc.invoke('mcp:marketplace:search', query),
        filter: category => ipc.invoke('mcp:marketplace:filter', category),
        categories: () => ipc.invoke('mcp:marketplace:categories'),
        install: serverId => ipc.invoke('mcp:marketplace:install', serverId),
        uninstall: serverId => ipc.invoke('mcp:marketplace:uninstall', serverId),
        installed: () => ipc.invoke('mcp:marketplace:installed'),
        toggle: (serverId, enabled) => ipc.invoke('mcp:marketplace:toggle', serverId, enabled),
        updateConfig: (serverId, patch) => ipc.invoke('mcp:marketplace:update-config', serverId, patch),
        versionHistory: serverId => ipc.invoke('mcp:marketplace:version-history', serverId),
        rollbackVersion: (serverId, targetVersion) =>
            ipc.invoke('mcp:marketplace:rollback-version', serverId, targetVersion),
        debug: () => ipc.invoke('mcp:marketplace:debug'),
        refresh: () => ipc.invoke('mcp:marketplace:refresh'),
        health: () => ipc.invoke('mcp:marketplace:health'),
        extensionTemplates: () => ipc.invoke('mcp:marketplace:extension-templates'),
        draftExtension: payload => ipc.invoke('mcp:marketplace:draft-extension', payload),
        securityScan: serverId => ipc.invoke('mcp:marketplace:security-scan', serverId),
        reviewsList: serverId => ipc.invoke('mcp:marketplace:reviews:list', serverId),
        submitReview: (serverId, payload) => ipc.invoke('mcp:marketplace:reviews:submit', serverId, payload),
        moderateReview: (serverId, reviewId, payload) =>
            ipc.invoke('mcp:marketplace:reviews:moderate', serverId, reviewId, payload),
        voteReview: (serverId, reviewId) => ipc.invoke('mcp:marketplace:reviews:vote', serverId, reviewId),
        trackEvent: payload => ipc.invoke('mcp:marketplace:telemetry:track', payload),
        trackCrash: payload => ipc.invoke('mcp:marketplace:telemetry:crash', payload),
        getTelemetrySummary: () => ipc.invoke('mcp:marketplace:telemetry:summary'),
    };
}
