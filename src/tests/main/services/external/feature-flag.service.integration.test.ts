/**
 * Integration tests for FeatureFlagService (BACKLOG-0442)
 */
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
    promises: {
        access: vi.fn().mockRejectedValue({ code: 'ENOENT' }),
        mkdir: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockRejectedValue({ code: 'ENOENT' }),
        writeFile: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { DataService } from '@main/services/data/data.service';
import {
    FEATURE_FLAG_PERFORMANCE_BUDGETS,
    FeatureFlagError,
    FeatureFlagErrorCode,
    FeatureFlagService,
    FeatureFlagTelemetryEvent} from '@main/services/external/feature-flag.service';

describe('FeatureFlagService Integration', () => {
    let service: FeatureFlagService;
    const mockDataService = {
        getPath: vi.fn().mockReturnValue('/mock/config')
    } as unknown as DataService;

    beforeEach(async () => {
        vi.clearAllMocks();
        service = new FeatureFlagService(mockDataService);
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    it('should initialize with default flags', () => {
        const flags = service.getAllFlags();
        expect(Array.isArray(flags)).toBe(true);
    });

    it('should report health after initialization', () => {
        const health = service.getHealth();
        expect(typeof health.totalFlags).toBe('number');
        expect(typeof health.enabledFlags).toBe('number');
        expect(Array.isArray(health.flagIds)).toBe(true);
    });

    it('should return false for unknown feature', () => {
        expect(service.isEnabled('non_existent_flag')).toBe(false);
    });

    it('should return false for empty feature id', () => {
        expect(service.isEnabled('')).toBe(false);
    });

    it('should have valid error codes', () => {
        expect(FeatureFlagErrorCode.INVALID_FEATURE_ID).toBeDefined();
        expect(FeatureFlagErrorCode.LOAD_FAILED).toBeDefined();
        expect(FeatureFlagErrorCode.SAVE_FAILED).toBeDefined();
        expect(FeatureFlagErrorCode.NOT_FOUND).toBeDefined();
    });

    it('should have valid telemetry events', () => {
        expect(FeatureFlagTelemetryEvent.FLAG_CHECKED).toBeDefined();
        expect(FeatureFlagTelemetryEvent.FLAG_ENABLED).toBeDefined();
        expect(FeatureFlagTelemetryEvent.FLAG_DISABLED).toBeDefined();
        expect(FeatureFlagTelemetryEvent.FLAGS_LOADED).toBeDefined();
    });

    it('should have valid performance budgets', () => {
        expect(FEATURE_FLAG_PERFORMANCE_BUDGETS.IS_ENABLED_MS).toBeGreaterThan(0);
        expect(FEATURE_FLAG_PERFORMANCE_BUDGETS.ENABLE_MS).toBeGreaterThan(0);
        expect(FEATURE_FLAG_PERFORMANCE_BUDGETS.DISABLE_MS).toBeGreaterThan(0);
        expect(FEATURE_FLAG_PERFORMANCE_BUDGETS.LOAD_FLAGS_MS).toBeGreaterThan(0);
        expect(FEATURE_FLAG_PERFORMANCE_BUDGETS.SAVE_FLAGS_MS).toBeGreaterThan(0);
        expect(FEATURE_FLAG_PERFORMANCE_BUDGETS.GET_ALL_FLAGS_MS).toBeGreaterThan(0);
    });

    it('should have EVALUATION_FAILED error code', () => {
        expect(FeatureFlagErrorCode.EVALUATION_FAILED).toBe('FEATURE_FLAG_EVALUATION_FAILED');
    });

    it('evaluate never throws on invalid input', () => {
        expect(() => service.evaluate('')).not.toThrow();
        expect(service.evaluate('')).toBe(false);
    });

    it('evaluate returns false for null featureId', () => {
        expect(service.evaluate(null as unknown as string)).toBe(false);
    });

    it('mutation methods throw FeatureFlagError', () => {
        try {
            service.enable('');
            expect.fail('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(FeatureFlagError);
            expect((error as FeatureFlagError).featureFlagCode).toBe(FeatureFlagErrorCode.INVALID_FEATURE_ID);
        }
    });
});
