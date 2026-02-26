/**
 * Marketplace Service
 * Reads marketplace models from database. Data sync is handled by website backend.
 */

import { BaseService } from '@main/services/base.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { DbMarketplaceModel } from '@shared/types/db-api';

export interface MarketplaceServiceDeps {
    databaseClient: DatabaseClientService;
    jobScheduler: JobSchedulerService;
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
        _modelName: string,
        _provider: 'ollama' | 'huggingface' = 'ollama'
    ): Promise<MarketplaceModelDetails | null> {
        return null;
    }

    async refresh(): Promise<MarketplaceRefreshResult> {
        return {
            success: false,
            count: 0,
            error: 'Manual marketplace refresh is disabled; website backend syncs automatically.',
        };
    }

    getLastScrapeTime(): number {
        return this.lastScrapeTime;
    }

    isScrapeInProgress(): boolean {
        return false;
    }
}
