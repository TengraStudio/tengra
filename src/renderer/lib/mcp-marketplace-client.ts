import { IpcValue } from '@shared/types/common';
import { z } from 'zod';

import { invokeTypedIpc, type IpcContractMap } from '@/lib/ipc-client';

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

type McpMarketplaceIpcContract = IpcContractMap & {
    'mcp:marketplace:list': { args: []; response: z.infer<typeof ServerListResponseSchema> };
    'mcp:marketplace:installed': { args: []; response: z.infer<typeof ServerListResponseSchema> };
    'mcp:marketplace:install': { args: [string]; response: z.infer<typeof SuccessResponseSchema> };
    'mcp:marketplace:uninstall': { args: [string]; response: z.infer<typeof SuccessResponseSchema> };
    'mcp:marketplace:toggle': { args: [string, boolean]; response: z.infer<typeof SuccessResponseSchema> };
    'mcp:marketplace:update-config': {
        args: [string, Record<string, IpcValue>];
        response: z.infer<typeof SuccessResponseSchema>;
    };
    'mcp:marketplace:version-history': {
        args: [string];
        response: z.infer<typeof HistoryResponseSchema>;
    };
    'mcp:marketplace:rollback-version': {
        args: [string, string];
        response: z.infer<typeof SuccessResponseSchema>;
    };
};

export const mcpMarketplaceClient = {
    list: () =>
        invokeTypedIpc<McpMarketplaceIpcContract, 'mcp:marketplace:list'>(
            'mcp:marketplace:list',
            [],
            { responseSchema: ServerListResponseSchema }
        ),
    installed: () =>
        invokeTypedIpc<McpMarketplaceIpcContract, 'mcp:marketplace:installed'>(
            'mcp:marketplace:installed',
            [],
            { responseSchema: ServerListResponseSchema }
        ),
    install: (serverId: string) =>
        invokeTypedIpc<McpMarketplaceIpcContract, 'mcp:marketplace:install'>(
            'mcp:marketplace:install',
            [serverId],
            {
            argsSchema: z.tuple([z.string().min(1)]),
            responseSchema: SuccessResponseSchema
            }
        ),
    uninstall: (serverId: string) =>
        invokeTypedIpc<McpMarketplaceIpcContract, 'mcp:marketplace:uninstall'>(
            'mcp:marketplace:uninstall',
            [serverId],
            {
            argsSchema: z.tuple([z.string().min(1)]),
            responseSchema: SuccessResponseSchema
            }
        ),
    toggle: (serverId: string, enabled: boolean) =>
        invokeTypedIpc<McpMarketplaceIpcContract, 'mcp:marketplace:toggle'>(
            'mcp:marketplace:toggle',
            [serverId, enabled],
            {
            argsSchema: z.tuple([z.string().min(1), z.boolean()]),
            responseSchema: SuccessResponseSchema
            }
        ),
    updateConfig: (serverId: string, patch: Record<string, IpcValue>) =>
        invokeTypedIpc<McpMarketplaceIpcContract, 'mcp:marketplace:update-config'>(
            'mcp:marketplace:update-config',
            [serverId, patch],
            {
            argsSchema: z.tuple([z.string().min(1), z.record(z.string(), IpcValueSchema)]),
            responseSchema: SuccessResponseSchema
            }
        ),
    versionHistory: (serverId: string) =>
        invokeTypedIpc<McpMarketplaceIpcContract, 'mcp:marketplace:version-history'>(
            'mcp:marketplace:version-history',
            [serverId],
            {
            argsSchema: z.tuple([z.string().min(1)]),
            responseSchema: HistoryResponseSchema
            }
        ),
    rollbackVersion: (serverId: string, targetVersion: string) =>
        invokeTypedIpc<McpMarketplaceIpcContract, 'mcp:marketplace:rollback-version'>(
            'mcp:marketplace:rollback-version',
            [serverId, targetVersion],
            {
            argsSchema: z.tuple([z.string().min(1), z.string().min(1)]),
            responseSchema: SuccessResponseSchema
            }
        )
};
