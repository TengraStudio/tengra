import axios from 'axios';
import { app } from 'electron';
import fs from 'fs-extra';
import path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { MarketplaceRegistry, MarketplaceItem } from '@shared/types/marketplace';

export class MarketplaceService extends BaseService {
    private readonly REGISTRY_URL = 'https://raw.githubusercontent.com/TengraStudio/tengra-market/main/registry.json';
    private readonly USER_THEMES_PATH = path.join(app.getPath('userData'), 'runtime', 'themes');
    private readonly USER_MCP_PATH = path.join(app.getPath('userData'), 'runtime', 'mcp');
    private readonly USER_PERSONAS_PATH = path.join(app.getPath('userData'), 'runtime', 'personas');
    private readonly USER_MODELS_PATH = path.join(app.getPath('userData'), 'runtime', 'models');
    private readonly USER_PROMPTS_PATH = path.join(app.getPath('userData'), 'runtime', 'prompts');

    constructor() {
        super('MarketplaceService');
    }

    async initialize(): Promise<void> {
        appLogger.info('MarketplaceService', 'Initializing Marketplace...');
        await fs.ensureDir(this.USER_THEMES_PATH);
        await fs.ensureDir(this.USER_MCP_PATH);
        await fs.ensureDir(this.USER_PERSONAS_PATH);
        await fs.ensureDir(this.USER_MODELS_PATH);
        await fs.ensureDir(this.USER_PROMPTS_PATH);
    }

    /**
     * GitHub'dan merkezi registry dosyasını çeker.
     */
    async fetchRegistry(): Promise<MarketplaceRegistry> {
        try {
            appLogger.info('MarketplaceService', 'Fetching marketplace registry from GitHub...');
            const response = await axios.get<MarketplaceRegistry>(this.REGISTRY_URL);
            return response.data;
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
                default:
                    throw new Error(`Unsupported item type: ${item.itemType}`);
            }

            const filePath = path.join(targetPath, fileName);
            await fs.writeJson(filePath, response.data, { spaces: 2 });
            
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
}
