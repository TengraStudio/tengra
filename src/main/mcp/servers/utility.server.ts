import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildUtilityServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'utility',
            description: 'Utility helpers',
            actions: buildActions([
                { name: 'exchangeRate', description: 'Get FX rate', handler: ({ from, to }) => deps.utility.getExchangeRate(from as string, to as string) },
                { name: 'storeMemory', description: 'Store memory key/value', handler: ({ key, value }) => deps.utility.storeMemory(key as string, value as string) },
                { name: 'recallMemory', description: 'Recall memory by key', handler: ({ key }) => deps.utility.recallMemory(key as string) }
            ], 'utility', deps.auditLog)
        },
        {
            name: 'screenshot',
            description: 'Screen capture utilities',
            actions: buildActions([
                { name: 'capture', description: 'Capture primary screen', handler: () => deps.screenshot.captureScreen() },
                { name: 'listWindows', description: 'List windows', handler: () => deps.screenshot.listWindows() }
            ], 'screenshot', deps.auditLog)
        },
        {
            name: 'notification',
            description: 'System notifications',
            actions: buildActions([
                { name: 'notify', description: 'Send notification', handler: ({ title, body, silent }) => deps.notification.showNotification(title as string, body as string, silent as boolean) }
            ], 'notification', deps.auditLog)
        },
        {
            name: 'monitoring',
            description: 'System monitoring',
            actions: buildActions([
                { name: 'usage', description: 'Get CPU/memory usage', handler: () => deps.monitoring.getUsage() }
            ], 'monitoring', deps.auditLog)
        },
        {
            name: 'clipboard',
            description: 'Clipboard helpers',
            actions: buildActions([
                { name: 'read', description: 'Read clipboard text', handler: () => deps.clipboard.readText() },
                { name: 'write', description: 'Write clipboard text', handler: ({ text }) => deps.clipboard.writeText(text as string) }
            ], 'clipboard', deps.auditLog)
        }
    ];
}
