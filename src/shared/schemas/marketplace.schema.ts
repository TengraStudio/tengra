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
    provider: z.enum(['ollama', 'llama', 'custom']),
});

const marketplacePromptSchema = marketplaceItemBaseSchema.extend({
    itemType: z.literal('prompt'),
    category: z.string().min(1).max(64),
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
}) satisfies z.ZodType<MarketplaceRegistry>;

export const marketplaceInstallRequestSchema = z.object({
    type: z.enum(['theme', 'mcp', 'persona', 'model', 'prompt', 'language']),
    id: z.string().min(1).max(128),
    downloadUrl: z.string().url(),
}) satisfies z.ZodType<InstallRequest>;
