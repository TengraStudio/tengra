/**
 * IPC handlers for marketplace operations
 */

import { appLogger } from '@main/logging/logger';
import { MarketplaceService } from '@main/services/llm/marketplace.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

const MAX_QUERY_LENGTH = 256;
const MAX_LIMIT = 1000;

/**
 * Validates a search query string
 */
function validateQuery(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > MAX_QUERY_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a provider value
 */
function validateProvider(value: unknown): 'ollama' | 'huggingface' | undefined {
    if (value === 'ollama' || value === 'huggingface') {
        return value;
    }
    return undefined;
}

/**
 * Validates a numeric limit
 */
function validateLimit(value: unknown): number | undefined {
    if (typeof value !== 'number' || value < 1 || value > MAX_LIMIT) {
        return undefined;
    }
    return Math.floor(value);
}

/**
 * Validates a numeric offset
 */
function validateOffset(value: unknown): number | undefined {
    if (typeof value !== 'number' || value < 0) {
        return undefined;
    }
    return Math.floor(value);
}

export interface MarketplaceIpcOptions {
    marketplaceService: MarketplaceService;
    rateLimitService?: RateLimitService;
}

/**
 * Registers IPC handlers for marketplace operations
 */
export function registerMarketplaceIpc(options: MarketplaceIpcOptions): void {
    appLogger.info('MarketplaceIPC', 'Registering Marketplace IPC handlers');
    const { marketplaceService, rateLimitService } = options;

    // Get marketplace models from database
    ipcMain.handle(
        'marketplace:getModels',
        createSafeIpcHandler(
            'marketplace:getModels',
            async (
                _event: IpcMainInvokeEvent,
                providerRaw: unknown,
                limitRaw: unknown,
                offsetRaw: unknown
            ) => {
                if (rateLimitService) {
                    await rateLimitService.waitForToken('mcp:database');
                }
                const provider = validateProvider(providerRaw);
                const limit = validateLimit(limitRaw);
                const offset = validateOffset(offsetRaw);

                return await marketplaceService.getModels({ provider, limit, offset });
            },
            []
        )
    );

    // Search marketplace models in database
    ipcMain.handle(
        'marketplace:searchModels',
        createSafeIpcHandler(
            'marketplace:searchModels',
            async (
                _event: IpcMainInvokeEvent,
                queryRaw: unknown,
                providerRaw: unknown,
                limitRaw: unknown
            ) => {
                if (rateLimitService) {
                    await rateLimitService.waitForToken('mcp:database');
                }
                const query = validateQuery(queryRaw);
                if (!query) {
                    return [];
                }
                const provider = validateProvider(providerRaw);
                const limit = validateLimit(limitRaw);

                return await marketplaceService.searchModels(query, provider, limit);
            },
            []
        )
    );

    ipcMain.handle(
        'marketplace:getModelDetails',
        createSafeIpcHandler(
            'marketplace:getModelDetails',
            async (_event: IpcMainInvokeEvent, modelNameRaw: unknown, providerRaw: unknown) => {
                if (rateLimitService) {
                    await rateLimitService.waitForToken('mcp:internet');
                }
                const modelName = validateQuery(modelNameRaw);
                if (!modelName) {
                    return null;
                }
                const provider = validateProvider(providerRaw) ?? 'ollama';
                return await marketplaceService.getModelDetails(modelName, provider);
            },
            null
        )
    );

    // Get status info
    ipcMain.handle(
        'marketplace:getStatus',
        createSafeIpcHandler(
            'marketplace:getStatus',
            async () => {
                return {
                    lastScrapeTime: marketplaceService.getLastScrapeTime(),
                    isScraping: marketplaceService.isScrapeInProgress(),
                };
            },
            { lastScrapeTime: 0, isScraping: false }
        )
    );
}
