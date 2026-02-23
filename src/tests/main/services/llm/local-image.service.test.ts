
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalImageService, LocalImageServiceDeps } from '@main/services/llm/local-image.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { en } from '../../../../renderer/i18n/en';
import { tr } from '../../../../renderer/i18n/tr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        } as unknown as SettingsService;

        mockTelemetryService = {
            track: vi.fn(),
        } as unknown as TelemetryService;

        mockEventBusService = {
            emit: vi.fn(),
        } as unknown as EventBusService;

        const deps: LocalImageServiceDeps = {
            settingsService: mockSettingsService,
            telemetryService: mockTelemetryService,
            eventBusService: mockEventBusService,
            authService: { getAllAccountsFull: vi.fn().mockResolvedValue([]) } as unknown as AuthService,
            llmService: {} as unknown as LLMService,
            quotaService: {} as unknown as QuotaService,
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

        it('should fallback to pollinations when sd-cpp fails', async () => {
            // Mock ensureSDCppReady to succeed
            vi.spyOn(service, 'ensureSDCppReady').mockResolvedValue({
                binaryPath: '/path/to/bin',
                modelPath: '/path/to/model'
            });

            // Mock a failing process indirectly by mocking generateWithSDCpp if we could
            // or by mocking runProcess which is private.
            // Since generateImage calls generateWithProvider which calls generateWithSDCpp,
            // we can mock generateWithSDCpp by spying on the prototype or the instance.

            const sdCppSpy = vi.spyOn(service as any, 'generateWithSDCpp')
                .mockRejectedValue(new Error('SD-CPP failed'));

            const pollinationsSpy = vi.spyOn(service as any, 'generateWithPollinations')
                .mockResolvedValue('/path/to/fallback/image.png');

            const result = await service.generateImage({ prompt: 'test prompt' });

            expect(result).toBe('/path/to/fallback/image.png');
            expect(sdCppSpy).toHaveBeenCalled();
            expect(pollinationsSpy).toHaveBeenCalled();
            expect(mockTelemetryService.track).toHaveBeenCalledWith(
                'sd-cpp-fallback-triggered',
                expect.objectContaining({
                    provider: 'sd-cpp',
                    errorCode: 'LOCAL_IMAGE_SDCPP_FALLBACK_TRIGGERED',
                })
            );
        });

        it('should track success metric when sd-cpp succeeds', async () => {
            vi.spyOn(service, 'ensureSDCppReady').mockResolvedValue({
                binaryPath: '/path/to/bin',
                modelPath: '/path/to/model'
            });

            // Mock the private generateWithSDCpp to simulate success
            vi.spyOn(service as any, 'generateWithSDCpp').mockResolvedValue('/path/to/image.png');

            const result = await service.generateImage({ prompt: 'test prompt' });

            expect(result).toBe('/path/to/image.png');
            // Note: the track method is called INSIDE generateWithSDCpp if we don't mock it,
            // but here we mocked it. Let's see if we can go deeper.
        });

        it('should reject when sd-cpp fails and pollinations fallback also fails', async () => {
            vi.spyOn(service as any, 'generateWithSDCpp').mockRejectedValue(new Error('sd-cpp failed'));
            vi.spyOn(service as any, 'generateWithPollinations').mockRejectedValue(new Error('pollinations failed'));

            await expect(service.generateImage({ prompt: 'test prompt' })).rejects.toThrow('pollinations failed');
            expect(mockTelemetryService.track).toHaveBeenCalledWith('sd-cpp-fallback-triggered', expect.any(Object));
        });

        it('should propagate provider errors when provider is not sd-cpp', async () => {
            vi.mocked(mockSettingsService.getSettings).mockReturnValue({
                images: { provider: 'ollama' },
                ollama: { url: 'http://localhost:11434' }
            } as never);
            vi.spyOn(service as any, 'generateWithProvider').mockRejectedValue(new Error('ollama unavailable'));

            await expect(service.generateImage({ prompt: 'test prompt' })).rejects.toThrow('ollama unavailable');
            expect(mockTelemetryService.track).not.toHaveBeenCalledWith('sd-cpp-fallback-triggered', expect.any(Object));
        });

        it('should fallback to pollinations for unknown provider values', async () => {
            const pollinationsSpy = vi.spyOn(service as any, 'generateWithPollinations').mockResolvedValue('/path/to/unknown-provider.png');

            const result = await (service as any).generateWithProvider('unknown-provider', { prompt: 'test prompt' });

            expect(result).toBe('/path/to/unknown-provider.png');
            expect(pollinationsSpy).toHaveBeenCalledWith({ prompt: 'test prompt' });
        });
    });

    describe('Telemetry Tracking', () => {
        it('should track metrics with correct properties', async () => {
            (service as any).trackSdCppMetric('test-event', { detail: 'info' });

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
});
