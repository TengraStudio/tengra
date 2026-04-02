import path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { LocaleService } from '@main/services/system/locale.service';
import { localePackSchema } from '@shared/schemas/locale.schema';
import { marketplaceRegistrySchema } from '@shared/schemas/marketplace.schema';
import { MarketplaceItem, MarketplaceRegistry } from '@shared/types/marketplace';
import axios from 'axios';
import { app } from 'electron';
import fs from 'fs-extra';

export class MarketplaceService extends BaseService {
    private readonly REGISTRY_URL = 'https://raw.githubusercontent.com/TengraStudio/tengra-market/main/registry.json';
    private readonly USER_THEMES_PATH = path.join(app.getPath('userData'), 'runtime', 'themes');
    private readonly USER_MCP_PATH = path.join(app.getPath('userData'), 'runtime', 'mcp');
    private readonly USER_PERSONAS_PATH = path.join(app.getPath('userData'), 'runtime', 'personas');
    private readonly USER_MODELS_PATH = path.join(app.getPath('userData'), 'runtime', 'models');
    private readonly USER_PROMPTS_PATH = path.join(app.getPath('userData'), 'runtime', 'prompts');
    private readonly USER_LOCALES_PATH = path.join(app.getPath('userData'), 'runtime', 'locales');

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
    }

    /**
     * GitHub'dan merkezi registry dosyasını çeker.
     */
    async fetchRegistry(): Promise<MarketplaceRegistry> {
        try {
            appLogger.info('MarketplaceService', 'Fetching marketplace registry from GitHub...');
            const response = await axios.get<MarketplaceRegistry>(this.REGISTRY_URL);
            const registry = marketplaceRegistrySchema.parse(response.data);
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
            const response = await axios.get(item.downloadUrl);
            
            let targetPath = '';
            let fileName = '';
            let payload = response.data as RuntimeValue;

            switch (item.itemType) {
                case 'theme':
                    targetPath = this.USER_THEMES_PATH;
                    fileName = `${item.id}.theme.json`;
                    break;
                case 'mcp':
                    targetPath = this.USER_MCP_PATH;
                    fileName = `${item.id}.mcp.json`;
                    break;
                case 'persona':
                    targetPath = this.USER_PERSONAS_PATH;
                    fileName = `${item.id}.persona.json`;
                    break;
                case 'model':
                    targetPath = this.USER_MODELS_PATH;
                    fileName = `${item.id}.model.json`;
                    break;
                case 'prompt':
                    targetPath = this.USER_PROMPTS_PATH;
                    fileName = `${item.id}.prompt.json`;
                    break;
                case 'language':
                    targetPath = this.USER_LOCALES_PATH;
                    fileName = `${item.id}.locale.json`;
                    payload = localePackSchema.parse(response.data);
                    break;
                default:
                    throw new Error(`Unsupported item type: ${item.itemType}`);
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
