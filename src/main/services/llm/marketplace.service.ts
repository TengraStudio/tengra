/**
 * Marketplace Service
 * Reads marketplace models from database. Data sync is handled by model-service.
 */

import { BaseService } from '@main/services/base.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { DbMarketplaceModel } from '@shared/types/db-api';

export interface MarketplaceServiceDeps {
    databaseClient: DatabaseClientService;
    jobScheduler: JobSchedulerService;
    processManager: ProcessManagerService;
}

export interface MarketplaceRefreshResult {
    success: boolean;
    count: number;
    error?: string;
}

export interface OllamaMarketplaceModelDetails {
    name: string;
    shortDescription: string;
    longDescriptionHtml: string;
    versions: Array<{
        version: string;
        size: string;
        maxContext: string;
        inputType: string;
        digest: string;
    }>;
}

export interface HuggingFaceMarketplaceModelDetails {
    name: string;
    shortDescription: string;
    longDescriptionMarkdown: string;
}

export type MarketplaceModelDetails =
    | OllamaMarketplaceModelDetails
    | HuggingFaceMarketplaceModelDetails;

export class MarketplaceService extends BaseService {
    private lastScrapeTime: number = 0;

    constructor(private deps: MarketplaceServiceDeps) {
        super('MarketplaceService');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing marketplace service (DB-backed mode)...');
        void this.deps.jobScheduler;
    }

    async getModels(options?: {
        provider?: 'ollama' | 'huggingface';
        limit?: number;
        offset?: number;
    }): Promise<DbMarketplaceModel[]> {
        return this.deps.databaseClient.getMarketplaceModels(options);
    }

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

    async getModelDetails(
        modelName: string,
        provider: 'ollama' | 'huggingface' = 'ollama'
    ): Promise<MarketplaceModelDetails | null> {
        try {
            const response = provider === 'huggingface'
                ? await this.deps.processManager.sendGetRequest<{
                    success: boolean;
                    data?: HuggingFaceMarketplaceModelDetails;
                    error?: string;
                }>(
                    'model-service',
                    `/marketplace/huggingface?modelId=${encodeURIComponent(modelName)}`
                )
                : await this.deps.processManager.sendGetRequest<{
                    success: boolean;
                    data?: OllamaMarketplaceModelDetails;
                    error?: string;
                }>('model-service', `/marketplace/ollama/${encodeURIComponent(modelName)}`);

            if (!response.success || !response.data) {
                return null;
            }

            return response.data;
        } catch {
            return null;
        }
    }

    async refresh(): Promise<MarketplaceRefreshResult> {
        return {
            success: false,
            count: 0,
            error: 'Manual marketplace refresh is disabled; model-service syncs automatically.',
        };
    }

    getLastScrapeTime(): number {
        return this.lastScrapeTime;
    }

    isScrapeInProgress(): boolean {
        return false;
    }
}
