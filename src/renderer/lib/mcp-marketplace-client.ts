import { IpcValue } from '@shared/types/common';
import { z } from 'zod';

import { invokeTypedIpc, type IpcContractMap } from '@/lib/ipc-client';

const IpcValueSchema = z.custom<IpcValue>();
const SettingsFieldSchema = z.object({
    type: z.enum(['string', 'number', 'integer', 'boolean']).optional(),
    enum: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    title: z.string().optional(),
    description: z.string().optional()
});
const SettingsSchema = z.object({
    type: z.literal('object').optional(),
    properties: z.record(z.string(), SettingsFieldSchema).optional(),
    required: z.array(z.string()).optional()
});
const ServerSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    publisher: z.string().optional(),
    version: z.string().optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    repository: z.string().optional(),
    npmPackage: z.string().optional(),
    license: z.string().optional(),
    downloads: z.number().optional(),
    rating: z.number().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    category: z.string().optional(),
    isOfficial: z.boolean().optional(),
    capabilities: z.array(z.string()).optional(),
    dependencies: z.array(z.string()).optional(),
    conflictsWith: z.array(z.string()).optional(),
    sandbox: z.object({
        enabled: z.boolean().optional(),
        maxMemoryMb: z.number().optional(),
        maxCpuPercent: z.number().optional()
    }).optional(),
    storage: z.object({
        dataPath: z.string().optional(),
        quotaMb: z.number().optional(),
        migrationVersion: z.number().optional()
    }).optional(),
    updatePolicy: z.object({
        channel: z.enum(['stable', 'beta', 'alpha']).optional(),
        autoUpdate: z.boolean().optional(),
        scheduleCron: z.string().optional(),
        signatureSha256: z.string().optional(),
        lastCheckedAt: z.number().optional(),
        lastUpdatedAt: z.number().optional()
    }).optional(),
    settingsSchema: SettingsSchema.optional(),
    settingsValues: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    settingsVersion: z.number().optional(),
    integrityHash: z.string().optional(),
    tools: z.array(z.object({
        name: z.string(),
        description: z.string().optional()
    })).optional()
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
