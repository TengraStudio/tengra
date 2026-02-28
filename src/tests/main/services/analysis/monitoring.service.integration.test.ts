/**
 * Integration tests for MonitoringService (BACKLOG-0452)
 */
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import {
    AlertConfiguration,
    MONITORING_PERFORMANCE_BUDGETS,
    MonitoringErrorCode,
    MonitoringService,
    MonitoringTelemetryEvent} from '@main/services/analysis/monitoring.service';

describe('MonitoringService Integration', () => {
    let service: MonitoringService;

    beforeEach(async () => {
        vi.clearAllMocks();
        service = new MonitoringService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    it('should return usage data after initialization', async () => {
        const usage = await service.getUsage();
        expect(usage.success).toBe(true);
        if (usage.result) {
            expect(typeof usage.result.cpu).toBe('number');
            expect(typeof usage.result.memory).toBe('number');
        }
    });

    it('should return telemetry data after initialization', () => {
        const telemetry = service.getTelemetry();
        expect(telemetry.serviceName).toBe('MonitoringService');
        expect(telemetry.initialized).toBe(true);
        expect(telemetry.telemetryEnabled).toBe(true);
    });

    it('should disable telemetry after cleanup', async () => {
        await service.cleanup();
        const telemetry = service.getTelemetry();
        expect(telemetry.telemetryEnabled).toBe(false);
    });

    it('should have valid error codes', () => {
        expect(MonitoringErrorCode.UNSUPPORTED_PLATFORM).toBeDefined();
        expect(MonitoringErrorCode.COMMAND_TIMEOUT).toBeDefined();
        expect(MonitoringErrorCode.COMMAND_FAILED).toBeDefined();
        expect(MonitoringErrorCode.OUTPUT_TRUNCATED).toBeDefined();
        expect(MonitoringErrorCode.NO_BATTERY).toBeDefined();
        expect(MonitoringErrorCode.COLLECTION_FAILED).toBeDefined();
    });

    it('should have valid telemetry events', () => {
        expect(MonitoringTelemetryEvent.USAGE_CHECKED).toBeDefined();
        expect(MonitoringTelemetryEvent.SYSTEM_MONITOR_CHECKED).toBeDefined();
        expect(MonitoringTelemetryEvent.BATTERY_CHECKED).toBeDefined();
        expect(MonitoringTelemetryEvent.COMMAND_TIMEOUT).toBeDefined();
        expect(MonitoringTelemetryEvent.COMMAND_FAILED).toBeDefined();
    });

    it('should have valid performance budgets', () => {
        expect(MONITORING_PERFORMANCE_BUDGETS.GET_USAGE_MS).toBeGreaterThan(0);
        expect(MONITORING_PERFORMANCE_BUDGETS.GET_SYSTEM_MONITOR_MS).toBeGreaterThan(0);
        expect(MONITORING_PERFORMANCE_BUDGETS.GET_BATTERY_STATUS_MS).toBeGreaterThan(0);
        expect(MONITORING_PERFORMANCE_BUDGETS.COLLECT_ALL_METRICS_MS).toBeGreaterThan(0);
        expect(MONITORING_PERFORMANCE_BUDGETS.INITIALIZE_MS).toBeGreaterThan(0);
        expect(MONITORING_PERFORMANCE_BUDGETS.CLEANUP_MS).toBeGreaterThan(0);
    });
});

describe('MonitoringService Lifecycle Regression (B-0452)', () => {
    it('should survive multiple init/cleanup cycles', async () => {
        const svc = new MonitoringService();

        for (let i = 0; i < 3; i++) {
            await svc.initialize();
            expect(svc.getTelemetry().telemetryEnabled).toBe(true);

            svc.recordMetric('cycle', i);
            expect(svc.getMetric('cycle').result?.value).toBe(i);

            await svc.cleanup();
            expect(svc.getTelemetry().telemetryEnabled).toBe(false);
            expect(svc.getMetric('cycle').success).toBe(false);
        }
    });

    it('should support full workflow: init → record → threshold → alert → collect → cleanup', async () => {
        const svc = new MonitoringService();
        await svc.initialize();

        // Record metrics
        expect(svc.recordMetric('cpu.usage', 72).success).toBe(true);
        expect(svc.recordMetric('mem.usage', 55).success).toBe(true);

        // Set thresholds
        expect(svc.setThreshold('cpu.usage', 90).success).toBe(true);

        // Configure alert
        const alert: AlertConfiguration = {
            metricName: 'cpu.usage',
            threshold: 85,
            direction: 'above',
            enabled: true,
        };
        expect(svc.configureAlert(alert).success).toBe(true);

        // Collect all metrics
        const collectResult = await svc.collectAllMetrics();
        expect(collectResult.result).toBeDefined();
        expect(collectResult.result?.usage).not.toBeNull();

        // Verify recorded metrics still accessible
        expect(svc.getMetric('cpu.usage').result?.value).toBe(72);
        expect(svc.getMetric('mem.usage').result?.value).toBe(55);

        // Cleanup
        await svc.cleanup();
        expect(svc.getMetric('cpu.usage').success).toBe(false);
        expect(svc.getMetric('mem.usage').success).toBe(false);
    });

    it('should isolate state between service instances', async () => {
        const svc1 = new MonitoringService();
        const svc2 = new MonitoringService();
        await svc1.initialize();
        await svc2.initialize();

        svc1.recordMetric('cpu', 10);
        svc2.recordMetric('cpu', 99);

        expect(svc1.getMetric('cpu').result?.value).toBe(10);
        expect(svc2.getMetric('cpu').result?.value).toBe(99);

        await svc1.cleanup();
        await svc2.cleanup();
    });
});

describe('MonitoringService Cross-Method Interaction (B-0452)', () => {
    let service: MonitoringService;

    beforeEach(async () => {
        vi.clearAllMocks();
        service = new MonitoringService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    it('should allow recording metric and setting threshold for same name', () => {
        expect(service.recordMetric('cpu', 50).success).toBe(true);
        expect(service.setThreshold('cpu', 80).success).toBe(true);
        expect(service.getMetric('cpu').result?.value).toBe(50);
    });

    it('should allow alert and metric for same name independently', () => {
        service.recordMetric('disk.io', 42);
        const alertResult = service.configureAlert({
            metricName: 'disk.io',
            threshold: 100,
            direction: 'above',
            enabled: true,
        });
        expect(alertResult.success).toBe(true);
        expect(service.getMetric('disk.io').result?.value).toBe(42);
    });

    it('should maintain getUsage results across multiple calls', async () => {
        const result1 = await service.getUsage();
        const result2 = await service.getUsage();

        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
        // Both should return valid numbers
        expect(typeof result1.result?.cpu).toBe('number');
        expect(typeof result2.result?.cpu).toBe('number');
    });
});

