import { IpcValue } from '@shared/types/common';
import { z } from 'zod';

import { invokeIpc } from '@/lib/ipc-client';

const ServerSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    publisher: z.string().optional(),
    version: z.string().optional(),
    categories: z.array(z.string()).optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    category: z.string().optional(),
    isOfficial: z.boolean().optional()
});

const SuccessResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
});

const ServerListResponseSchema = z.object({
    success: z.boolean(),
    servers: z.array(ServerSchema).optional(),
    error: z.string().optional()
});

const HistoryResponseSchema = z.object({
    success: z.boolean(),
    history: z.array(z.string()).optional(),
    error: z.string().optional()
});
const IpcValueSchema = z.custom<IpcValue>();

export type McpServerLike = z.infer<typeof ServerSchema>;

export const mcpMarketplaceClient = {
    list: () =>
        invokeIpc('mcp:marketplace:list', [], { responseSchema: ServerListResponseSchema }),
    installed: () =>
        invokeIpc('mcp:marketplace:installed', [], { responseSchema: ServerListResponseSchema }),
    install: (serverId: string) =>
        invokeIpc('mcp:marketplace:install', [serverId], {
            argsSchema: z.tuple([z.string().min(1)]),
            responseSchema: SuccessResponseSchema
        }),
    uninstall: (serverId: string) =>
        invokeIpc('mcp:marketplace:uninstall', [serverId], {
            argsSchema: z.tuple([z.string().min(1)]),
            responseSchema: SuccessResponseSchema
        }),
    toggle: (serverId: string, enabled: boolean) =>
        invokeIpc('mcp:marketplace:toggle', [serverId, enabled], {
            argsSchema: z.tuple([z.string().min(1), z.boolean()]),
            responseSchema: SuccessResponseSchema
        }),
    updateConfig: (serverId: string, patch: Record<string, IpcValue>) =>
        invokeIpc('mcp:marketplace:update-config', [serverId, patch], {
            argsSchema: z.tuple([z.string().min(1), z.record(z.string(), IpcValueSchema)]),
            responseSchema: SuccessResponseSchema
        }),
    versionHistory: (serverId: string) =>
        invokeIpc('mcp:marketplace:version-history', [serverId], {
            argsSchema: z.tuple([z.string().min(1)]),
            responseSchema: HistoryResponseSchema
        }),
    rollbackVersion: (serverId: string, targetVersion: string) =>
        invokeIpc('mcp:marketplace:rollback-version', [serverId, targetVersion], {
            argsSchema: z.tuple([z.string().min(1), z.string().min(1)]),
            responseSchema: SuccessResponseSchema
        })
};
