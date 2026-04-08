import { localePackManifestSchema } from '@shared/schemas/locale.schema';
import type {
    InstallRequest,
    MarketplaceLanguage,
    MarketplaceRegistry,
    MarketplaceRuntimeProfile} from '@shared/types/marketplace';
import { z } from 'zod';

const marketplaceItemBaseSchema = z.object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(128),
    description: z.string().min(1).max(1024),
    author: z.string().min(1).max(128),
    version: z.string().min(1).max(32),
    downloadUrl: z.string().url(),
    previewUrl: z.string().url().optional(),
    installed: z.boolean().optional(),
    installedVersion: z.string().min(1).max(32).optional(),
});

export const marketplaceLanguageSchema = marketplaceItemBaseSchema.extend({
    itemType: z.literal('language'),
    locale: localePackManifestSchema.shape.locale,
    nativeName: localePackManifestSchema.shape.nativeName,
    rtl: z.boolean().optional(),
    coverage: z.number().min(0).max(100).optional(),
    schemaVersion: localePackManifestSchema.shape.schemaVersion,
}) satisfies z.ZodType<MarketplaceLanguage>;

const marketplaceThemeSchema = marketplaceItemBaseSchema.extend({
    itemType: z.literal('theme'),
    appearance: z.enum(['dark', 'light']),
    previewColor: z.string().optional(),
});

const marketplaceMcpSchema = marketplaceItemBaseSchema.extend({
    itemType: z.literal('mcp'),
    category: z.string().min(1).max(64),
    command: z.string().min(1).max(512),
    args: z.array(z.string().max(1024)).max(50),
    entrypointUrl: z.string().url().optional(),
    entrypointFile: z.string().min(1).max(128).optional(),
    env: z.record(z.string(), z.string()).optional(),
    permissionProfile: z.enum(['read-only', 'workspace-only', 'network-enabled', 'destructive', 'full-access']).optional(),
    tools: z.array(z.object({
        name: z.string().min(1).max(128),
        description: z.string().min(1).max(512),
    })).optional(),
    storage: z.object({
        dataPath: z.string().min(1).max(256).optional(),
        quotaMb: z.number().int().min(1).max(2048).optional(),
        migrationVersion: z.number().int().min(1).max(100).optional(),
    }).optional(),
    capabilities: z.array(z.string().min(1).max(64)).optional(),
});

const marketplacePersonaSchema = marketplaceItemBaseSchema.extend({
    itemType: z.literal('persona'),
    context: z.string().min(1),
});

const marketplaceModelSchema = marketplaceItemBaseSchema.extend({
    itemType: z.literal('model'),
    parameters: z.string().optional(),
    provider: z.enum(['ollama', 'huggingface', 'custom']),
    source: z.enum(['ollama', 'huggingface', 'custom']).optional(),
    sourceUrl: z.string().url().optional(),
    category: z.string().min(1).max(64).optional(),
    pipelineTag: z.string().min(1).max(64).optional(),
    downloads: z.number().int().min(0).optional(),
    pullCount: z.number().int().min(0).optional(),
    likes: z.number().int().min(0).optional(),
    readme: z.string().optional(),
    totalSize: z.string().max(64).optional(),
    submodels: z.array(z.object({
        id: z.string(),
        name: z.string(),
        size: z.string().optional(),
        modelSize: z.string().optional(),
        tensorType: z.string().optional(),
        contextWindow: z.string().optional(),
        inputType: z.string().optional(),
        downloadUrl: z.string().url().optional(),
        installed: z.boolean().optional(),
    })).optional(),
});

const marketplaceRuntimeProfileSchema = z.object({
    system: z.object({
        platform: z.string().min(1).max(64),
        arch: z.string().min(1).max(32),
        cpuCores: z.number().int().min(1),
        cpuLoadPercent: z.number().min(0).max(100),
        totalMemoryBytes: z.number().int().min(0),
        freeMemoryBytes: z.number().int().min(0),
        storageTotalBytes: z.number().int().min(0),
        storageFreeBytes: z.number().int().min(0),
        storageUsedBytes: z.number().int().min(0),
        storageUsagePercent: z.number().min(0).max(100),
    }),
    gpu: z.object({
        available: z.boolean(),
        source: z.enum(['electron', 'llama', 'ollama', 'combined', 'none']),
        name: z.string().min(1).max(128).optional(),
        backends: z.array(z.string().min(1).max(32)),
        devices: z.array(z.object({
            index: z.number().int().min(0),
            name: z.string().min(1).max(128),
            vendorId: z.number().int().min(0).optional(),
            deviceId: z.number().int().min(0).optional(),
            vendorString: z.string().min(1).max(128).optional(),
            deviceString: z.string().min(1).max(128).optional(),
            driverVendor: z.string().min(1).max(128).optional(),
            driverVersion: z.string().min(1).max(128).optional(),
            active: z.boolean().optional(),
            backend: z.string().min(1).max(64).optional(),
            memoryBytes: z.number().int().min(0).optional(),
            memoryUsedBytes: z.number().int().min(0).optional(),
        })),
        vramBytes: z.number().int().min(0).optional(),
        vramUsedBytes: z.number().int().min(0).optional(),
        totalVramBytes: z.number().int().min(0).optional(),
        totalVramUsedBytes: z.number().int().min(0).optional(),
    }),
    performance: z.object({
        rssBytes: z.number().int().min(0),
        heapUsedBytes: z.number().int().min(0),
        processCount: z.number().int().min(0),
        alertCount: z.number().int().min(0),
    }),
}) satisfies z.ZodType<MarketplaceRuntimeProfile>;

const marketplacePromptSchema = marketplaceItemBaseSchema.extend({
    itemType: z.literal('prompt'),
    category: z.string().min(1).max(64),
});

const marketplaceSkillSchema = marketplaceItemBaseSchema.extend({
    itemType: z.literal('skill'),
    provider: z.string().min(1).max(128).optional(),
    content: z.string().min(1).optional(),
    enabled_by_default: z.boolean().optional(),
});

export const marketplaceRegistrySchema = z.object({
    version: z.string().min(1).max(32),
    lastUpdated: z.string().datetime(),
    themes: z.array(marketplaceThemeSchema),
    mcp: z.array(marketplaceMcpSchema),
    personas: z.array(marketplacePersonaSchema).optional(),
    models: z.array(marketplaceModelSchema).optional(),
    prompts: z.array(marketplacePromptSchema).optional(),
    languages: z.array(marketplaceLanguageSchema).optional(),
    skills: z.array(marketplaceSkillSchema).optional(),
}) satisfies z.ZodType<MarketplaceRegistry>;

export const marketplaceInstallRequestSchema = z.object({
    type: z.enum(['theme', 'mcp', 'persona', 'model', 'prompt', 'language', 'skill']),
    id: z.string().min(1).max(128),
    downloadUrl: z.string().url(),
    provider: z.enum(['ollama', 'huggingface', 'custom']).optional(),
    sourceUrl: z.string().url().optional(),
    category: z.string().min(1).max(64).optional(),
    pipelineTag: z.string().min(1).max(64).optional(),
    name: z.string().min(1).max(128).optional(),
    description: z.string().min(1).max(1024).optional(),
    author: z.string().min(1).max(128).optional(),
    version: z.string().min(1).max(32).optional(),
}) satisfies z.ZodType<InstallRequest>;

export const marketplaceRuntimeProfileResponseSchema = marketplaceRuntimeProfileSchema;
