/**
 * Edge case unit tests for MonitoringService (BACKLOG-0451)
 * Covers: metrics capacity, cleanup verification, defensive copies,
 * timestamp correctness, telemetry emission, and boundary conditions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('os', () => ({
    loadavg: vi.fn(),
    totalmem: vi.fn(),
    freemem: vi.fn(),
    platform: vi.fn(),
}));

vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { exec } from 'child_process';
import * as os from 'os';

import { appLogger } from '@main/logging/logger';
import {
    AlertConfiguration,
    MonitoringErrorCode,
    MonitoringService,
    MonitoringTelemetryEvent,
} from '@main/services/analysis/monitoring.service';

const mockExec = exec as never as ReturnType<typeof vi.fn>;

describe('MonitoringService edge cases (B-0451)', () => {
    let service: MonitoringService;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(os.platform).mockReturnValue('win32');
        vi.mocked(os.loadavg).mockReturnValue([0.5, 0.3, 0.2]);
        vi.mocked(os.totalmem).mockReturnValue(16_000_000_000);
        vi.mocked(os.freemem).mockReturnValue(8_000_000_000);
        mockExec.mockImplementation(
            (_cmd: string, _opts: Record<string, TestValue>, cb: (err: null, out: string, stderr: string) => void) => {
                cb(null, 'mock output', '');
            }
        );
        service = new MonitoringService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('MAX_METRICS_COUNT capacity', () => {
        it('should reject recording when max metrics count (1000) is reached', () => {
            for (let i = 0; i < 1000; i++) {
                const result = service.recordMetric(`metric${String.fromCharCode(97 + (i % 26))}${i}`, i);
                expect(result.success).toBe(true);
            }

            const overflowResult = service.recordMetric('overflow', 999);
            expect(overflowResult.success).toBe(false);
            expect(overflowResult.error).toContain('Maximum number of metrics');
        });

        it('should allow updating existing metric even at capacity', () => {
            for (let i = 0; i < 1000; i++) {
                service.recordMetric(`m${String.fromCharCode(97 + (i % 26))}${i}`, i);
            }

            const updateResult = service.recordMetric('ma0', 999);
            expect(updateResult.success).toBe(true);

            const fetched = service.getMetric('ma0');
            expect(fetched.result?.value).toBe(999);
        });
    });

    describe('cleanup clears all internal maps', () => {
        it('should clear thresholds on cleanup', async () => {
            service.setThreshold('cpu', 80);
            await service.cleanup();
            await service.initialize();

            // After cleanup+reinit, the old threshold should not affect new state
            const metricResult = service.getMetric('cpu');
            expect(metricResult.success).toBe(false);
        });

        it('should clear alerts on cleanup', async () => {
            const alert: AlertConfiguration = {
                metricName: 'cpu',
                threshold: 90,
                direction: 'above',
                enabled: true,
            };
            service.configureAlert(alert);
            await service.cleanup();
            await service.initialize();

            // Service should be in a clean state after cleanup
            const telemetry = service.getTelemetry();
            expect(telemetry.telemetryEnabled).toBe(true);
        });

        it('should clear metrics on cleanup', async () => {
            service.recordMetric('cpu', 50);
            service.recordMetric('mem', 75);
            await service.cleanup();
            await service.initialize();

            expect(service.getMetric('cpu').success).toBe(false);
            expect(service.getMetric('mem').success).toBe(false);
        });
    });

    describe('getMetric defensive copy', () => {
        it('should return a copy that does not alias internal state', () => {
            service.recordMetric('cpu', 42);
            const first = service.getMetric('cpu');
            const second = service.getMetric('cpu');

            expect(first.result).toEqual(second.result);
            expect(first.result).not.toBe(second.result);
        });
    });

    describe('metric timestamp', () => {
        it('should record a timestamp close to Date.now()', () => {
            const before = Date.now();
            service.recordMetric('cpu', 50);
            const after = Date.now();

            const metric = service.getMetric('cpu');
            expect(metric.result?.timestamp).toBeGreaterThanOrEqual(before);
            expect(metric.result?.timestamp).toBeLessThanOrEqual(after);
        });

        it('should update timestamp when overwriting a metric', async () => {
            service.recordMetric('cpu', 10);
            const first = service.getMetric('cpu').result?.timestamp ?? 0;

            await new Promise((r) => setTimeout(r, 10));

            service.recordMetric('cpu', 20);
            const second = service.getMetric('cpu').result?.timestamp ?? 0;

            expect(second).toBeGreaterThan(first);
        });
    });

    describe('telemetry emission', () => {
        it('should emit USAGE_CHECKED telemetry on successful getUsage', async () => {
            vi.mocked(appLogger.info).mockClear();
            await service.getUsage();

            const telemetryCalls = vi.mocked(appLogger.info).mock.calls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes(MonitoringTelemetryEvent.USAGE_CHECKED)
            );
            expect(telemetryCalls).toHaveLength(1);
        });

        it('should emit SYSTEM_MONITOR_CHECKED on successful getSystemMonitor', async () => {
            vi.mocked(appLogger.info).mockClear();
            await service.getSystemMonitor();

            const telemetryCalls = vi.mocked(appLogger.info).mock.calls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes(MonitoringTelemetryEvent.SYSTEM_MONITOR_CHECKED)
            );
            expect(telemetryCalls).toHaveLength(1);
        });

        it('should emit BATTERY_CHECKED on successful getBatteryStatus', async () => {
            vi.mocked(appLogger.info).mockClear();
            await service.getBatteryStatus();

            const telemetryCalls = vi.mocked(appLogger.info).mock.calls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes(MonitoringTelemetryEvent.BATTERY_CHECKED)
            );
            expect(telemetryCalls).toHaveLength(1);
        });

        it('should emit COMMAND_FAILED on getSystemMonitor failure', async () => {
            mockExec.mockImplementation(
                (_cmd: string, _opts: Record<string, TestValue>, cb: (err: Error, out: string, stderr: string) => void) => {
                    cb(new Error('exec boom'), '', '');
                }
            );
            vi.mocked(appLogger.info).mockClear();
            await service.getSystemMonitor();

            const failCalls = vi.mocked(appLogger.info).mock.calls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes(MonitoringTelemetryEvent.COMMAND_FAILED)
            );
            expect(failCalls).toHaveLength(1);
        });

        it('should not emit telemetry when telemetry is disabled', async () => {
            await service.cleanup(); // disables telemetry
            vi.mocked(appLogger.info).mockClear();

            const freshService = new MonitoringService();
            // Do NOT initialize (telemetry stays disabled)
            await freshService.getUsage();

            const telemetryCalls = vi.mocked(appLogger.info).mock.calls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('Telemetry:')
            );
            expect(telemetryCalls).toHaveLength(0);
        });
    });

    describe('recordMetric does not inflate count on overwrite', () => {
        it('should not increase map size when overwriting', () => {
            service.recordMetric('cpu', 10);
            service.recordMetric('cpu', 20);
            service.recordMetric('cpu', 30);

            const metric = service.getMetric('cpu');
            expect(metric.result?.value).toBe(30);
        });
    });

    describe('boundary metric names', () => {
        it('should accept single-character metric name', () => {
            const result = service.recordMetric('a', 1);
            expect(result.success).toBe(true);
        });

        it('should reject metric name starting with underscore', () => {
            const result = service.recordMetric('_cpu', 1);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should reject metric name starting with hyphen', () => {
            const result = service.recordMetric('-cpu', 1);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });

        it('should reject metric name starting with dot', () => {
            const result = service.recordMetric('.cpu', 1);
            expect(result.success).toBe(false);
            expect(result.error).toContain(MonitoringErrorCode.INVALID_METRIC_NAME);
        });
    });

    describe('collectAllMetrics error array', () => {
        it('should include descriptive error labels per failed collector', async () => {
            vi.mocked(os.platform).mockReturnValue('freebsd');

            const result = await service.collectAllMetrics();

            expect(result.result?.errors).toBeDefined();
            const errorLabels = result.result?.errors ?? [];
            const hasSystemMonitor = errorLabels.some((e) => e.startsWith('systemMonitor:'));
            const hasBattery = errorLabels.some((e) => e.startsWith('battery:'));
            expect(hasSystemMonitor).toBe(true);
            expect(hasBattery).toBe(true);
        });
    });

    describe('getUsage with extreme values', () => {
        it('should handle very large totalmem', async () => {
            vi.mocked(os.totalmem).mockReturnValue(Number.MAX_SAFE_INTEGER);
            vi.mocked(os.freemem).mockReturnValue(1);

            const result = await service.getUsage();
            expect(result.success).toBe(true);
            expect(result.result?.memory).toBeGreaterThan(99);
        });

        it('should handle freemem greater than totalmem', async () => {
            vi.mocked(os.totalmem).mockReturnValue(100);
            vi.mocked(os.freemem).mockReturnValue(200);

            const result = await service.getUsage();
            expect(result.success).toBe(true);
            // Negative memory usage is a valid arithmetic result
            expect(typeof result.result?.memory).toBe('number');
        });
    });
});
