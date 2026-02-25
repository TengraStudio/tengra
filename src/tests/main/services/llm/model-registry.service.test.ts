import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import { ModelRegistryService } from '@main/services/llm/model-registry.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { en } from '../../../../renderer/i18n/en';
import { tr } from '../../../../renderer/i18n/tr';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('ModelRegistryService', () => {
    let service: ModelRegistryService;
    let mockProcessManager: Partial<ProcessManagerService>;
    let mockScheduler: Partial<JobSchedulerService>;
    let mockSettings: Partial<SettingsService>;
    let mockProxyService: Partial<ProxyService>;
    let mockEventBus: Partial<EventBusService>;
    let mockAuthService: Partial<AuthService>;
    let mockTokenService: Partial<TokenService>;
    let mockLocalImageService: Partial<LocalImageService>;
    let mockHuggingFaceService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockProcessManager = {
            startService: vi.fn(),
            sendRequest: vi.fn().mockImplementation((_service, payload) => {
                if (payload.provider === 'ollama') {
                    return Promise.resolve({ success: true, models: [{ name: 'llama3', description: 'Meta Llama 3', tags: ['7b'], pulls: '10M', provider: 'ollama' }] });
                }
                return Promise.resolve({ success: false });
            })
        };

        mockScheduler = {
            registerRecurringJob: vi.fn()
        };
        mockSettings = {
            getSettings: vi.fn().mockReturnValue({ ai: { modelUpdateInterval: 3600000 } })
        };

        mockProxyService = {
            getModels: vi.fn().mockResolvedValue({ data: [] }),
            getEmbeddedProxyStatus: vi.fn().mockReturnValue({ port: 8317 }),
            getProxyKey: vi.fn().mockResolvedValue('proxy-key'),
        };
        mockEventBus = { emit: vi.fn() };
        mockAuthService = { getActiveToken: vi.fn().mockResolvedValue('test-token') };
        mockTokenService = { ensureFreshToken: vi.fn().mockResolvedValue(undefined) };
        mockLocalImageService = { getSDCppStatus: vi.fn().mockResolvedValue('ready') };
        mockHuggingFaceService = {
            searchModels: vi.fn().mockResolvedValue({
                models: [{ id: 'TheBloke/Llama-7B-GGUF', name: 'Llama-7B-GGUF', description: 'GGUF', tags: [], downloads: 5000, likes: 10, author: 'TheBloke', lastModified: 'today' }],
                total: 1
            })
        };

        service = new ModelRegistryService({
            processManager: mockProcessManager as ProcessManagerService,
            jobScheduler: mockScheduler as JobSchedulerService,
            settingsService: mockSettings as SettingsService,
            proxyService: mockProxyService as ProxyService,
            eventBus: mockEventBus as EventBusService,
            authService: mockAuthService as AuthService,
            tokenService: mockTokenService as TokenService,
            localImageService: mockLocalImageService as LocalImageService,
            huggingFaceService: mockHuggingFaceService as HuggingFaceService
        });
    });

    describe('constructor', () => {
        it('should register a recurring job for cache updates', () => {
            expect(mockScheduler.registerRecurringJob).toHaveBeenCalledWith(
                'model-registry-update',
                expect.any(Function),
                expect.any(Function)
            );
        });
    });

    describe('getRemoteModels', () => {
        it('should fetch and cache remote models', async () => {
            const models = await service.getRemoteModels();
            expect(models.length).toBe(1);
            expect(mockHuggingFaceService.searchModels).toHaveBeenCalled();
            expect(service.getHealthMetrics().cacheUpdates).toBe(1);
            expect(mockEventBus.emit).toHaveBeenCalledWith(
                'telemetry:model-registry',
                expect.objectContaining({ name: 'model-registry.cache.update.completed' })
            );
        });

        it('should return cached models on subsequent calls', async () => {
            await service.getRemoteModels();
            vi.mocked(mockHuggingFaceService.searchModels!).mockClear();

            const models = await service.getRemoteModels();
            expect(models.length).toBe(1);
            expect(mockHuggingFaceService.searchModels).not.toHaveBeenCalled();
        });

        it('should include models with correct provider tags', async () => {
            const models = await service.getRemoteModels();

            const hfModel = models.find(m => m.provider === 'huggingface');
            expect(hfModel).toBeDefined();
            expect(hfModel?.id).toBe('TheBloke/Llama-7B-GGUF');
        });

        it('should keep sd-cpp fallback model available in aggregated model list', async () => {
            const models = await service.getAllModels();

            expect(models.some(model => model.provider === 'sd-cpp')).toBe(true);
        });
    });

    describe('getInstalledModels', () => {
        it('should return locally installed models', async () => {
            vi.mocked(mockProcessManager.sendRequest!).mockResolvedValueOnce({
                success: true,
                models: [{ id: 'ollama/llama3:7b', name: 'llama3:7b', provider: 'ollama' }]
            });

            const installed = await service.getInstalledModels();

            expect(installed.length).toBe(1);
            expect(installed[0]!.id).toBe('ollama/llama3:7b');
            expect(installed[0]!.provider).toBe('ollama');
        });

        it('should return empty array if error', async () => {
            vi.mocked(mockProcessManager.sendRequest!).mockResolvedValue({ success: false });

            const installed = await service.getInstalledModels();
            expect(installed.length).toBe(0);
        });

        it('should return empty array when provider request throws', async () => {
            vi.mocked(mockProcessManager.sendRequest!).mockRejectedValueOnce(new Error('native service down'));

            const installed = await service.getInstalledModels();

            expect(installed).toEqual([]);
        });

        it('should return empty array when provider response is malformed', async () => {
            vi.mocked(mockProcessManager.sendRequest!).mockResolvedValueOnce({
                success: true,
                models: [{ id: '', provider: 'ollama' }],
            } as never);

            const installed = await service.getInstalledModels();

            expect(installed).toEqual([]);
        });

        it('should retry once before returning models when transient error occurs', async () => {
            vi.mocked(mockProcessManager.sendRequest!)
                .mockRejectedValueOnce(new Error('temporary failure'))
                .mockResolvedValueOnce({
                    success: true,
                    models: [{ id: 'ollama/llama3:7b', name: 'llama3:7b', provider: 'ollama' }],
                });

            const installed = await service.getInstalledModels();

            expect(installed).toHaveLength(1);
            expect(mockProcessManager.sendRequest).toHaveBeenCalledTimes(2);
        });
    });

    describe('getLastUpdate', () => {
        it('should return 0 before init', () => {
            expect(service.getLastUpdate()).toBe(0);
        });

        it('should return timestamp after fetching models', async () => {
            const before = Date.now();
            await service.getRemoteModels();
            const lastUpdate = service.getLastUpdate();

            expect(lastUpdate).toBeGreaterThanOrEqual(before);
        });
    });

    describe('error handling', () => {
        it('should handle native service errors gracefully', async () => {
            vi.mocked(mockHuggingFaceService.searchModels!).mockRejectedValue(new Error('Failed'));

            const models = await service.getRemoteModels();
            expect(models.length).toBe(0);
        });

        it('should track provider fetch failures in health metrics', async () => {
            vi.mocked(mockProcessManager.sendRequest!).mockRejectedValue(new Error('provider unavailable'));
            await service.getInstalledModels();

            expect(service.getHealthMetrics().providerFetchFailures).toBe(1);
            expect(mockEventBus.emit).toHaveBeenCalledWith(
                'telemetry:model-registry',
                expect.objectContaining({ name: 'model-registry.provider.fetch.failed', provider: 'ollama' })
            );
        });

        it('should expose performance budget, normalized ui state and i18n keys in health metrics', async () => {
            const emptyMetrics = service.getHealthMetrics();
            expect(emptyMetrics.uiState).toBe('empty');
            expect(emptyMetrics.performanceBudget.cacheRefreshMs).toBe(2000);
            expect(en.serviceHealth.modelRegistry.empty).toBe(emptyMetrics.messageKey);
            expect(tr.serviceHealth.modelRegistry.empty).toBeTruthy();

            vi.mocked(mockProcessManager.sendRequest!).mockRejectedValue(new Error('provider unavailable'));
            await service.getInstalledModels();

            const failureMetrics = service.getHealthMetrics();
            expect(failureMetrics.uiState).toBe('failure');
            expect(en.serviceHealth.modelRegistry.failure).toBe(failureMetrics.messageKey);
            expect(tr.serviceHealth.modelRegistry.failure).toBeTruthy();
        });
    });
});
