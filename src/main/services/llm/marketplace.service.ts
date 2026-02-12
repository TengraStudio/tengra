/**
 * Marketplace Service
 * Coordinates scraping models from Ollama/HuggingFace and storing in database
 */

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { OllamaModelDetails, OllamaScrapedModel,OllamaScraperService } from '@main/services/llm/ollama-scraper.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { DbMarketplaceModel } from '@shared/types/db-api';
import { getErrorMessage } from '@shared/utils/error.util';

export interface MarketplaceServiceDeps {
    databaseClient: DatabaseClientService;
    ollamaScraper: OllamaScraperService;
    jobScheduler: JobSchedulerService;
}

export class MarketplaceService extends BaseService {
    private lastScrapeTime: number = 0;
    private isScraping = false;

    constructor(private deps: MarketplaceServiceDeps) {
        super('MarketplaceService');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing marketplace service...');

        // Schedule weekly scrape (Sundays at 03:00)
        this.deps.jobScheduler.registerRecurringJob(
            'marketplace-scrape',
            async () => {
                await this.scrapeAndStore();
            },
            () => 7 * 24 * 60 * 60 * 1000 // 7 days
        );

        // Do initial scrape if database is empty
        const existingModels = await this.deps.databaseClient.getMarketplaceModels({ limit: 1 });
        if (existingModels.length === 0) {
            this.logInfo('Database empty, triggering initial scrape');
            // Run async to not block initialization
            this.scrapeAndStore().catch(err => {
                this.logError('Initial scrape failed', err);
            });
        }
    }

    /**
     * Get marketplace models from database
     */
    async getModels(options?: {
        provider?: 'ollama' | 'huggingface';
        limit?: number;
        offset?: number;
    }): Promise<DbMarketplaceModel[]> {
        return this.deps.databaseClient.getMarketplaceModels(options);
    }

    /**
     * Get detailed information for a specific model from scavenger/scraper
     */
    async getModelDetails(modelName: string): Promise<OllamaModelDetails | null> {
        return this.deps.ollamaScraper.getModelDetails(modelName);
    }

    /**
     * Search marketplace models in database
     */
    async searchModels(
        query: string,
        provider?: 'ollama' | 'huggingface',
        limit?: number
    ): Promise<DbMarketplaceModel[]> {
        return this.deps.databaseClient.searchMarketplaceModels({
            query,
            provider,
            limit,
        });
    }

    /**
     * Force refresh - scrape and store new data
     */
    async refresh(): Promise<{ success: boolean; count: number; error?: string }> {
        return this.scrapeAndStore();
    }

    /**
     * Get the last scrape timestamp
     */
    getLastScrapeTime(): number {
        return this.lastScrapeTime;
    }

    /**
     * Check if a scrape is in progress
     */
    isScrapeInProgress(): boolean {
        return this.isScraping;
    }

    /**
     * Scrape models and store in database
     */
    private async scrapeAndStore(): Promise<{ success: boolean; count: number; error?: string }> {
        if (this.isScraping) {
            return { success: false, count: 0, error: 'Scrape already in progress' };
        }

        this.isScraping = true;
        try {
            this.logInfo('Starting marketplace scrape...');

            // Scrape Ollama models
            const ollamaModels = await this.deps.ollamaScraper.getLibraryModels(true);
            this.logInfo(`Scraped ${ollamaModels.length} Ollama models`);

            // Convert to database format
            const dbModels = ollamaModels.map(model => this.convertOllamaModel(model));

            // Store in database
            const result = await this.deps.databaseClient.upsertMarketplaceModels({
                models: dbModels,
            });

            if (result.success) {
                this.lastScrapeTime = Date.now();
                this.logInfo(`Stored ${result.count} models in database`);
            } else {
                this.logError('Failed to store models', result.error);
            }

            return result;
        } catch (error) {
            const errorMsg = getErrorMessage(error);
            appLogger.error('MarketplaceService', `Scrape failed: ${errorMsg}`);
            return { success: false, count: 0, error: errorMsg };
        } finally {
            this.isScraping = false;
        }
    }

    /**
     * Convert scraped Ollama model to database format
     */
    private convertOllamaModel(
        model: OllamaScrapedModel
    ): Omit<DbMarketplaceModel, 'createdAt' | 'updatedAt'> {
        return {
            id: `ollama:${model.name}`,
            name: model.name,
            provider: 'ollama',
            pulls: model.pulls,
            tagCount: model.tagCount,
            lastUpdated: model.lastUpdated,
            categories: model.categories,
        };
    }
}
