/**
 * Integration tests for MonitoringService (BACKLOG-0452)
 */
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import {
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
