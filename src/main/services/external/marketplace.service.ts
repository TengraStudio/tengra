import path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { LocaleService } from '@main/services/system/locale.service';
import { localePackSchema } from '@shared/schemas/locale.schema';
import { marketplaceRegistrySchema } from '@shared/schemas/marketplace.schema';
import { MarketplaceItem, MarketplaceModel, MarketplaceRegistry } from '@shared/types/marketplace';
import axios from 'axios';
import { app } from 'electron';
import fs from 'fs-extra';
import { z } from 'zod';

interface RemoteModelSourceConfig {
    provider: MarketplaceModel['provider'];
    url: string;
}

interface IndexedModel {
    item: MarketplaceModel;
    order: number;
}

const remoteModelRecordSchema = z.object({
    id: z.string().min(1).max(512),
    slug: z.string().max(512).optional(),
    name: z.string().max(512).optional(),
    description: z.string().max(50000).optional(),
    author: z.string().max(512).optional(),
    version: z.string().max(128).optional(),
    provider: z.enum(['ollama', 'huggingface', 'custom']).optional(),
    sourceUrl: z.string().max(2048).optional(),
    downloadUrl: z.string().max(2048).optional(),
    category: z.string().max(256).optional(),
    pipelineTag: z.string().max(256).optional(),
});

const remoteModelSourceSchema = z.object({
    source: z.enum(['ollama', 'huggingface', 'custom']).optional(),
    models: z.array(z.object({}).passthrough()),
});

export class MarketplaceService extends BaseService {
    private readonly REGISTRY_URL = 'https://raw.githubusercontent.com/TengraStudio/tengra-market/main/registry.json';
    private readonly MARKET_BASE_URL = 'https://raw.githubusercontent.com/TengraStudio/tengra-market/main';
    private readonly MODEL_SOURCES: RemoteModelSourceConfig[] = [
        { provider: 'ollama', url: `${this.MARKET_BASE_URL}/models/ollama-models.json` },
        { provider: 'huggingface', url: `${this.MARKET_BASE_URL}/models/huggingface-models.json` },
        { provider: 'custom', url: `${this.MARKET_BASE_URL}/models/custom-models.json` },
    ];
    private readonly USER_THEMES_PATH = path.join(app.getPath('userData'), 'runtime', 'themes');
    private readonly USER_MCP_PATH = path.join(app.getPath('userData'), 'runtime', 'mcp');
    private readonly USER_PERSONAS_PATH = path.join(app.getPath('userData'), 'runtime', 'personas');
    private readonly USER_MODELS_PATH = path.join(app.getPath('userData'), 'runtime', 'models');
    private readonly USER_PROMPTS_PATH = path.join(app.getPath('userData'), 'runtime', 'prompts');
    private readonly USER_LOCALES_PATH = path.join(app.getPath('userData'), 'runtime', 'locales');
    private readonly USER_SKILLS_PATH = path.join(app.getPath('userData'), 'runtime', 'skills');

    constructor(private readonly localeService?: LocaleService) {
        super('MarketplaceService');
    }

    async initialize(): Promise<void> {
        appLogger.info('MarketplaceService', 'Initializing Marketplace...');
        await fs.ensureDir(this.USER_THEMES_PATH);
        await fs.ensureDir(this.USER_MCP_PATH);
        await fs.ensureDir(this.USER_PERSONAS_PATH);
        await fs.ensureDir(this.USER_MODELS_PATH);
        await fs.ensureDir(this.USER_PROMPTS_PATH);
        await fs.ensureDir(this.USER_LOCALES_PATH);
        await fs.ensureDir(this.USER_SKILLS_PATH);
    }

    /**
     * GitHub'dan merkezi registry dosyasını çeker.
     */
    async fetchRegistry(): Promise<MarketplaceRegistry> {
        try {
            appLogger.info('MarketplaceService', 'Fetching marketplace registry from GitHub...');
            const [response, mergedModels] = await Promise.all([
                axios.get<MarketplaceRegistry>(this.REGISTRY_URL),
                this.fetchMergedModels(),
            ]);
            const baseRegistry = marketplaceRegistrySchema.parse(response.data);
            const registry = marketplaceRegistrySchema.parse({
                ...baseRegistry,
                models: mergedModels,
            } satisfies MarketplaceRegistry);
            return await this.applyInstalledState(registry);
        } catch (error) {
            appLogger.error('MarketplaceService', 'Failed to fetch registry', error as Error);
            throw new Error('Marketplace registry could not be loaded.');
        }
    }

    /**
     * Bir itemı (tema, mcp, persona, model, prompt) GitHub'dan indirip yerel klasöre kaydeder.
     */
    async installItem(item: MarketplaceItem): Promise<{ success: boolean; path: string }> {
        try {
            appLogger.info('MarketplaceService', `Downloading ${item.itemType}: ${item.name}`);
            
            let targetPath = '';
            let fileName = '';
            let payload: RuntimeValue | null = null;
            const sanitizedId = this.sanitizeFileNameStem(item.id);

            switch (item.itemType) {
                case 'theme':
                    targetPath = this.USER_THEMES_PATH;
                    fileName = `${sanitizedId}.theme.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                case 'mcp':
                    targetPath = this.USER_MCP_PATH;
                    fileName = `${sanitizedId}.mcp.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                case 'persona':
                    targetPath = this.USER_PERSONAS_PATH;
                    fileName = `${sanitizedId}.persona.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                case 'model':
                    targetPath = this.USER_MODELS_PATH;
                    fileName = `${sanitizedId}.model.json`;
                    payload = this.buildSafeModelInstallPayload(item);
                    break;
                case 'prompt':
                    targetPath = this.USER_PROMPTS_PATH;
                    fileName = `${sanitizedId}.prompt.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                case 'language':
                    targetPath = this.USER_LOCALES_PATH;
                    fileName = `${sanitizedId}.locale.json`;
                    payload = localePackSchema.parse((await axios.get(item.downloadUrl)).data);
                    break;
                case 'skill':
                    targetPath = this.USER_SKILLS_PATH;
                    fileName = `${sanitizedId}.skill.json`;
                    payload = (await axios.get(item.downloadUrl)).data as RuntimeValue;
                    break;
                default:
                    throw new Error(`Unsupported item type: ${item.itemType}`);
            }

            if (payload === null) {
                throw new Error(`Marketplace payload could not be resolved for item: ${item.id}`);
            }

            const filePath = path.join(targetPath, fileName);
            await fs.writeJson(filePath, payload, { spaces: 2 });
            
            appLogger.info('MarketplaceService', `${item.itemType} installed successfully at: ${filePath}`);
            return { success: true, path: filePath };
        } catch (error) {
            appLogger.error('MarketplaceService', `Failed to install item: ${item.name}`, error as Error);
            throw new Error(`Could not install item: ${item.name}`);
        }
    }

    async dispose(): Promise<void> {
        appLogger.info('MarketplaceService', 'Disposing Marketplace service...');
    }

    private async fetchMergedModels(): Promise<MarketplaceModel[]> {
        const sourceResults = await Promise.all(this.MODEL_SOURCES.map(source => this.fetchModelsFromSource(source)));
        const indexedModels: IndexedModel[] = [];
        for (const models of sourceResults) {
            for (const model of models) {
                indexedModels.push({ item: model, order: indexedModels.length });
            }
        }
        return this.dedupeAndSortModels(indexedModels);
    }

    private async fetchModelsFromSource(source: RemoteModelSourceConfig): Promise<MarketplaceModel[]> {
        try {
            const response = await axios.get(source.url);
            const parsedSource = remoteModelSourceSchema.safeParse(response.data);
            if (!parsedSource.success) {
                appLogger.warn('MarketplaceService', `Model source parse failed for ${source.provider}`, {
                    url: source.url,
                    issues: parsedSource.error.issues.map(issue => issue.message).slice(0, 5),
                });
                return [];
            }
            const validModels: Array<z.infer<typeof remoteModelRecordSchema>> = [];
            let invalidRecords = 0;
            const MAX_MODELS_PER_SOURCE = 5000;
            const totalToProcess = parsedSource.data.models.length;

            for (const item of parsedSource.data.models) {
                if (validModels.length >= MAX_MODELS_PER_SOURCE) {
                    appLogger.info('MarketplaceService', `Truncated model ingestion for ${source.provider} at ${MAX_MODELS_PER_SOURCE} records (Total: ${totalToProcess})`);
                    break;
                }

                const rawModel = item as Record<string, unknown>;
                if (!rawModel.id && typeof rawModel.modelId === 'string' && rawModel.modelId.length > 0) {
                    rawModel.id = rawModel.modelId;
                }

                const parsedModel = remoteModelRecordSchema.safeParse(rawModel);
                if (parsedModel.success) {
                    validModels.push(parsedModel.data);
                } else {
                    invalidRecords++;
                }
            }

            if (invalidRecords > 0) {
                appLogger.info('MarketplaceService', `Skipped ${invalidRecords} invalid model records for ${source.provider} (Likely schema mismatch or incomplete metadata)`, {
                    url: source.url,
                });
            }
            return this.mapRemoteModels(validModels, source.provider);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                // Silently skip if source is not found (e.g. custom-models.json)
                return [];
            }
            appLogger.warn('MarketplaceService', `Model source fetch failed for ${source.provider}`, {
                url: source.url,
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }

    private mapRemoteModels(
        remoteModels: Array<z.infer<typeof remoteModelRecordSchema>>,
        provider: MarketplaceModel['provider']
    ): MarketplaceModel[] {
        const mapped: MarketplaceModel[] = [];
        for (const model of remoteModels) {
            const normalizedProvider = model.provider ?? provider;
            const downloadUrl = this.resolveModelDownloadUrl(model, normalizedProvider);
            if (!downloadUrl) {
                continue;
            }
            const cleanedCategory = this.cleanOptionalText(model.category);
            const cleanedPipelineTag = this.cleanOptionalText(model.pipelineTag);
            const normalizedId = this.normalizeModelId(model, normalizedProvider);
            mapped.push({
                id: normalizedId,
                name: this.normalizeModelName(model, normalizedId),
                description: this.normalizeModelDescription(model, normalizedProvider),
                author: this.normalizeModelAuthor(model, normalizedProvider),
                version: this.normalizeModelVersion(model),
                downloadUrl,
                itemType: 'model',
                provider: normalizedProvider,
                source: provider,
                sourceUrl: this.cleanOptionalUrl(model.sourceUrl),
                category: cleanedCategory ? this.fitToLength(cleanedCategory, 64) : undefined,
                pipelineTag: cleanedPipelineTag ? this.fitToLength(cleanedPipelineTag, 64) : undefined,
            });
        }
        return mapped;
    }

    private resolveModelDownloadUrl(
        model: z.infer<typeof remoteModelRecordSchema>,
        provider: MarketplaceModel['provider']
    ): string | null {
        const directDownloadUrl = this.cleanOptionalUrl(model.downloadUrl);
        if (directDownloadUrl) {
            return directDownloadUrl;
        }
        const sourceUrl = this.cleanOptionalUrl(model.sourceUrl);
        if (sourceUrl) {
            return sourceUrl;
        }
        if (provider === 'ollama') {
            return `https://ollama.com/library/${encodeURIComponent(model.id)}`;
        }
        if (provider === 'huggingface') {
            return `https://huggingface.co/${model.id}`;
        }
        return null;
    }

    private dedupeAndSortModels(indexedModels: IndexedModel[]): MarketplaceModel[] {
        const deduped = new Map<string, IndexedModel>();
        for (const indexedModel of indexedModels) {
            const key = `${indexedModel.item.provider}:${indexedModel.item.id}`;
            if (!deduped.has(key)) {
                deduped.set(key, indexedModel);
            }
        }
        const sorted = Array.from(deduped.values()).sort((left, right) => {
            const nameComparison = left.item.name.localeCompare(right.item.name, undefined, { sensitivity: 'base' });
            if (nameComparison !== 0) {
                return nameComparison;
            }
            const providerComparison = left.item.provider.localeCompare(right.item.provider);
            if (providerComparison !== 0) {
                return providerComparison;
            }
            const idComparison = left.item.id.localeCompare(right.item.id);
            if (idComparison !== 0) {
                return idComparison;
            }
            return left.order - right.order;
        });
        return sorted.map(entry => entry.item);
    }

    private normalizeModelId(
        model: z.infer<typeof remoteModelRecordSchema>,
        provider: MarketplaceModel['provider']
    ): string {
        const candidate = this.cleanOptionalText(model.slug)
            ?? this.cleanOptionalText(model.id)
            ?? `${provider}-model`;
        const safe = candidate
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-|-$/g, '');
        return this.fitToLength(safe.length > 0 ? safe : `${provider}-model`, 128);
    }

    private normalizeModelName(
        model: z.infer<typeof remoteModelRecordSchema>,
        fallbackId: string
    ): string {
        const name = this.cleanOptionalText(model.name) ?? fallbackId;
        return this.fitToLength(name, 128);
    }

    private normalizeModelDescription(
        model: z.infer<typeof remoteModelRecordSchema>,
        provider: MarketplaceModel['provider']
    ): string {
        const description = this.cleanOptionalText(model.description) ?? `Model provided via ${provider}.`;
        return this.fitToLength(description, 280);
    }

    private normalizeModelAuthor(
        model: z.infer<typeof remoteModelRecordSchema>,
        provider: MarketplaceModel['provider']
    ): string {
        const author = this.cleanOptionalText(model.author) ?? this.getDefaultModelAuthor(provider);
        return this.fitToLength(author, 128);
    }

    private normalizeModelVersion(model: z.infer<typeof remoteModelRecordSchema>): string {
        const version = this.cleanOptionalText(model.version) ?? 'latest';
        return this.fitToLength(version, 32);
    }

    private cleanOptionalText(value: string | undefined): string | undefined {
        if (typeof value !== 'string') {
            return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    private fitToLength(value: string, maxLength: number): string {
        return value.length <= maxLength ? value : value.slice(0, maxLength);
    }

    private cleanOptionalUrl(value: string | undefined): string | undefined {
        const cleaned = this.cleanOptionalText(value);
        if (!cleaned) {
            return undefined;
        }
        try {
            const parsed = new URL(cleaned);
            return parsed.toString();
        } catch {
            return undefined;
        }
    }

    private getDefaultModelAuthor(provider: MarketplaceModel['provider']): string {
        if (provider === 'ollama') {
            return 'Ollama';
        }
        if (provider === 'huggingface') {
            return 'Hugging Face';
        }
        return 'Custom';
    }

    private sanitizeFileNameStem(id: string): string {
        const sanitized = id
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-|-$/g, '');
        const normalized = sanitized.length > 0 ? sanitized : 'item';
        return this.fitToLength(normalized, 120);
    }

    private buildSafeModelInstallPayload(item: MarketplaceItem): MarketplaceModel {
        const modelItem = item as Partial<MarketplaceModel>;
        const provider = modelItem.provider ?? 'custom';
        const sourceUrl = this.cleanOptionalUrl(modelItem.sourceUrl);
        const downloadUrl = this.cleanOptionalUrl(item.downloadUrl);
        if (!downloadUrl) {
            throw new Error(`Invalid model download URL for ${item.id}`);
        }
        return {
            id: this.fitToLength(item.id.trim(), 128),
            name: this.fitToLength(item.name.trim(), 128),
            description: this.fitToLength(item.description.trim(), 280),
            author: this.fitToLength(item.author.trim(), 128),
            version: this.fitToLength(item.version.trim(), 32),
            downloadUrl,
            itemType: 'model',
            provider,
            source: modelItem.source,
            sourceUrl,
            category: this.cleanOptionalText(modelItem.category)?.slice(0, 64),
            pipelineTag: this.cleanOptionalText(modelItem.pipelineTag)?.slice(0, 64),
            installed: item.installed,
            installedVersion: item.installedVersion,
        };
    }

    private async applyInstalledState(registry: MarketplaceRegistry): Promise<MarketplaceRegistry> {
        const installedVersions = await this.readInstalledVersions();
        return {
            ...registry,
            themes: this.annotateInstalledItems(registry.themes, installedVersions.theme),
            mcp: this.annotateInstalledItems(registry.mcp, installedVersions.mcp),
            personas: this.annotateInstalledItems(registry.personas ?? [], installedVersions.persona),
            models: this.annotateInstalledItems(registry.models ?? [], installedVersions.model),
            prompts: this.annotateInstalledItems(registry.prompts ?? [], installedVersions.prompt),
            languages: this.annotateInstalledItems(registry.languages ?? [], installedVersions.language),
            skills: this.annotateInstalledItems(registry.skills ?? [], installedVersions.skill),
        };
    }

    private annotateInstalledItems<T extends MarketplaceItem>(
        items: T[],
        installedById: Map<string, string>
    ): T[] {
        return items.map(item => ({
            ...item,
            installed: installedById.has(item.id),
            installedVersion: installedById.get(item.id),
        }));
    }

    private async readInstalledVersions(): Promise<Record<MarketplaceItem['itemType'], Map<string, string>>> {
        const localeVersions = this.localeService
            ? await this.readLocaleVersions()
            : new Map<string, string>();

        return {
            theme: await this.readVersionsFromDirectory(this.USER_THEMES_PATH, '.theme.json'),
            mcp: await this.readVersionsFromDirectory(this.USER_MCP_PATH, '.mcp.json'),
            persona: await this.readVersionsFromDirectory(this.USER_PERSONAS_PATH, '.persona.json'),
            model: await this.readVersionsFromDirectory(this.USER_MODELS_PATH, '.model.json'),
            prompt: await this.readVersionsFromDirectory(this.USER_PROMPTS_PATH, '.prompt.json'),
            language: localeVersions,
            skill: await this.readVersionsFromDirectory(this.USER_SKILLS_PATH, '.skill.json'),
        };
    }

    private async readLocaleVersions(): Promise<Map<string, string>> {
        if (!this.localeService) {
            return new Map<string, string>();
        }

        const localePacks = await this.localeService.getAllLocalePacks();
        const versions = new Map<string, string>();
        for (const localePack of localePacks) {
            versions.set(localePack.id, localePack.version);
        }
        return versions;
    }

    private async readVersionsFromDirectory(directory: string, suffix: string): Promise<Map<string, string>> {
        const versions = new Map<string, string>();
        const files = await fs.readdir(directory);

        for (const fileName of files) {
            if (!fileName.endsWith(suffix)) {
                continue;
            }

            const filePath = path.join(directory, fileName);
            try {
                const content = await fs.readJson(filePath) as Partial<MarketplaceItem>;
                const id = typeof content.id === 'string' ? content.id : fileName.slice(0, -suffix.length);
                const version = typeof content.version === 'string' ? content.version : '0.0.0';
                versions.set(id, version);
            } catch (error) {
                appLogger.warn('MarketplaceService', `Failed to inspect installed marketplace item: ${fileName}`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return versions;
    }
}
