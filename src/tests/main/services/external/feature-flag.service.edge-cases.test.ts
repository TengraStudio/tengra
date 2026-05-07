/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Edge-case and boundary-value tests for FeatureFlagService (BACKLOG-0441)
 * Covers boundary lengths, idempotent operations, and defensive behaviors.
 */
import * as fs from 'fs';

import { DataService } from '@main/services/data/data.service';
import {
    FEATURE_FLAG_PERFORMANCE_BUDGETS,
    FeatureFlagError,
    FeatureFlagErrorCode,
    FeatureFlagService,
} from '@main/services/external/feature-flag.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MAX_FLAG_ID_LENGTH = 256;
const MAX_CONTEXT_ATTRIBUTES = 50;
const MAX_CONTEXT_VALUE_LENGTH = 512;

const createService = (): FeatureFlagService => {
    const mock: Pick<DataService, 'getPath'> = {
        getPath: vi.fn().mockReturnValue('/mock/config'),
    };
    return new FeatureFlagService(mock as never as DataService);
};

const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('FeatureFlagService edge-case boundaries (B-0441)', () => {
    let service: FeatureFlagService;

    beforeEach(async () => {
        vi.restoreAllMocks();
        vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
        vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
        service = createService();
        await service.initialize();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('flag ID boundary lengths', () => {
        it('accepts flag ID at exactly MAX_FLAG_ID_LENGTH', () => {
            const id = 'a'.repeat(MAX_FLAG_ID_LENGTH);
            expect(service.isEnabled(id)).toBe(false);
            expect(() => service.setOverride(id, true)).not.toThrow();
            expect(service.isEnabled(id)).toBe(true);
        });

        it('rejects flag ID at MAX_FLAG_ID_LENGTH + 1', () => {
            const id = 'a'.repeat(MAX_FLAG_ID_LENGTH + 1);
            expect(service.isEnabled(id)).toBe(false);
            expect(() => service.setOverride(id, true)).toThrow(FeatureFlagError);
        });

        it('accepts single-character flag ID', () => {
            expect(service.isEnabled('x')).toBe(false);
            expect(() => service.setOverride('x', true)).not.toThrow();
        });

        it('accepts flag IDs with dots, hyphens, underscores', () => {
            const ids = ['a.b.c', 'a-b-c', 'a_b_c', 'A.B-C_D.123'];
            for (const id of ids) {
                expect(service.isEnabled(id)).toBe(false);
            }
        });
    });

    describe('context attribute boundaries', () => {
        it('accepts exactly MAX_CONTEXT_ATTRIBUTES attributes', () => {
            const attributes: Record<string, string> = {};
            for (let i = 0; i < MAX_CONTEXT_ATTRIBUTES; i++) {
                attributes[`key${i}`] = 'val';
            }
            const result = service.evaluate('council.planning', { attributes });
            expect(result).toBe(true);
        });

        it('rejects MAX_CONTEXT_ATTRIBUTES + 1 attributes', () => {
            const attributes: Record<string, string> = {};
            for (let i = 0; i <= MAX_CONTEXT_ATTRIBUTES; i++) {
                attributes[`key${i}`] = 'val';
            }
            expect(service.evaluate('council.planning', { attributes })).toBe(false);
        });

        it('accepts attribute string value at exactly MAX_CONTEXT_VALUE_LENGTH', () => {
            const result = service.evaluate('council.planning', {
                attributes: { big: 'x'.repeat(MAX_CONTEXT_VALUE_LENGTH) },
            });
            expect(result).toBe(true);
        });

        it('rejects attribute string value at MAX_CONTEXT_VALUE_LENGTH + 1', () => {
            const result = service.evaluate('council.planning', {
                attributes: { big: 'x'.repeat(MAX_CONTEXT_VALUE_LENGTH + 1) },
            });
            expect(result).toBe(false);
        });

        it('accepts userId at exactly MAX_CONTEXT_VALUE_LENGTH', () => {
            const result = service.evaluate('council.planning', {
                userId: 'u'.repeat(MAX_CONTEXT_VALUE_LENGTH),
            });
            expect(result).toBe(true);
        });

        it('rejects userId at MAX_CONTEXT_VALUE_LENGTH + 1', () => {
            const result = service.evaluate('council.planning', {
                userId: 'u'.repeat(MAX_CONTEXT_VALUE_LENGTH + 1),
            });
            expect(result).toBe(false);
        });

        it('accepts environment at exactly MAX_CONTEXT_VALUE_LENGTH', () => {
            const result = service.evaluate('council.planning', {
                environment: 'e'.repeat(MAX_CONTEXT_VALUE_LENGTH),
            });
            expect(result).toBe(true);
        });

        it('accepts empty attributes object', () => {
            const result = service.evaluate('council.planning', { attributes: {} });
            expect(result).toBe(true);
        });

        it('accepts context with all fields populated', () => {
            const result = service.evaluate('council.planning', {
                userId: 'user-1',
                environment: 'staging',
                attributes: { plan: 'pro', seats: 5, beta: true },
            });
            expect(result).toBe(true);
        });
    });

    describe('idempotent operations', () => {
        it('enable on already-enabled flag is idempotent', async () => {
            expect(service.isEnabled('council.planning')).toBe(true);
            service.enable('council.planning');
            await flushMicrotasks();
            expect(service.isEnabled('council.planning')).toBe(true);
        });

        it('disable on already-disabled flag is idempotent', async () => {
            service.disable('council.routing');
            await flushMicrotasks();
            vi.mocked(fs.promises.writeFile).mockClear();

            service.disable('council.routing');
            await flushMicrotasks();
            expect(service.isEnabled('council.routing')).toBe(false);
            expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
        });

        it('clearOverride on non-existent override does not throw', () => {
            expect(() => service.clearOverride('council.planning')).not.toThrow();
        });

        it('setOverride for non-existent flag creates override', () => {
            service.setOverride('nonexistent.flag', true);
            expect(service.isEnabled('nonexistent.flag')).toBe(true);
            service.clearOverride('nonexistent.flag');
            expect(service.isEnabled('nonexistent.flag')).toBe(false);
        });
    });

    describe('override priority', () => {
        it('override true wins over disabled flag', () => {
            service.disable('council.planning');
            service.setOverride('council.planning', true);
            expect(service.isEnabled('council.planning')).toBe(true);
            expect(service.evaluate('council.planning')).toBe(true);
        });

        it('override false wins over enabled flag', () => {
            service.setOverride('council.planning', false);
            expect(service.isEnabled('council.planning')).toBe(false);
            expect(service.evaluate('council.planning')).toBe(false);
        });

        it('clearing override restores underlying flag state', () => {
            service.setOverride('council.planning', false);
            expect(service.isEnabled('council.planning')).toBe(false);
            service.clearOverride('council.planning');
            expect(service.isEnabled('council.planning')).toBe(true);
        });
    });

    describe('error code specificity', () => {
        it('blank featureId yields INVALID_FEATURE_ID code', () => {
            try {
                service.enable('   ');
                expect.fail('should have thrown');
            } catch (error) {
                const e = error as FeatureFlagError;
                expect(e.featureFlagCode).toBe(FeatureFlagErrorCode.INVALID_FEATURE_ID);
            }
        });

        it('non-boolean setOverride yields INVALID_OVERRIDE code', () => {
            try {
                service.setOverride('council.planning', 0 as never as boolean);
                expect.fail('should have thrown');
            } catch (error) {
                const e = error as FeatureFlagError;
                expect(e.featureFlagCode).toBe(FeatureFlagErrorCode.INVALID_OVERRIDE);
            }
        });

        it('FeatureFlagError serialises to JSON correctly', () => {
            try {
                service.enable('');
                expect.fail('should have thrown');
            } catch (error) {
                const e = error as FeatureFlagError;
                const json = e.toJSON();
                expect(json.name).toBe('FeatureFlagError');
                expect(json.code).toBe(FeatureFlagErrorCode.INVALID_FEATURE_ID);
                expect(json.timestamp).toBeDefined();
            }
        });
    });

    describe('getHealth edge cases', () => {
        it('returns zero counts before initialization', () => {
            const freshService = createService();
            const health = freshService.getHealth();
            expect(health.totalFlags).toBe(0);
            expect(health.enabledFlags).toBe(0);
            expect(health.flagIds).toEqual([]);
        });

        it('counts reflect overrides do not alter flag map', () => {
            service.setOverride('council.planning', false);
            const health = service.getHealth();
            // getHealth reports underlying flags, not overrides
            expect(health.enabledFlags).toBe(5);
        });
    });

    describe('performance budget constants (B-0446)', () => {
        it('isEnabled completes within budget', () => {
            const start = performance.now();
            for (let i = 0; i < 1000; i++) {
                service.isEnabled('council.planning');
            }
            const elapsed = (performance.now() - start) / 1000;
            expect(elapsed).toBeLessThan(FEATURE_FLAG_PERFORMANCE_BUDGETS.IS_ENABLED_MS);
        });

        it('evaluate completes within budget', () => {
            const start = performance.now();
            for (let i = 0; i < 1000; i++) {
                service.evaluate('council.planning');
            }
            const elapsed = (performance.now() - start) / 1000;
            expect(elapsed).toBeLessThan(FEATURE_FLAG_PERFORMANCE_BUDGETS.IS_ENABLED_MS);
        });

        it('getAllFlags completes within budget', () => {
            const start = performance.now();
            service.getAllFlags();
            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(FEATURE_FLAG_PERFORMANCE_BUDGETS.GET_ALL_FLAGS_MS);
        });

        it('all budget values are positive numbers', () => {
            const budgets = FEATURE_FLAG_PERFORMANCE_BUDGETS;
            expect(budgets.IS_ENABLED_MS).toBeGreaterThan(0);
            expect(budgets.ENABLE_MS).toBeGreaterThan(0);
            expect(budgets.DISABLE_MS).toBeGreaterThan(0);
            expect(budgets.LOAD_FLAGS_MS).toBeGreaterThan(0);
            expect(budgets.SAVE_FLAGS_MS).toBeGreaterThan(0);
            expect(budgets.GET_ALL_FLAGS_MS).toBeGreaterThan(0);
        });
    });

    describe('malformed disk data', () => {
        it('handles empty JSON array from disk', async () => {
            vi.mocked(fs.promises.readFile).mockResolvedValue('[]');
            const svc = createService();
            await svc.initialize();
            // Should still have default council flags
            expect(svc.getAllFlags().length).toBe(5);
        });

        it('handles invalid JSON from disk gracefully', async () => {
            vi.mocked(fs.promises.readFile).mockResolvedValue('{not valid json');
            const svc = createService();
            await svc.initialize();
            expect(svc.getAllFlags().length).toBe(5);
        });

        it('handles null JSON value from disk', async () => {
            vi.mocked(fs.promises.readFile).mockResolvedValue('null');
            const svc = createService();
            await svc.initialize();
            expect(svc.getAllFlags().length).toBe(5);
        });
    });
});

