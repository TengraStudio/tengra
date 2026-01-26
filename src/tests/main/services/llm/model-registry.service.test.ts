import { ModelRegistryService } from '@main/services/llm/model-registry.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

    beforeEach(() => {
        vi.clearAllMocks();
        mockProcessManager = {
            startService: vi.fn(),
            sendRequest: vi.fn().mockImplementation((service, payload) => {
                if (payload.provider === 'ollama') {
                    return Promise.resolve({ success: true, models: [{ name: 'llama3', description: 'Meta Llama 3', tags: ['7b'], pulls: '10M', provider: 'ollama' }] });
                }
                if (payload.provider === 'huggingface') {
                    return Promise.resolve({ success: true, models: [{ id: 'TheBloke/Llama-7B-GGUF', name: 'Llama-7B-GGUF', description: 'GGUF', tags: [], downloads: 5000, likes: 10, provider: 'huggingface' }] });
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

        mockProxyService = { getModels: vi.fn().mockResolvedValue({ data: [] }) };
        mockEventBus = { emit: vi.fn() };
        mockAuthService = { getActiveToken: vi.fn().mockResolvedValue('test-token') };
        mockTokenService = { ensureFreshToken: vi.fn().mockResolvedValue(undefined) };

        service = new ModelRegistryService({
            processManager: mockProcessManager as ProcessManagerService,
            jobScheduler: mockScheduler as JobSchedulerService,
            settingsService: mockSettings as SettingsService,
            proxyService: mockProxyService as ProxyService,
            eventBus: mockEventBus as EventBusService,
            authService: mockAuthService as AuthService,
            tokenService: mockTokenService as TokenService
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
            expect(models.length).toBe(1); // only huggingface is fetched in fetchRemoteModels
            expect(mockProcessManager.sendRequest).toHaveBeenCalledTimes(1);
        });

        it('should return cached models on subsequent calls', async () => {
            await service.getRemoteModels()
                ; (mockProcessManager.sendRequest as ReturnType<typeof vi.fn>).mockClear();

            const models = await service.getRemoteModels();
            expect(models.length).toBe(1);
            expect(mockProcessManager.sendRequest).not.toHaveBeenCalled();
        });

        it('should include models with correct provider tags', async () => {
            const models = await service.getRemoteModels();

            const hfModel = models.find(m => m.provider === 'huggingface');
            expect(hfModel).toBeDefined();
            expect(hfModel?.id).toBe('TheBloke/Llama-7B-GGUF');
        });
    });

    describe('getInstalledModels', () => {
        it('should return locally installed models', async () => {
            // Mock installed models from native service 'ollama' call
            (mockProcessManager.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                success: true,
                models: [{ id: 'ollama/llama3:7b', name: 'llama3:7b', provider: 'ollama' }]
            });

            const installed = await service.getInstalledModels();

            expect(installed.length).toBe(1);
            expect(installed[0]!.id).toBe('ollama/llama3:7b');
            expect(installed[0]!.provider).toBe('ollama');
        });

        it('should return empty array if error', async () => {
            (mockProcessManager.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });

            const installed = await service.getInstalledModels();
            expect(installed.length).toBe(0);
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
            (mockProcessManager.sendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'Failed' });

            const models = await service.getRemoteModels();
            expect(models.length).toBe(0);
        });
    });
});
