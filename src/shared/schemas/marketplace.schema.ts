import { localePackManifestSchema } from '@shared/schemas/locale.schema';
import type {
    InstallRequest,
    MarketplaceLanguage,
    MarketplaceRegistry
} from '@shared/types/marketplace';
import { z } from 'zod';

const marketplaceItemBaseSchema = z.object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(128),
    description: z.string().min(1).max(280),
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
});

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
    description: z.string().min(1).max(280).optional(),
    author: z.string().min(1).max(128).optional(),
    version: z.string().min(1).max(32).optional(),
}) satisfies z.ZodType<InstallRequest>;
