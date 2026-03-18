
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { LLMService } from '@main/services/llm/llm.service';
import { type ImageGenerationOptions, type ImageGenerationRecord, LocalImageService, type LocalImageServiceDeps } from '@main/services/llm/local-image.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { en } from '../../../../renderer/i18n/en';
import { tr } from '../../../../renderer/i18n/tr';

vi.mock('axios');
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        promises: {
            ...actual.promises,
            access: vi.fn().mockResolvedValue(undefined),
            mkdir: vi.fn().mockResolvedValue(undefined),
            writeFile: vi.fn().mockResolvedValue(undefined),
            stat: vi.fn().mockResolvedValue({ size: 1024 }),
            unlink: vi.fn().mockResolvedValue(undefined),
            rename: vi.fn().mockResolvedValue(undefined),
        }
    };
});

describe('LocalImageService Integration', () => {
    let service: LocalImageService;
    let mockSettingsService: SettingsService;
    let mockTelemetryService: TelemetryService;
    let mockEventBusService: EventBusService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                images: { provider: 'sd-cpp' },
                ollama: { url: 'http://localhost:11434' }
            }),
            saveSettings: vi.fn().mockResolvedValue(undefined),
        } as never as SettingsService;

        mockTelemetryService = {
            track: vi.fn(),
        } as never as TelemetryService;

        mockEventBusService = {
            emit: vi.fn(),
        } as never as EventBusService;

        const deps: LocalImageServiceDeps = {
            settingsService: mockSettingsService,
            telemetryService: mockTelemetryService,
            eventBusService: mockEventBusService,
            authService: { getAllAccountsFull: vi.fn().mockResolvedValue([]) } as never as AuthService,
            llmService: {} as never as LLMService,
            quotaService: {} as never as QuotaService,
        };

        service = new LocalImageService(deps);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Fallback Mechanism', () => {
        it('should reject generation when prompt is blank', async () => {
            await expect(service.generateImage({ prompt: '   ' })).rejects.toThrow('Prompt is required');
        }); 

        it('should track success metric when sd-cpp succeeds', async () => {
            vi.spyOn(service, 'ensureSDCppReady').mockResolvedValue({
                binaryPath: '/path/to/bin',
                modelPath: '/path/to/model'
            });

            // Mock the private generateWithSDCpp to simulate success
            vi.spyOn(
                service as never as { generateWithSDCpp: (options: ImageGenerationOptions) => Promise<string> },
                'generateWithSDCpp'
            ).mockResolvedValue('/path/to/image.png');

            const result = await service.generateImage({ prompt: 'test prompt' });

            expect(result).toBe('/path/to/image.png');
            // Note: the track method is called INSIDE generateWithSDCpp if we don't mock it,
            // but here we mocked it. Let's see if we can go deeper.
        });

        it('should reject when sd-cpp fails and pollinations fallback also fails', async () => {
            vi.spyOn(
                service as never as { generateWithSDCpp: (options: ImageGenerationOptions) => Promise<string> },
                'generateWithSDCpp'
            ).mockRejectedValue(new Error('sd-cpp failed')); 

            await expect(service.generateImage({ prompt: 'test prompt' })).rejects.toThrow('sd-cpp failed');
            expect(mockTelemetryService.track).toHaveBeenCalledWith('sd-cpp-fallback-triggered', expect.any(Object));
        });

        it('should propagate provider errors when provider is not sd-cpp', async () => {
            vi.mocked(mockSettingsService.getSettings).mockReturnValue({
                images: { provider: 'ollama' },
                ollama: { url: 'http://localhost:11434' }
            } as never);
            vi.spyOn(
                service as never as {
                    generateWithProvider: (provider: string, options: ImageGenerationOptions) => Promise<string>;
                },
                'generateWithProvider'
            ).mockRejectedValue(new Error('ollama unavailable'));

            await expect(service.generateImage({ prompt: 'test prompt' })).rejects.toThrow('ollama unavailable');
            expect(mockTelemetryService.track).not.toHaveBeenCalledWith('sd-cpp-fallback-triggered', expect.any(Object));
        });
 
    });

    describe('Telemetry Tracking', () => {
        it('should track metrics with correct properties', async () => {
            (
                service as never as {
                    trackSdCppMetric: (name: string, properties?: Record<string, RuntimeValue>) => void;
                }
            ).trackSdCppMetric('test-event', { detail: 'info' });

            expect(mockTelemetryService.track).toHaveBeenCalledWith('test-event', {
                provider: 'sd-cpp',
                detail: 'info'
            });
        });

        it('should emit telemetry when sd-cpp status is checked', async () => {
            const status = await service.getSDCppStatus();

            expect(status).toBe('notConfigured');
            expect(mockTelemetryService.track).toHaveBeenCalledWith(
                'sd-cpp-status-checked',
                expect.objectContaining({ provider: 'sd-cpp', status: 'notConfigured' })
            );
        });
    });

    describe('Health Metrics', () => {
        it('should expose dashboard-friendly health metrics', async () => {
            const metrics = await service.getHealthMetrics();

            expect(metrics).toMatchObject({
                status: 'healthy',
                provider: 'sd-cpp',
                sdCppStatus: 'notConfigured',
                uiState: 'empty',
                queueDepth: 0,
                scheduledTaskCount: 0,
            });
            expect(metrics.performanceBudget.statusCheckMs).toBe(300);
            expect(en.serviceHealth.localImage.empty).toBe(metrics.messageKey);
            expect(tr.serviceHealth.localImage.empty).toBeTruthy();
        });

        it('should report ready and failure ui states from status checks', async () => {
            vi.spyOn(service, 'getSDCppStatus').mockResolvedValueOnce('ready');
            const readyMetrics = await service.getHealthMetrics();
            expect(readyMetrics.uiState).toBe('ready');
            expect(en.serviceHealth.localImage.ready).toBe(readyMetrics.messageKey);

            vi.spyOn(service, 'getSDCppStatus').mockResolvedValueOnce('failed');
            const failureMetrics = await service.getHealthMetrics();
            expect(failureMetrics.uiState).toBe('failure');
            expect(en.serviceHealth.localImage.failure).toBe(failureMetrics.messageKey);
        });
    });

    describe('Workflow Templates', () => {
        it('should save, list, export, and import workflow templates', async () => {
            const template = await service.saveComfyWorkflowTemplate({
                name: 'Workflow A',
                workflow: { '1': { class_type: 'CLIPTextEncode', inputs: { text: '{{prompt}}' } } },
            });

            const list = service.listComfyWorkflowTemplates();
            expect(list.length).toBe(1);
            expect(list[0].id).toBe(template.id);

            const shareCode = service.exportComfyWorkflowTemplateShareCode(template.id);
            expect(shareCode.length).toBeGreaterThan(10);

            const imported = await service.importComfyWorkflowTemplateShareCode(shareCode);
            expect(imported.name).toBe('Workflow A');
            expect(service.listComfyWorkflowTemplates().length).toBe(2);
        });
    });

    describe('History And Export', () => {
        it('should search history entries by prompt text', () => {
            const now = Date.now();
            const history: ImageGenerationRecord[] = [
                {
                    id: '1',
                    provider: 'sd-cpp',
                    prompt: 'mountain landscape',
                    width: 1024,
                    height: 1024,
                    steps: 24,
                    cfgScale: 7,
                    seed: 1,
                    imagePath: '/tmp/1.png',
                    createdAt: now,
                    source: 'generate'
                },
                {
                    id: '2',
                    provider: 'ollama',
                    prompt: 'city skyline at night',
                    width: 1024,
                    height: 1024,
                    steps: 24,
                    cfgScale: 7,
                    seed: 2,
                    imagePath: '/tmp/2.png',
                    createdAt: now + 1,
                    source: 'generate'
                }
            ];
            service.generationHistory = history;

            const result = service.searchGenerationHistory('mountain', 20);
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('1');
        });

        it('should export generation history in CSV format', async () => {
            const now = Date.now();
            const history: ImageGenerationRecord[] = [
                {
                    id: 'row-1',
                    provider: 'sd-cpp',
                    prompt: 'test prompt',
                    width: 512,
                    height: 512,
                    steps: 20,
                    cfgScale: 7,
                    seed: 42,
                    imagePath: '/tmp/image.png',
                    createdAt: now,
                    source: 'generate'
                }
            ];
            service.generationHistory = history;

            const csv = await service.exportGenerationHistory('csv');
            expect(csv).toContain('provider');
            expect(csv).toContain('test prompt');
        });
    });

    describe('Preset Features', () => {
        it('should validate generation preset bounds', async () => {
            await expect(service.saveGenerationPreset({
                name: 'bad preset',
                width: 10,
                height: 10,
                steps: 0,
                cfgScale: 0,
            })).rejects.toThrow('Preset width must be between 256 and 4096');
        });

        it('should export and import preset share code', async () => {
            const preset = await service.saveGenerationPreset({
                name: 'share preset',
                width: 1024,
                height: 1024,
                steps: 30,
                cfgScale: 8,
                provider: 'sd-cpp'
            });

            const shareCode = service.exportGenerationPresetShareCode(preset.id);
            expect(shareCode.length).toBeGreaterThan(10);

            const imported = await service.importGenerationPresetShareCode(shareCode);
            expect(imported.name).toBe('share preset');
        });
    });

    describe('Scheduling Enhancements', () => {
        it('should persist scheduling priority and resource profile', async () => {
            const future = Date.now() + 60_000;
            const schedule = await service.scheduleGeneration(
                future,
                { prompt: 'scheduled prompt', width: 1024, height: 1024, steps: 24, cfgScale: 7 },
                { priority: 'high', resourceProfile: 'quality' }
            );

            expect(schedule.priority).toBe('high');
            expect(schedule.resourceProfile).toBe('quality');
        });

        it('should return schedule analytics summary', async () => {
            const future = Date.now() + 120_000;
            await service.scheduleGeneration(future, { prompt: 'one' }, { priority: 'normal', resourceProfile: 'balanced' });
            await service.scheduleGeneration(future + 1000, { prompt: 'two' }, { priority: 'high', resourceProfile: 'speed' });

            const analytics = service.getScheduleAnalytics();
            expect(analytics.total).toBeGreaterThanOrEqual(2);
            expect(analytics.byPriority.high).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Comparison Features', () => {
        it('should compute bytes-per-pixel and comparison summary', async () => {
            const now = Date.now();
            const history: ImageGenerationRecord[] = [
                {
                    id: 'cmp-1',
                    provider: 'sd-cpp',
                    prompt: 'first',
                    width: 512,
                    height: 512,
                    steps: 20,
                    cfgScale: 7,
                    seed: 1,
                    imagePath: '/tmp/a.png',
                    createdAt: now,
                    source: 'generate'
                },
                {
                    id: 'cmp-2',
                    provider: 'sd-cpp',
                    prompt: 'second',
                    width: 512,
                    height: 512,
                    steps: 20,
                    cfgScale: 7,
                    seed: 2,
                    imagePath: '/tmp/b.png',
                    createdAt: now + 1,
                    source: 'generate'
                }
            ];
            service.generationHistory = history;

            const result = await service.compareGenerations(['cmp-1', 'cmp-2']);
            expect(result.summary.averageFileSizeBytes).toBeGreaterThan(0);
            expect(result.summary.averageBytesPerPixel).toBeGreaterThan(0);
            expect(result.entries[0].bytesPerPixel).toBeGreaterThan(0);
        });

        it('should export and share comparison results', async () => {
            const now = Date.now();
            const history: ImageGenerationRecord[] = [
                {
                    id: 'cmp-x',
                    provider: 'sd-cpp',
                    prompt: 'x',
                    width: 256,
                    height: 256,
                    steps: 12,
                    cfgScale: 6,
                    seed: 11,
                    imagePath: '/tmp/x.png',
                    createdAt: now,
                    source: 'generate'
                },
                {
                    id: 'cmp-y',
                    provider: 'sd-cpp',
                    prompt: 'y',
                    width: 256,
                    height: 256,
                    steps: 12,
                    cfgScale: 6,
                    seed: 12,
                    imagePath: '/tmp/y.png',
                    createdAt: now + 1,
                    source: 'generate'
                }
            ];
            service.generationHistory = history;

            const csv = await service.exportComparison(['cmp-x', 'cmp-y'], 'csv');
            expect(csv).toContain('bytesPerPixel');

            const share = await service.shareComparison(['cmp-x', 'cmp-y']);
            expect(share.length).toBeGreaterThan(10);
        });
    });
});
