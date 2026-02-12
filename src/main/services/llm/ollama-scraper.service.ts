/**
 * Ollama Library Scraper Service
 * Scrapes model information from ollama.com/library
 */

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

export interface OllamaScrapedModel {
    name: string
    pulls: string
    tagCount: number
    lastUpdated: string
    categories: string[]
}

export interface OllamaModelDetails {
    name: string
    shortDescription: string
    longDescriptionHtml: string
    versions: OllamaModelVersion[]
}

export interface OllamaModelVersion {
    name: string
    size: string
    context: string
    inputTypes: string[]
}

interface ScraperCache {
    models: OllamaScrapedModel[]
    timestamp: number
}

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 10000;
const MAX_CONCURRENT_REQUESTS = 3;

export class OllamaScraperService extends BaseService {
    private cache: ScraperCache | null = null;
    private modelDetailsCache: Map<string, { data: OllamaModelDetails; timestamp: number }> = new Map();

    constructor() {
        super('OllamaScraperService');
    }

    /**
     * Fetches and parses the model list from ollama.com/library
     */
    async getLibraryModels(bypassCache = false): Promise<OllamaScrapedModel[]> {
        // Return cached if fresh
        if (!bypassCache && this.cache && Date.now() - this.cache.timestamp < CACHE_DURATION_MS) {
            appLogger.debug('OllamaScraperService', 'Returning cached library models');
            return this.cache.models;
        }

        try {
            appLogger.info('OllamaScraperService', 'Fetching library models from ollama.com');
            const models: OllamaScrapedModel[] = [];
            let page = 1;
            let hasMore = true;

            // Paginate through all pages
            while (hasMore) {
                const pageModels = await this.fetchLibraryPage(page);
                if (pageModels.length === 0) {
                    hasMore = false;
                } else {
                    models.push(...pageModels);
                    page++;
                    // Safety limit
                    if (page > 50) {
                        appLogger.warn('OllamaScraperService', 'Reached page limit, stopping pagination');
                        break;
                    }
                }
            }

            // Update cache
            this.cache = { models, timestamp: Date.now() };
            appLogger.info('OllamaScraperService', `Fetched ${models.length} models from library`);

            return models;
        } catch (error) {
            appLogger.error('OllamaScraperService', `Failed to fetch library: ${getErrorMessage(error as Error)}`);
            // Return cached data if available, even if stale
            if (this.cache) {
                return this.cache.models;
            }
            return [];
        }
    }

    /**
     * Fetches a single page from the library
     */
    private async fetchLibraryPage(page: number): Promise<OllamaScrapedModel[]> {
        const url = page === 1
            ? 'https://ollama.com/library'
            : `https://ollama.com/library?p=${page}`;

        const response = await axios.get(url, {
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const $ = cheerio.load(response.data);
        const models: OllamaScrapedModel[] = [];

        // Find the model list - using the structure from the page
        const modelItems = $('#repo ul li a').toArray();

        for (const item of modelItems) {
            try {
                const $item = $(item);

                // Model name - from h2 > div > span
                const name = $item.find('h2 div span').first().text().trim();
                if (!name) { continue; }

                // Pull count - from the first span with pull info
                const pullsText = $item.find('[x-test-pull-count]').text().trim() ||
                                  $item.find('p span span').first().text().trim();

                // Tag count - second span group
                const tagCountText = $item.find('p span').eq(1).find('span').first().text().trim();
                const tagCount = parseInt(tagCountText, 10) || 0;

                // Last updated - third span group
                const lastUpdated = $item.find('p span').eq(2).find('span').last().text().trim();

                // Categories - only spans with x-test-capability attribute
                const categories: string[] = [];
                $item.find('[x-test-capability]').each((_: number, el: Element) => {
                    const cat = $(el).text().trim();
                    if (cat) { categories.push(cat); }
                });

                models.push({
                    name,
                    pulls: pullsText,
                    tagCount,
                    lastUpdated,
                    categories
                });
            } catch (err) {
                appLogger.debug('OllamaScraperService', `Failed to parse model item: ${getErrorMessage(err as Error)}`);
            }
        }

        return models;
    }

    /**
     * Fetches detailed information for a specific model
     */
    async getModelDetails(modelName: string, bypassCache = false): Promise<OllamaModelDetails | null> {
        // Check cache
        const cached = this.modelDetailsCache.get(modelName);
        if (!bypassCache && cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
            return cached.data;
        }

        try {
            appLogger.info('OllamaScraperService', `Fetching details for model: ${modelName}`);

            // Fetch main page and tags page in parallel
            const [mainPageResponse, tagsPageResponse] = await Promise.all([
                axios.get(`https://ollama.com/library/${modelName}`, {
                    timeout: REQUEST_TIMEOUT_MS,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml'
                    }
                }),
                axios.get(`https://ollama.com/library/${modelName}/tags`, {
                    timeout: REQUEST_TIMEOUT_MS,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml'
                    }
                }).catch(() => null) // Tags page might not exist
            ]);

            const $main = cheerio.load(mainPageResponse.data);

            // Short description
            const shortDescription = $main('#summary-content').text().trim();

            // Long description HTML - find the markdown content section
            const longDescriptionHtml = $main('article').html() ||
                                        $main('.prose').html() ||
                                        $main('[class*="markdown"]').html() || '';

            // Parse versions from tags page
            const versions: OllamaModelVersion[] = [];
            if (tagsPageResponse) {
                const $tags = cheerio.load(tagsPageResponse.data);

                // Find version containers
                $tags('section div div div').each((_: number, versionDiv: Element) => {
                    const $version = $tags(versionDiv);

                    // Version name - from span > a
                    const versionName = $version.find('span a').first().text().trim();
                    if (!versionName) { return; }

                    // Size - first p element
                    const size = $version.find('p').eq(0).text().trim();

                    // Context - second p element
                    const context = $version.find('p').eq(1).text().trim();

                    // Input types - from div with icons/badges
                    const inputTypes: string[] = [];
                    $version.find('div span, div svg').each((_idx: number, inputEl: Element) => {
                        const title = $tags(inputEl).attr('title') || $tags(inputEl).text().trim();
                        if (title && !inputTypes.includes(title)) {
                            inputTypes.push(title);
                        }
                    });

                    versions.push({
                        name: versionName,
                        size,
                        context,
                        inputTypes
                    });
                });
            }

            const details: OllamaModelDetails = {
                name: modelName,
                shortDescription,
                longDescriptionHtml,
                versions
            };

            // Cache the result
            this.modelDetailsCache.set(modelName, { data: details, timestamp: Date.now() });

            return details;
        } catch (error) {
            appLogger.error('OllamaScraperService', `Failed to fetch model details: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    /**
     * Fetches details for multiple models in parallel with rate limiting
     */
    async getMultipleModelDetails(modelNames: string[]): Promise<Map<string, OllamaModelDetails>> {
        const results = new Map<string, OllamaModelDetails>();

        // Process in batches to avoid overwhelming the server
        for (let i = 0; i < modelNames.length; i += MAX_CONCURRENT_REQUESTS) {
            const batch = modelNames.slice(i, i + MAX_CONCURRENT_REQUESTS);
            const batchResults = await Promise.all(
                batch.map(name => this.getModelDetails(name))
            );

            batchResults.forEach((details, idx) => {
                if (details) {
                    results.set(batch[idx], details);
                }
            });

            // Small delay between batches
            if (i + MAX_CONCURRENT_REQUESTS < modelNames.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        return results;
    }

    /**
     * Clears all caches
     */
    clearCache(): void {
        this.cache = null;
        this.modelDetailsCache.clear();
        appLogger.info('OllamaScraperService', 'Cache cleared');
    }
}
