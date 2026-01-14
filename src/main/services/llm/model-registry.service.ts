import { appLogger } from '@main/logging/logger'
import { JobSchedulerService } from '@main/services/job-scheduler.service'
import { HuggingFaceService } from '@main/services/llm/huggingface.service'
import { OllamaService } from '@main/services/llm/ollama.service'
import { SettingsService } from '@main/services/settings.service'
import { getErrorMessage } from '@shared/utils/error.util'

export interface ModelProviderInfo {
    id: string
    name: string
    provider: 'ollama' | 'huggingface' | 'openai' | 'anthropic' | 'gemini'
    description?: string
    tags?: string[]
    downloads?: number
    likes?: number
    contextWindow?: number
    parameters?: string
}

export class ModelRegistryService {
    private cachedModels: ModelProviderInfo[] = []
    private lastUpdate: number = 0

    constructor(
        private ollamaService: OllamaService,
        private hfService: HuggingFaceService,
        private jobScheduler: JobSchedulerService,
        private settingsService: SettingsService
    ) {
        this.initializeScheduler()
    }

    private initializeScheduler() {
        this.jobScheduler.registerRecurringJob(
            'model-registry-update',
            async () => {
                await this.updateCache()
            },
            () => {
                // Get interval from settings, default to 1 hour (3600000 ms)
                // User asked for capability to set e.g. 5 minutes.
                // Assuming settings structure has 'modelUpdateInterval' in ms or similar.
                const settings = this.settingsService.getSettings()
                return settings.ai?.modelUpdateInterval || 60 * 60 * 1000
            }
        )
    }

    async init() {
        // Initial load if empty
        if (this.cachedModels.length === 0) {
            appLogger.info('ModelRegistry', 'Initializing model cache...')
            await this.updateCache()
        }
    }

    private async updateCache() {
        appLogger.info('ModelRegistry', 'Updating remote model cache...')
        const limit = 50 // Fetch more for cache
        this.cachedModels = await this.fetchRemoteModels(limit)
        this.lastUpdate = Date.now()
        appLogger.info('ModelRegistry', `Cache updated with ${this.cachedModels.length} models`)
    }

    /**
     * Get cached remote models.
     */
    async getRemoteModels(): Promise<ModelProviderInfo[]> {
        if (this.cachedModels.length === 0) {
            await this.updateCache()
        }
        return this.cachedModels
    }

    getLastUpdate(): number {
        return this.lastUpdate
    }

    /**
     * Aggregates available models from all supported remote sources
     */
    private async fetchRemoteModels(limit: number = 20): Promise<ModelProviderInfo[]> {
        const models: ModelProviderInfo[] = []

        // 1. Fetch from Ollama Library (scraped/static)
        try {
            const ollamaModels = await this.ollamaService.getLibraryModels()
            // Map to unified format
            models.push(...ollamaModels.map(m => ({
                id: `ollama/${m.name}`,
                name: m.name,
                provider: 'ollama' as const,
                description: m.description,
                tags: m.tags,
                downloads: m.pulls ? this.parseCount(m.pulls) : undefined
            })))
        } catch (e) {
            appLogger.error('ModelRegistry', `Failed to fetch Ollama models: ${getErrorMessage(e as Error)}`)
        }

        // 2. Fetch from HuggingFace (GGUF search)
        try {
            const hfModels = await this.hfService.searchModels('', limit)
            models.push(...hfModels.map(m => ({
                id: m.id,
                name: m.name,
                provider: 'huggingface' as const,
                description: m.description,
                tags: m.tags,
                downloads: m.downloads,
                likes: m.likes
            })))
        } catch (e) {
            appLogger.error('ModelRegistry', `Failed to fetch HuggingFace models: ${getErrorMessage(e as Error)}`)
        }

        // Sort by popularity (downloads)
        return models.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    }

    private parseCount(str: string): number {
        const lower = str.toLowerCase().trim()
        let multiplier = 1
        if (lower.endsWith('k')) {multiplier = 1000}
        if (lower.endsWith('m')) {multiplier = 1000000}
        if (lower.endsWith('b')) {multiplier = 1000000000}

        const num = parseFloat(lower.replace(/[kmb]/g, ''))
        return Math.floor(num * multiplier)
    }

    /**
     * Get locally installed models
     */
    async getInstalledModels(): Promise<ModelProviderInfo[]> {
        const installed: ModelProviderInfo[] = []

        // Ollama Local
        if (await this.ollamaService.isAvailable()) {
            const local = await this.ollamaService.getModels()
            installed.push(...local.map(m => ({
                id: `ollama/${m.name}`,
                name: m.name,
                provider: 'ollama' as const,
                description: `Size: ${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB`,
                tags: [m.details?.family || 'llm', m.details?.parameter_size || 'unknown'],
                parameters: m.details?.parameter_size
            })))
        }

        return installed
    }
}
