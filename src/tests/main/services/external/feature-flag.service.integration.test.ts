/**
 * Integration and regression tests for FeatureFlagService (BACKLOG-0442)
 */
import * as fs from 'fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { DataService } from '@main/services/data/data.service';
import {
    FEATURE_FLAG_PERFORMANCE_BUDGETS,
    FeatureFlag,
    FeatureFlagError,
    FeatureFlagErrorCode,
    FeatureFlagService,
    FeatureFlagTelemetryEvent,
} from '@main/services/external/feature-flag.service';

const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('FeatureFlagService Integration', () => {
    let service: FeatureFlagService;
    const mockDataService = {
        getPath: vi.fn().mockReturnValue('/mock/config'),
    } as never as DataService;

    beforeEach(async () => {
        vi.restoreAllMocks();
        vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
        vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
        service = new FeatureFlagService(mockDataService);
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
        vi.restoreAllMocks();
    });

    it('initializes with default flags', () => {
        const flags = service.getAllFlags();
        expect(Array.isArray(flags)).toBe(true);
        expect(flags.length).toBe(5);
    });

    it('reports health after initialization', () => {
        const health = service.getHealth();
        expect(typeof health.totalFlags).toBe('number');
        expect(typeof health.enabledFlags).toBe('number');
        expect(Array.isArray(health.flagIds)).toBe(true);
    });

    it('has all expected error codes', () => {
        expect(FeatureFlagErrorCode.INVALID_FEATURE_ID).toBeDefined();
        expect(FeatureFlagErrorCode.LOAD_FAILED).toBeDefined();
        expect(FeatureFlagErrorCode.SAVE_FAILED).toBeDefined();
        expect(FeatureFlagErrorCode.NOT_FOUND).toBeDefined();
        expect(FeatureFlagErrorCode.EVALUATION_FAILED).toBe('FEATURE_FLAG_EVALUATION_FAILED');
    });

    it('has all expected telemetry events', () => {
        expect(FeatureFlagTelemetryEvent.FLAG_CHECKED).toBeDefined();
        expect(FeatureFlagTelemetryEvent.FLAG_ENABLED).toBeDefined();
        expect(FeatureFlagTelemetryEvent.FLAG_DISABLED).toBeDefined();
        expect(FeatureFlagTelemetryEvent.FLAGS_LOADED).toBeDefined();
        expect(FeatureFlagTelemetryEvent.FLAGS_SAVED).toBeDefined();
        expect(FeatureFlagTelemetryEvent.FLAGS_LOAD_FAILED).toBeDefined();
    });

    it('has positive performance budgets', () => {
        const b = FEATURE_FLAG_PERFORMANCE_BUDGETS;
        expect(b.IS_ENABLED_MS).toBeGreaterThan(0);
        expect(b.ENABLE_MS).toBeGreaterThan(0);
        expect(b.DISABLE_MS).toBeGreaterThan(0);
        expect(b.LOAD_FLAGS_MS).toBeGreaterThan(0);
        expect(b.SAVE_FLAGS_MS).toBeGreaterThan(0);
        expect(b.GET_ALL_FLAGS_MS).toBeGreaterThan(0);
    });
});

describe('FeatureFlagService lifecycle flows (B-0442)', () => {
    let service: FeatureFlagService;
    const mockDataService = {
        getPath: vi.fn().mockReturnValue('/mock/config'),
    } as never as DataService;

    beforeEach(async () => {
        vi.restoreAllMocks();
        vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
        vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
        service = new FeatureFlagService(mockDataService);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('enable → evaluate → disable → evaluate lifecycle', async () => {
        const flags: FeatureFlag[] = [{ id: 'lifecycle.flag', enabled: false }];
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
        await service.initialize();

        expect(service.evaluate('lifecycle.flag')).toBe(false);

        service.enable('lifecycle.flag');
        await flushMicrotasks();
        expect(service.evaluate('lifecycle.flag')).toBe(true);

        service.disable('lifecycle.flag');
        await flushMicrotasks();
        expect(service.evaluate('lifecycle.flag')).toBe(false);
    });

    it('override → evaluate → clear → evaluate lifecycle', async () => {
        await service.initialize();

        service.setOverride('council.planning', false);
        expect(service.evaluate('council.planning')).toBe(false);

        service.clearOverride('council.planning');
        expect(service.evaluate('council.planning')).toBe(true);
    });

    it('disk load → modify → verify persistence payload', async () => {
        const initial: FeatureFlag[] = [
            { id: 'persist.flag', enabled: false, description: 'Persist test' },
        ];
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(initial));
        await service.initialize();

        service.enable('persist.flag');
        await flushMicrotasks();

        expect(fs.promises.writeFile).toHaveBeenCalled();
        const written = JSON.parse(
            String(vi.mocked(fs.promises.writeFile).mock.calls[0]?.[1])
        ) as FeatureFlag[];
        const saved = written.find(f => f.id === 'persist.flag');
        expect(saved?.enabled).toBe(true);
        expect(saved?.description).toBe('Persist test');
    });

    it('health reflects real-time state changes', async () => {
        await service.initialize();
        const before = service.getHealth();

        service.disable('council.planning');
        const after = service.getHealth();
        expect(after.enabledFlags).toBe(before.enabledFlags - 1);

        service.enable('council.planning');
        const restored = service.getHealth();
        expect(restored.enabledFlags).toBe(before.enabledFlags);
    });

    it('multiple rapid toggles produce consistent state', async () => {
        await service.initialize();

        service.disable('council.routing');
        service.enable('council.routing');
        service.disable('council.routing');
        service.enable('council.routing');
        await flushMicrotasks();

        expect(service.isEnabled('council.routing')).toBe(true);
    });
});

describe('FeatureFlagService regression tests (B-0442)', () => {
    let service: FeatureFlagService;
    const mockDataService = {
        getPath: vi.fn().mockReturnValue('/mock/config'),
    } as never as DataService;

    beforeEach(async () => {
        vi.restoreAllMocks();
        vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
        vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
        service = new FeatureFlagService(mockDataService);
        await service.initialize();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('REGRESSION: evaluate() never throws regardless of input', () => {
        const badInputs = [
            null, undefined, 42, true, {}, [], '', '   ',
            'a'.repeat(300), 'flag!@#', NaN, Infinity,
        ];
        for (const input of badInputs) {
            expect(() => service.evaluate(input as never as string)).not.toThrow();
            expect(service.evaluate(input as never as string)).toBe(false);
        }
    });

    it('REGRESSION: evaluate with malformed contexts never throws', () => {
        const badContexts = [
            'string', 42, true, null, [],
            { userId: 123 },
            { environment: '' },
            { attributes: 'not-an-object' },
            { attributes: null },
            { attributes: [1, 2, 3] },
        ];
        for (const ctx of badContexts) {
            expect(() =>
                service.evaluate('council.planning', ctx as never as never)
            ).not.toThrow();
        }
    });

    it('REGRESSION: mutation methods throw typed FeatureFlagError', () => {
        const mutations = [
            () => service.enable(''),
            () => service.disable(''),
            () => service.setOverride('', true),
            () => service.clearOverride(''),
            () => service.setOverride('valid.id', 'yes' as never as boolean),
        ];
        for (const fn of mutations) {
            try {
                fn();
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(FeatureFlagError);
                expect((error as FeatureFlagError).featureFlagCode).toBeDefined();
            }
        }
    });

    it('REGRESSION: loadFlags fallback keeps service functional', async () => {
        vi.mocked(fs.promises.access).mockRejectedValue(new Error('EPERM'));
        vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error('EPERM'));

        const svc = new FeatureFlagService(mockDataService);
        await svc.initialize();

        expect(svc.getAllFlags().length).toBe(5);
        expect(svc.isEnabled('council.planning')).toBe(true);
        expect(svc.evaluate('council.planning')).toBe(true);
    });

    it('REGRESSION: cleanup after initialize completes cleanly', async () => {
        await expect(service.cleanup()).resolves.toBeUndefined();
    });

    it('REGRESSION: cleanup without initialize completes cleanly', async () => {
        const svc = new FeatureFlagService(mockDataService);
        await expect(svc.cleanup()).resolves.toBeUndefined();
    });
});
