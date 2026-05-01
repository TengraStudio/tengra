/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import { ModelRegistryService } from '@main/services/llm/model-registry.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { ProxyService, ProxyTelemetryEvent } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import type { AppSettings } from '@shared/types/settings';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { en } from '../../../../renderer/i18n/locales';

interface MockHuggingFaceService {
    searchModels: ReturnType<typeof vi.fn>;
    listInstalledModels: ReturnType<typeof vi.fn>;
}

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
    let mockOllamaService: Partial<OllamaService>;
    let mockHuggingFaceService: MockHuggingFaceService;
    let fetchMock: ReturnType<typeof vi.fn>;
    const originalOpencodeKey = process.env.OPENCODE_API_KEY;

    afterAll(() => {
        if (originalOpencodeKey === undefined) {
            delete process.env.OPENCODE_API_KEY;
            return;
        }
        process.env.OPENCODE_API_KEY = originalOpencodeKey;
    });

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.OPENCODE_API_KEY = '';
        fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: vi.fn().mockResolvedValue({ data: [] }),
        } as never);
        vi.stubGlobal('fetch', fetchMock as never as typeof fetch);
        mockProcessManager = {
            startService: vi.fn(),
            sendRequest: vi.fn()
        };

        mockScheduler = {
            registerRecurringJob: vi.fn()
        };
        mockSettings = {
            getSettings: vi.fn().mockReturnValue({ ai: { modelUpdateInterval: 3600000 } })
        };

        mockProxyService = {
            getRawModelCatalog: vi.fn().mockResolvedValue({
                data: [{ id: 'ollama/llama3:7b', name: 'llama3:7b', provider: 'ollama' }]
            }),
            getEmbeddedProxyStatus: vi.fn().mockReturnValue({ port: 8317 }),
            getProxyKey: vi.fn().mockResolvedValue('proxy-key'),
        };
        mockEventBus = { emit: vi.fn(), on: vi.fn(), onCustom: vi.fn() };
        mockAuthService = {
            getActiveToken: vi.fn().mockResolvedValue(null),
            getActiveAccountFull: vi.fn().mockResolvedValue(null),
            getAccountsByProvider: vi.fn().mockResolvedValue([]),
            getAccountsByProviderFull: vi.fn().mockResolvedValue([]),
        };
        mockTokenService = { ensureFreshToken: vi.fn().mockResolvedValue(undefined) };
        mockOllamaService = {
            getModels: vi.fn().mockResolvedValue([{ name: 'llama3:8b', modified_at: '', size: 1, digest: 'abc' }])
        };
        mockLocalImageService = { getSDCppStatus: vi.fn().mockResolvedValue('ready') };
        mockHuggingFaceService = {
            searchModels: vi.fn().mockResolvedValue({
                models: [{ id: 'TheBloke/Llama-7B-GGUF', name: 'Llama-7B-GGUF', description: 'GGUF', tags: [], downloads: 5000, likes: 10, author: 'TheBloke', lastModified: 'today' }],
                total: 1
            }),
            listInstalledModels: vi.fn().mockResolvedValue([])
        };

        service = new ModelRegistryService({
            processManager: mockProcessManager as ProcessManagerService,
            jobScheduler: mockScheduler as JobSchedulerService,
            settingsService: mockSettings as SettingsService,
            proxyService: mockProxyService as ProxyService,
            eventBus: mockEventBus as EventBusService,
            authService: mockAuthService as AuthService,
            tokenService: mockTokenService as TokenService,
            ollamaService: mockOllamaService as OllamaService,
            localImageService: mockLocalImageService as LocalImageService,
            huggingFaceService: mockHuggingFaceService as never as HuggingFaceService
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

    describe('initialize', () => {
        it('should defer initial remote cache warmup until after startup', async () => {
            vi.useFakeTimers();
            try {
                await expect(service.initialize()).resolves.toBeUndefined();
                expect(mockProxyService.getRawModelCatalog).not.toHaveBeenCalled();

                await vi.advanceTimersByTimeAsync(15000);

                expect(mockProxyService.getRawModelCatalog).toHaveBeenCalledTimes(1);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should fetch immediately on first model request and cancel deferred warmup', async () => {
            vi.useFakeTimers();
            try {
                await service.initialize();
                expect(mockProxyService.getRawModelCatalog).not.toHaveBeenCalled();

                await service.getRemoteModels();
                expect(mockProxyService.getRawModelCatalog).toHaveBeenCalledTimes(1);

                await vi.advanceTimersByTimeAsync(15000);
                expect(mockProxyService.getRawModelCatalog).toHaveBeenCalledTimes(1);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should refresh models again when the embedded proxy reports ready', async () => {
            let proxyReadyListener: (() => void) | undefined;
            vi.mocked(mockEventBus.onCustom!).mockImplementation((event, listener) => {
                if (event === ProxyTelemetryEvent.PROXY_STARTED) {
                    proxyReadyListener = listener as () => void;
                }
                return 'sub-id';
            });

            await service.initialize();
            await new Promise(resolve => setTimeout(resolve, 0));
            vi.mocked(mockProxyService.getRawModelCatalog!).mockClear();

            proxyReadyListener?.();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockProxyService.getRawModelCatalog).toHaveBeenCalled();
        });
    });

    describe('getRemoteModels', () => {
        it('should fetch and cache remote models', async () => {
            const models = await service.getRemoteModels();
            // HF automatic fetch removed per user request
            expect(models.some(m => m.provider === 'huggingface')).toBe(false);
            expect(mockHuggingFaceService.searchModels).not.toHaveBeenCalled();
            expect(service.getHealthMetrics().cacheUpdates).toBe(1);
            expect(mockEventBus.emit).toHaveBeenCalledWith(
                'telemetry:model-registry',
                expect.objectContaining({ name: 'model-registry.cache.update.completed' })
            );
        });

        it('should return cached models on subsequent calls', async () => {
            await service.getRemoteModels();
            // HF automatic fetch removed per user request
            vi.mocked(mockHuggingFaceService.searchModels!).mockClear();

            const models = await service.getRemoteModels();
            expect(models.some(m => m.provider === 'huggingface')).toBe(false);
            expect(mockHuggingFaceService.searchModels).not.toHaveBeenCalled();
        });

        it('should dedupe concurrent cache refresh calls', async () => {
            vi.mocked(mockProxyService.getRawModelCatalog!).mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return {
                    data: [{ id: 'ollama/llama3:7b', name: 'llama3:7b', provider: 'ollama' }]
                };
            });

            const [first, second] = await Promise.all([
                service.getRemoteModels(),
                service.getRemoteModels()
            ]);

            expect(first).toEqual(second);
            expect(mockProxyService.getRawModelCatalog).toHaveBeenCalledTimes(1);
        });

        it('should include opencode models when opencode API returns data', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    data: [
                        { id: 'big-pickle', name: 'Big Pickle' },
                        { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free' },
                        { id: 'gpt-5-nano', name: 'GPT 5 Nano' },
                        { id: 'minimax-m2.5', name: 'MiniMax M2.5' }
                    ]
                }),
            } as never);

            const models = await service.getRemoteModels();
            const opencodeModels = models.filter(model => model.provider === 'opencode');

            expect(opencodeModels).toHaveLength(3);
            expect(opencodeModels.map(model => model.id)).toEqual([
                'big-pickle',
                'minimax-m2.5-free',
                'gpt-5-nano'
            ]);
            const bigPickle = opencodeModels.find(model => model.id === 'big-pickle');
            const minimaxFree = opencodeModels.find(model => model.id === 'minimax-m2.5-free');
            const gptNano = opencodeModels.find(model => model.id === 'gpt-5-nano');

            expect(bigPickle?.pricing).toEqual({ input: 0, output: 0 });
            expect(minimaxFree?.pricing).toEqual({ input: 0, output: 0 });
            expect(gptNano?.pricing).toEqual({ input: 0, output: 0 });
        });

        it('should include gpt-image-1 when an OpenAI account is linked', async () => {
            vi.mocked(mockAuthService.getAccountsByProviderFull!).mockImplementation(async provider => {
                if (provider !== 'openai') { return []; }
                return [{
                    id: 'openai_key',
                    provider: 'codex',
                    accessToken: 'sk-openai',
                    isActive: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    metadata: { type: 'api_key', provider_hint: 'openai' },
                }] as never;
            });

            const models = await service.getRemoteModels();

            expect(models).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    id: 'openai/gpt-image-1',
                    provider: 'openai',
                    capabilities: expect.objectContaining({
                        image_generation: true,
                        text_generation: false,
                    }),
                }),
            ]));
        });

        it('should only expose the supported codex models when a Codex OAuth account is linked', async () => {
            vi.mocked(mockAuthService.getAccountsByProviderFull!).mockImplementation(async provider => {
                if (provider !== 'codex') { return []; }
                return [{
                    id: 'codex_oauth',
                    provider: 'codex',
                    accessToken: 'codex-access',
                    isActive: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    metadata: { type: 'oauth' },
                }] as never;
            });
            vi.mocked(mockProxyService.getRawModelCatalog!).mockResolvedValueOnce({
                data: [
                    { id: 'gpt-5.5', name: 'GPT 5.5', provider: 'codex' },
                    { id: 'gpt-5.4', name: 'GPT 5.4', provider: 'codex' },
                    { id: 'gpt-5.4-mini', name: 'GPT 5.4 Mini', provider: 'copilot' },
                    { id: 'gpt-5.3-codex', name: 'GPT 5.3 Codex', provider: 'codex' },
                    { id: 'gpt-5.2-codex', name: 'GPT 5.2 Codex', provider: 'codex' },
                    { id: '$imagegen', name: 'GPT ImageGen', provider: 'codex' },
                ],
            });

            const models = await service.getRemoteModels();
            const codexIds = models
                .filter(model => model.provider === 'codex')
                .map(model => model.id)
                .sort();

            expect(codexIds).toEqual(['gpt-5.3-codex', 'gpt-5.4', 'gpt-5.5']);
        });

        it('should include paid opencode models when user provides opencode api key', async () => {
            process.env.OPENCODE_API_KEY = 'sk-opencode-user-key';
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    data: [
                        { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free' },
                        { id: 'minimax-m2.5', name: 'MiniMax M2.5' }
                    ]
                }),
            } as never);

            const models = await service.getRemoteModels();
            const opencodeModels = models.filter(model => model.provider === 'opencode');
            expect(opencodeModels.map(model => model.id)).toEqual(['minimax-m2.5-free', 'minimax-m2.5']);
            expect(opencodeModels.find(model => model.id === 'minimax-m2.5')?.pricing).toEqual({
                input: 0.3,
                output: 1.2,
            });
        });

        it('should return cached snapshot immediately and refresh stale data in background', async () => {
            await service.getRemoteModels();
            vi.mocked(mockProxyService.getRawModelCatalog!).mockClear();

            Object.assign(service, {
                lastUpdate: Date.now() - 10 * 60 * 1000
            });

            const cachedModels = await service.getRemoteModels();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(cachedModels.length).toBeGreaterThan(0);
            expect(mockProxyService.getRawModelCatalog).toHaveBeenCalled();
        });

        it('should NOT include HF models by default', async () => {
            const models = await service.getRemoteModels();

            const hfModel = models.find(m => m.provider === 'huggingface');
            expect(hfModel).toBeUndefined();
        });

        it('should retry proxy fetch when nvidia is enabled but only one nvidia model is returned initially', async () => {
            vi.useFakeTimers();
            try {
                vi.mocked(mockSettings.getSettings!).mockReturnValue({
                    ollama: { url: 'http://localhost:11434' },
                    embeddings: { provider: 'none' },
                    ai: { modelUpdateInterval: 3600000 },
                    general: {
                        language: 'en',
                        theme: 'dark',
                        resolution: 'auto',
                        fontSize: 14,

                    },
                    nvidia: { model: 'nvidia/llama3-chatqa-1.5-70b' }
                });
                // Bypass cold-start skip
                Object.assign(service, { lastUpdate: Date.now() });

                vi.mocked(mockAuthService.getActiveToken!).mockImplementation(async (provider) => {
                    if (provider === 'nvidia') {return 'nv-token';}
                    return undefined;
                });
                vi.mocked(mockProxyService.getRawModelCatalog!)
                    .mockResolvedValueOnce({
                        data: [{ id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama', provider: 'nvidia' }]
                    })
                    .mockResolvedValueOnce({
                        data: [
                            { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama', provider: 'nvidia' },
                            { id: 'meta/llama-3.1-405b-instruct', name: 'Meta Llama', provider: 'nvidia' }
                        ]
                    });

                const modelsPromise = service.getRemoteModels();
                await vi.advanceTimersByTimeAsync(10000);
                await modelsPromise;
                const models = await service.getRemoteModels();

                expect(mockProxyService.getRawModelCatalog).toHaveBeenCalledTimes(2);
                expect(models.filter(model => model.provider === 'nvidia')).toHaveLength(2);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should retry proxy fetch when copilot is connected but no copilot models are returned initially', async () => {
            vi.useFakeTimers();
            try {
                vi.mocked(mockSettings.getSettings!).mockReturnValue({
                    ai: { modelUpdateInterval: 3600000 },
                    general: {
                        language: 'en',
                        theme: 'dark',
                        resolution: 'auto',
                        fontSize: 14,

                    },
                    copilot: { connected: true }
                } as AppSettings);
                // Bypass cold-start skip
                Object.assign(service, { lastUpdate: Date.now() });
                vi.mocked(mockAuthService.getAccountsByProvider!).mockResolvedValue([{ id: 'copilot-acc', isActive: true }] as any);

                vi.mocked(mockProxyService.getRawModelCatalog!)
                    .mockResolvedValueOnce({
                        data: [{ id: 'gpt-4o', name: 'GPT-4o', provider: 'codex' }]
                    })
                    .mockResolvedValueOnce({
                        data: [
                            { id: 'gpt-4o', name: 'GPT-4o', provider: 'codex' },
                            { id: 'github-copilot/gpt-4o', name: 'GitHub Copilot GPT-4o', provider: 'github' }
                        ]
                    });

                const modelsPromise = service.getRemoteModels();
                await vi.advanceTimersByTimeAsync(10000);
                await modelsPromise;
                const models = await service.getRemoteModels();

                expect(mockProxyService.getRawModelCatalog).toHaveBeenCalledTimes(2);
                expect(models.some(model => model.providerCategory === 'copilot')).toBe(true);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should preserve cached copilot models when connected and a refresh temporarily returns none', async () => {
            vi.mocked(mockSettings.getSettings!).mockReturnValue({
                ai: { modelUpdateInterval: 3600000 },
                general: {
                    language: 'en',
                    theme: 'dark',
                    resolution: 'auto',
                    fontSize: 14,

                },
                copilot: { connected: true }
            } as AppSettings);
            vi.mocked(mockAuthService.getAccountsByProvider!).mockResolvedValue([{ id: 'copilot-acc', isActive: true }] as any);
            vi.mocked(mockProxyService.getRawModelCatalog!)
                .mockResolvedValueOnce({
                    data: [
                        { id: 'github-copilot/gpt-4o', name: 'GitHub Copilot GPT-4o', provider: 'github' },
                        { id: 'gpt-4o', name: 'GPT-4o', provider: 'codex' }
                    ]
                })
                .mockResolvedValueOnce({
                    data: [{ id: 'gpt-4o', name: 'GPT-4o', provider: 'codex' }]
                });

            const initialModels = await service.getRemoteModels();
            expect(initialModels.some(model => model.providerCategory === 'copilot')).toBe(true);

            Object.assign(service, {
                lastUpdate: Date.now() - 10 * 60 * 1000
            });

            const staleSnapshot = await service.getRemoteModels();
            expect(staleSnapshot.some(model => model.providerCategory === 'copilot')).toBe(true);

            await new Promise(resolve => setTimeout(resolve, 0));
            const refreshedModels = await service.getRemoteModels();
            expect(refreshedModels.some(model => model.providerCategory === 'copilot')).toBe(true);
        });

        it('should map kimi and cursor providers from proxy catalog', async () => {
            vi.mocked(mockProxyService.getRawModelCatalog!).mockResolvedValueOnce({
                data: [
                    { id: 'moonshot/kimi-k2.5', name: 'Kimi K2.5', provider: 'moonshot' },
                    { id: 'cursor/gpt-4.1', name: 'Cursor GPT 4.1', provider: 'cursor' }
                ]
            });

            const models = await service.getRemoteModels();
            const kimiModel = models.find(model => model.id === 'moonshot/kimi-k2.5');
            const cursorModel = models.find(model => model.id === 'cursor/gpt-4.1');

            expect(kimiModel?.provider).toBe('kimi');
            expect(kimiModel?.providerCategory).toBe('kimi');
            expect(cursorModel?.provider).toBe('cursor');
            expect(cursorModel?.providerCategory).toBe('cursor');
        });
    });

    describe('getInstalledModels', () => {
        it('should return locally installed models', async () => {
            const installed = await service.getInstalledModels();

            expect(installed.length).toBe(1);
            expect(installed[0]!.id).toBe('ollama/llama3:8b');
            expect(installed[0]!.provider).toBe('ollama');
        });

        it('should include locally downloaded Hugging Face models', async () => {
            vi.mocked(mockHuggingFaceService.listInstalledModels).mockResolvedValueOnce([
                {
                    modelId: 'lmstudio-community/gemma-4-E4B-it-GGUF',
                    path: 'C:\\Users\\agnes\\AppData\\Roaming\\tengra\\models\\gemma-4-E4B-it-Q4_K_M.gguf',
                    createdAt: Date.now(),
                    contextLength: 8192,
                    architecture: 'gemma4',
                }
            ]);

            const installed = await service.getInstalledModels();
            const hfModel = installed.find(model => model.provider === 'huggingface');

            expect(hfModel).toBeDefined();
            expect(hfModel?.id).toBe('lmstudio-community/gemma-4-E4B-it-GGUF');
            expect(hfModel?.name).toBe('gemma-4-E4B-it-GGUF');
            expect(hfModel?.contextWindow).toBe(8192);
            expect(hfModel?.backend).toBe('llama.cpp');
        });

        it('should return empty array if error', async () => {
            vi.mocked(mockOllamaService.getModels!).mockResolvedValue([]);

            const installed = await service.getInstalledModels();
            expect(installed.length).toBe(0);
        });

        it('should return empty array when provider request throws', async () => {
            vi.mocked(mockOllamaService.getModels!).mockRejectedValueOnce(new Error('ollama down'));

            const installed = await service.getInstalledModels();

            expect(installed).toEqual([]);
        });

        it('should return empty array when provider response is malformed', async () => {
            vi.mocked(mockOllamaService.getModels!).mockResolvedValueOnce([
                { name: '', modified_at: '', size: 1, digest: 'broken' }
            ] as never);

            const installed = await service.getInstalledModels();

            expect(installed).toEqual([]);
        });

        it('should return empty array when the provider fetch fails', async () => {
            vi.mocked(mockOllamaService.getModels!).mockRejectedValueOnce(new Error('temporary failure'));

            const installed = await service.getInstalledModels();

            expect(installed).toEqual([]);
        });
    });

    describe('getAllModels', () => {
        it('should merge remote and installed models without requiring a linked account', async () => {
            vi.mocked(mockProxyService.getRawModelCatalog!).mockResolvedValueOnce({ data: [] });
            vi.mocked(mockOllamaService.getModels!).mockResolvedValueOnce([
                { name: 'llama3:8b', modified_at: '', size: 1, digest: 'abc' }
            ] as never);

            const models = await service.getAllModels();

            expect(models.some(model => model.id === 'ollama/llama3:8b' && model.provider === 'ollama')).toBe(true);
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
            expect(models.some(m => m.provider === 'huggingface')).toBe(false);
        });

        it('should track provider fetch failures in health metrics', async () => {
            vi.mocked(mockOllamaService.getModels!).mockRejectedValue(new Error('provider unavailable'));
            await service.getInstalledModels();

            expect(service.getHealthMetrics().providerFetchFailures).toBe(1);
            expect(mockEventBus.emit).toHaveBeenCalledWith(
                'telemetry:model-registry',
                expect.objectContaining({ name: 'model-registry.provider.fetch.failed', provider: 'ollama' })
            );
        });

        it('should keep ollama results when installed Hugging Face lookup fails', async () => {
            vi.mocked(mockHuggingFaceService.listInstalledModels).mockRejectedValueOnce(new Error('hf unavailable'));

            const installed = await service.getInstalledModels();

            expect(installed.some(model => model.provider === 'ollama')).toBe(true);
        });

        it('should expose performance budget, normalized ui state and i18n keys in health metrics', async () => {
            const emptyMetrics = service.getHealthMetrics();
            expect(emptyMetrics.uiState).toBe('empty');
            expect(emptyMetrics.performanceBudget.cacheRefreshMs).toBe(2000);
            expect(en.frontend.serviceHealth.modelRegistry.empty).toBe(emptyMetrics.messageKey);

            vi.mocked(mockOllamaService.getModels!).mockRejectedValue(new Error('provider unavailable'));
            await service.getInstalledModels();

            const failureMetrics = service.getHealthMetrics();
            expect(failureMetrics.uiState).toBe('failure');
            expect(en.frontend.serviceHealth.modelRegistry.failure).toBe(failureMetrics.messageKey);
        });
    });
});
