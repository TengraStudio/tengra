import { HuggingFaceService } from '@main/services/llm/huggingface.service'
import { ModelRegistryService } from '@main/services/llm/model-registry.service'
import { OllamaService } from '@main/services/llm/ollama.service'
import { JobSchedulerService } from '@main/services/system/job-scheduler.service'
import { SettingsService } from '@main/services/system/settings.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

describe('ModelRegistryService', () => {
    let service: ModelRegistryService
    let mockOllama: Partial<OllamaService>
    let mockHF: Partial<HuggingFaceService>
    let mockScheduler: Partial<JobSchedulerService>
    let mockSettings: Partial<SettingsService>

    beforeEach(() => {
        vi.clearAllMocks()
        mockOllama = {
            getLibraryModels: vi.fn().mockResolvedValue([
                { name: 'llama3', description: 'Meta Llama 3', tags: ['7b'], pulls: '10M' }
            ]),
            getModels: vi.fn().mockResolvedValue([
                { name: 'llama3:7b', size: 3_800_000_000, details: { family: 'llama', parameter_size: '7B' } }
            ]),
            isAvailable: vi.fn().mockResolvedValue(true)
        }
        mockHF = {
            searchModels: vi.fn().mockResolvedValue([
                { id: 'TheBloke/Llama-7B-GGUF', name: 'Llama-7B-GGUF', description: 'GGUF', tags: [], downloads: 5000, likes: 10 }
            ])
        }
        mockScheduler = {
            registerRecurringJob: vi.fn()
        }
        mockSettings = {
            getSettings: vi.fn().mockReturnValue({ ai: { modelUpdateInterval: 3600000 } })
        }

        service = new ModelRegistryService(
            mockOllama as OllamaService,
            mockHF as HuggingFaceService,
            mockScheduler as JobSchedulerService,
            mockSettings as SettingsService
        )
    })

    describe('constructor', () => {
        it('should register a recurring job for cache updates', () => {
            expect(mockScheduler.registerRecurringJob).toHaveBeenCalledWith(
                'model-registry-update',
                expect.any(Function),
                expect.any(Function)
            )
        })
    })

    describe('getRemoteModels', () => {
        it('should fetch and cache remote models', async () => {
            const models = await service.getRemoteModels()
            expect(models.length).toBe(2) // 1 ollama + 1 huggingface
            expect(mockOllama.getLibraryModels).toHaveBeenCalled()
            expect(mockHF.searchModels).toHaveBeenCalled()
        })

        it('should return cached models on subsequent calls', async () => {
            await service.getRemoteModels()
                ; (mockOllama.getLibraryModels as ReturnType<typeof vi.fn>).mockClear()
                ; (mockHF.searchModels as ReturnType<typeof vi.fn>).mockClear()

            const models = await service.getRemoteModels()
            expect(models.length).toBe(2)
            expect(mockOllama.getLibraryModels).not.toHaveBeenCalled()
            expect(mockHF.searchModels).not.toHaveBeenCalled()
        })

        it('should include models with correct provider tags', async () => {
            const models = await service.getRemoteModels()

            const ollamaModel = models.find(m => m.provider === 'ollama')
            expect(ollamaModel).toBeDefined()
            expect(ollamaModel?.id).toBe('ollama/llama3')

            const hfModel = models.find(m => m.provider === 'huggingface')
            expect(hfModel).toBeDefined()
            expect(hfModel?.id).toBe('TheBloke/Llama-7B-GGUF')
        })
    })

    describe('getInstalledModels', () => {
        it('should return locally installed models', async () => {
            const installed = await service.getInstalledModels()

            expect(installed.length).toBe(1)
            expect(installed[0].id).toBe('ollama/llama3:7b')
            expect(installed[0].provider).toBe('ollama')
        })

        it('should return empty array if ollama not available', async () => {
            (mockOllama.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false)

            const installed = await service.getInstalledModels()
            expect(installed.length).toBe(0)
        })
    })

    describe('getLastUpdate', () => {
        it('should return 0 before init', () => {
            expect(service.getLastUpdate()).toBe(0)
        })

        it('should return timestamp after fetching models', async () => {
            const before = Date.now()
            await service.getRemoteModels()
            const lastUpdate = service.getLastUpdate()

            expect(lastUpdate).toBeGreaterThanOrEqual(before)
        })
    })

    describe('error handling', () => {
        it('should handle ollama errors gracefully', async () => {
            (mockOllama.getLibraryModels as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

            const models = await service.getRemoteModels()
            expect(models.length).toBe(1) // Only huggingface
            expect(models[0].provider).toBe('huggingface')
        })

        it('should handle huggingface errors gracefully', async () => {
            (mockHF.searchModels as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

            const models = await service.getRemoteModels()
            expect(models.length).toBe(1) // Only ollama
            expect(models[0].provider).toBe('ollama')
        })
    })
})
