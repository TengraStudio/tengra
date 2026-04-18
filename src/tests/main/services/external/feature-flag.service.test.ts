/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import * as path from 'path';

import { DataService } from '@main/services/data/data.service';
import { EvaluationContext, FeatureFlag, FeatureFlagError, FeatureFlagErrorCode, FeatureFlagService } from '@main/services/external/feature-flag.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FEATURES_PATH = path.join('/mock/config', 'features.json');

/** The 5 default council flags that FeatureFlagService always merges */
const DEFAULT_COUNCIL_FLAGS: FeatureFlag[] = [
    { id: 'council.planning', enabled: true, description: 'Enable council plan generation' },
    { id: 'council.routing', enabled: true, description: 'Enable quota-aware routing' },
    { id: 'council.teamwork', enabled: true, description: 'Enable multi-agent teamwork/reassignment' },
    { id: 'council.recovery', enabled: true, description: 'Enable crash-safe recovery' },
    { id: 'council.governance', enabled: true, description: 'Enable model governance enforcement' }
];

const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

const createService = (): FeatureFlagService => {
    const dataServiceMock: Pick<DataService, 'getPath'> = {
        getPath: vi.fn().mockReturnValue(path.join('/mock', 'config')),
    };

    return new FeatureFlagService(dataServiceMock as never as DataService);
};

describe('FeatureFlagService', () => {
    let service: FeatureFlagService;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
        vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

        service = createService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads feature flags from disk during initialization', async () => {
        const loadedFlags: FeatureFlag[] = [
            { id: 'alpha', enabled: true, description: 'Alpha feature' },
            { id: 'beta', enabled: false, description: 'Beta feature' },
        ];
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(loadedFlags));

        await service.initialize();

        expect(fs.promises.readFile).toHaveBeenCalledWith(FEATURES_PATH, 'utf-8');
        expect(service.isEnabled('alpha')).toBe(true);
        expect(service.isEnabled('beta')).toBe(false);
        const allFlags = service.getAllFlags();
        expect(allFlags).toHaveLength(loadedFlags.length + DEFAULT_COUNCIL_FLAGS.length);
        expect(allFlags).toEqual(expect.arrayContaining(loadedFlags));
        expect(allFlags).toEqual(expect.arrayContaining(DEFAULT_COUNCIL_FLAGS));
    });

    it('creates config directory when missing and persists toggle changes', async () => {
        const loadedFlags: FeatureFlag[] = [{ id: 'beta', enabled: false }];
        vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error('ENOENT'));
        vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(loadedFlags));

        await service.initialize();
        service.enable('beta');
        await flushMicrotasks();

        expect(fs.promises.mkdir).toHaveBeenCalledWith(path.join('/mock', 'config'), { recursive: true, mode: 0o700 });
        expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);

        const enablePayload = String(vi.mocked(fs.promises.writeFile).mock.calls[0]?.[1]);
        const enabledFlags = JSON.parse(enablePayload) as FeatureFlag[];
        expect(enabledFlags.find(flag => flag.id === 'beta')?.enabled).toBe(true);

        service.disable('beta');
        await flushMicrotasks();

        expect(fs.promises.writeFile).toHaveBeenCalledTimes(2);
        const disablePayload = String(vi.mocked(fs.promises.writeFile).mock.calls[1]?.[1]);
        const disabledFlags = JSON.parse(disablePayload) as FeatureFlag[];
        expect(disabledFlags.find(flag => flag.id === 'beta')?.enabled).toBe(false);
    });

    describe('isEnabled', () => {
        beforeEach(async () => {
            const flags: FeatureFlag[] = [
                { id: 'active', enabled: true, description: 'Active flag' },
                { id: 'inactive', enabled: false, description: 'Inactive flag' },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();
        });

        it('returns true for an enabled flag', () => {
            expect(service.isEnabled('active')).toBe(true);
        });

        it('returns false for a disabled flag', () => {
            expect(service.isEnabled('inactive')).toBe(false);
        });

        it('returns false for an unknown flag', () => {
            expect(service.isEnabled('nonexistent')).toBe(false);
        });

        it('returns false for empty string', () => {
            expect(service.isEnabled('')).toBe(false);
        });

        it('returns false for whitespace-only string', () => {
            expect(service.isEnabled('   ')).toBe(false);
        });

        it('returns false for non-string input', () => {
            expect(service.isEnabled(123 as never as string)).toBe(false);
            expect(service.isEnabled(null as never as string)).toBe(false);
            expect(service.isEnabled(undefined as never as string)).toBe(false);
        });

        it('returns false for oversized featureId', () => {
            expect(service.isEnabled('a'.repeat(257))).toBe(false);
        });

        it('returns false for featureId with invalid characters', () => {
            expect(service.isEnabled('flag with spaces')).toBe(false);
            expect(service.isEnabled('flag!@#')).toBe(false);
        });
    });

    describe('enable', () => {
        beforeEach(async () => {
            const flags: FeatureFlag[] = [
                { id: 'feat', enabled: false, description: 'A feature' },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();
            vi.mocked(fs.promises.writeFile).mockClear();
        });

        it('enables an existing flag and persists', async () => {
            service.enable('feat');
            await flushMicrotasks();

            expect(service.isEnabled('feat')).toBe(true);
            expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
        });

        it('does nothing for an unknown flag', async () => {
            service.enable('unknown');
            await flushMicrotasks();

            expect(fs.promises.writeFile).not.toHaveBeenCalled();
        });

        it('throws for empty featureId', () => {
            expect(() => service.enable('')).toThrow(FeatureFlagError);
            expect(fs.promises.writeFile).not.toHaveBeenCalled();
        });

        it('throws for non-string featureId', () => {
            expect(() => service.enable(null as never as string)).toThrow(FeatureFlagError);
        });

        it('throws for oversized featureId', () => {
            expect(() => service.enable('a'.repeat(257))).toThrow(FeatureFlagError);
        });

        it('throws for featureId with invalid characters', () => {
            expect(() => service.enable('feat flag!')).toThrow(FeatureFlagError);
        });
    });

    describe('disable', () => {
        beforeEach(async () => {
            const flags: FeatureFlag[] = [
                { id: 'feat', enabled: true, description: 'A feature' },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();
            vi.mocked(fs.promises.writeFile).mockClear();
        });

        it('disables an existing flag and persists', async () => {
            service.disable('feat');
            await flushMicrotasks();

            expect(service.isEnabled('feat')).toBe(false);
            expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
        });

        it('does nothing for an unknown flag', async () => {
            service.disable('unknown');
            await flushMicrotasks();

            expect(fs.promises.writeFile).not.toHaveBeenCalled();
        });

        it('throws for empty featureId', () => {
            expect(() => service.disable('')).toThrow(FeatureFlagError);
            expect(fs.promises.writeFile).not.toHaveBeenCalled();
        });

        it('throws for non-string featureId', () => {
            expect(() => service.disable(undefined as never as string)).toThrow(FeatureFlagError);
        });

        it('throws for oversized featureId', () => {
            expect(() => service.disable('a'.repeat(257))).toThrow(FeatureFlagError);
        });

        it('throws for featureId with invalid characters', () => {
            expect(() => service.disable('feat flag!')).toThrow(FeatureFlagError);
        });
    });

    describe('getAllFlags', () => {
        it('returns default council flags when no flags loaded from disk', async () => {
            await service.initialize();
            expect(service.getAllFlags()).toEqual(DEFAULT_COUNCIL_FLAGS);
        });

        it('returns all flags as array', async () => {
            const flags: FeatureFlag[] = [
                { id: 'a', enabled: true },
                { id: 'b', enabled: false },
                { id: 'c', enabled: true, description: 'Third' },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();

            const result = service.getAllFlags();
            expect(result).toHaveLength(flags.length + DEFAULT_COUNCIL_FLAGS.length);
            expect(result).toEqual(expect.arrayContaining(flags));
            expect(result).toEqual(expect.arrayContaining(DEFAULT_COUNCIL_FLAGS));
        });
    });

    describe('loadFlags', () => {
        it('falls back to defaults when file read fails', async () => {
            vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('ENOENT'));
            await service.initialize();

            // defaults are the 5 council flags
            expect(service.getAllFlags()).toEqual(DEFAULT_COUNCIL_FLAGS);
        });

        it('loads flags from disk on initialize', async () => {
            const flags: FeatureFlag[] = [{ id: 'disk-flag', enabled: true }];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();

            expect(service.isEnabled('disk-flag')).toBe(true);
        });
    });

    describe('saveFlags', () => {
        it('writes flags to disk when enable is called', async () => {
            const flags: FeatureFlag[] = [{ id: 'x', enabled: false }];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();
            vi.mocked(fs.promises.writeFile).mockClear();

            service.enable('x');
            await flushMicrotasks();

            expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
            const written = JSON.parse(
                String(vi.mocked(fs.promises.writeFile).mock.calls[0]?.[1])
            ) as FeatureFlag[];
            expect(written.find(f => f.id === 'x')?.enabled).toBe(true);
        });

        it('writes flags to disk when disable is called', async () => {
            const flags: FeatureFlag[] = [{ id: 'y', enabled: true }];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();
            vi.mocked(fs.promises.writeFile).mockClear();

            service.disable('y');
            await flushMicrotasks();

            expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
            const written = JSON.parse(
                String(vi.mocked(fs.promises.writeFile).mock.calls[0]?.[1])
            ) as FeatureFlag[];
            expect(written.find(f => f.id === 'y')?.enabled).toBe(false);
        });

        it('does not write when save encounters an error', async () => {
            const flags: FeatureFlag[] = [{ id: 'z', enabled: false }];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();

            vi.mocked(fs.promises.writeFile).mockRejectedValue(new Error('disk full'));

            service.enable('z');
            await flushMicrotasks();

            // saveFlags should catch the error, flag still updated in memory
            expect(service.isEnabled('z')).toBe(true);
        });

        it('keeps in-memory state when save fails during disable', async () => {
            const flags: FeatureFlag[] = [{ id: 'w', enabled: true }];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();

            vi.mocked(fs.promises.writeFile).mockRejectedValue(new Error('permission denied'));

            service.disable('w');
            await flushMicrotasks();

            expect(service.isEnabled('w')).toBe(false);
        });
    });

    describe('getHealth', () => {
        it('returns correct counts for default flags', async () => {
            await service.initialize();

            const health = service.getHealth();
            expect(health.totalFlags).toBe(DEFAULT_COUNCIL_FLAGS.length);
            expect(health.enabledFlags).toBe(DEFAULT_COUNCIL_FLAGS.filter(f => f.enabled).length);
            expect(health.flagIds).toEqual(DEFAULT_COUNCIL_FLAGS.map(f => f.id));
        });

        it('reflects changes after enabling and disabling flags', async () => {
            const flags: FeatureFlag[] = [
                { id: 'on', enabled: true },
                { id: 'off', enabled: false },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();

            const healthBefore = service.getHealth();
            const enabledBefore = healthBefore.enabledFlags;

            service.disable('on');
            const healthAfter = service.getHealth();
            expect(healthAfter.enabledFlags).toBe(enabledBefore - 1);
        });

        it('includes both disk-loaded and default flag ids', async () => {
            const flags: FeatureFlag[] = [{ id: 'custom.flag', enabled: true }];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();

            const health = service.getHealth();
            expect(health.flagIds).toContain('custom.flag');
            for (const def of DEFAULT_COUNCIL_FLAGS) {
                expect(health.flagIds).toContain(def.id);
            }
        });
    });

    describe('cleanup', () => {
        it('can be called without errors after initialization', async () => {
            await service.initialize();
            await expect(service.cleanup()).resolves.toBeUndefined();
        });

        it('can be called without prior initialization', async () => {
            await expect(service.cleanup()).resolves.toBeUndefined();
        });
    });

    describe('default flag merging', () => {
        it('preserves disk flag state when id overlaps with a default', async () => {
            const diskFlags: FeatureFlag[] = [
                { id: 'council.planning', enabled: false, description: 'Overridden from disk' },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(diskFlags));
            await service.initialize();

            // Disk value (false) should take precedence over default (true)
            expect(service.isEnabled('council.planning')).toBe(false);
            const flag = service.getAllFlags().find(f => f.id === 'council.planning');
            expect(flag?.description).toBe('Overridden from disk');
        });

        it('adds missing defaults alongside disk flags', async () => {
            const diskFlags: FeatureFlag[] = [
                { id: 'council.planning', enabled: false },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(diskFlags));
            await service.initialize();

            // Other defaults should still be present
            expect(service.isEnabled('council.routing')).toBe(true);
            expect(service.isEnabled('council.teamwork')).toBe(true);
            expect(service.isEnabled('council.recovery')).toBe(true);
            expect(service.isEnabled('council.governance')).toBe(true);
        });
    });

    describe('error handling during loadFlags', () => {
        it('falls back to defaults when both access and readFile fail', async () => {
            vi.mocked(fs.promises.access).mockRejectedValue(new Error('ENOENT'));
            vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error('EPERM'));

            await service.initialize();

            // Should fall back to defaults in the outer catch
            expect(service.getAllFlags()).toEqual(DEFAULT_COUNCIL_FLAGS);
        });
    });

    describe('evaluate', () => {
        beforeEach(async () => {
            const flags: FeatureFlag[] = [
                { id: 'eval.flag', enabled: true, description: 'Eval flag' },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();
        });

        it('returns flag state for a valid featureId', () => {
            expect(service.evaluate('eval.flag')).toBe(true);
        });

        it('returns false for unknown flag', () => {
            expect(service.evaluate('unknown.flag')).toBe(false);
        });

        it('accepts valid evaluation context', () => {
            const context: EvaluationContext = {
                userId: 'user-123',
                environment: 'production',
                attributes: { plan: 'pro', seats: 5, beta: true },
            };
            expect(service.evaluate('eval.flag', context)).toBe(true);
        });

        it('returns false for empty featureId (safe fallback)', () => {
            expect(service.evaluate('')).toBe(false);
        });

        it('returns false for oversized featureId (safe fallback)', () => {
            expect(service.evaluate('a'.repeat(257))).toBe(false);
        });

        it('returns false for featureId with invalid characters (safe fallback)', () => {
            expect(service.evaluate('my flag!')).toBe(false);
        });

        it('returns false for non-object context (safe fallback)', () => {
            expect(service.evaluate('eval.flag', 'bad' as never as EvaluationContext)).toBe(false);
        });

        it('returns false for null context (safe fallback)', () => {
            expect(service.evaluate('eval.flag', null as never as EvaluationContext)).toBe(false);
        });

        it('returns false for array context (safe fallback)', () => {
            expect(service.evaluate('eval.flag', [] as never as EvaluationContext)).toBe(false);
        });

        it('returns false for empty userId (safe fallback)', () => {
            expect(service.evaluate('eval.flag', { userId: '' })).toBe(false);
        });

        it('returns false for oversized userId (safe fallback)', () => {
            expect(service.evaluate('eval.flag', { userId: 'x'.repeat(513) })).toBe(false);
        });

        it('returns false for empty environment (safe fallback)', () => {
            expect(service.evaluate('eval.flag', { environment: '   ' })).toBe(false);
        });

        it('returns false for oversized environment (safe fallback)', () => {
            expect(service.evaluate('eval.flag', { environment: 'e'.repeat(513) })).toBe(false);
        });

        it('returns false when attributes is not a plain object (safe fallback)', () => {
            expect(
                service.evaluate('eval.flag', { attributes: 'bad' as never as Record<string, string> })
            ).toBe(false);
        });

        it('returns false when attributes exceed max count (safe fallback)', () => {
            const attributes: Record<string, string> = {};
            for (let i = 0; i < 51; i++) {
                attributes[`key${i}`] = 'val';
            }
            expect(service.evaluate('eval.flag', { attributes })).toBe(false);
        });

        it('returns false for invalid attribute value type (safe fallback)', () => {
            expect(
                service.evaluate('eval.flag', {
                    attributes: { bad: { nested: true } as never as string },
                })
            ).toBe(false);
        });

        it('returns false for oversized attribute string value (safe fallback)', () => {
            expect(
                service.evaluate('eval.flag', {
                    attributes: { big: 'x'.repeat(513) },
                })
            ).toBe(false);
        });

        it('respects overrides', () => {
            service.setOverride('eval.flag', false);
            expect(service.evaluate('eval.flag')).toBe(false);
        });
    });

    describe('setOverride', () => {
        beforeEach(async () => {
            const flags: FeatureFlag[] = [
                { id: 'over.flag', enabled: false, description: 'Override flag' },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();
        });

        it('overrides flag value for isEnabled', () => {
            service.setOverride('over.flag', true);
            expect(service.isEnabled('over.flag')).toBe(true);
        });

        it('throws for empty featureId', () => {
            expect(() => service.setOverride('', true)).toThrow(FeatureFlagError);
        });

        it('throws for oversized featureId', () => {
            expect(() => service.setOverride('a'.repeat(257), true)).toThrow(FeatureFlagError);
        });

        it('throws for non-boolean override value', () => {
            expect(() => service.setOverride('over.flag', 'yes' as never as boolean)).toThrow(FeatureFlagError);
            expect(() => service.setOverride('over.flag', 1 as never as boolean)).toThrow(FeatureFlagError);
            expect(() => service.setOverride('over.flag', null as never as boolean)).toThrow(FeatureFlagError);
        });
    });

    describe('clearOverride', () => {
        beforeEach(async () => {
            const flags: FeatureFlag[] = [
                { id: 'clr.flag', enabled: true, description: 'Clear flag' },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();
        });

        it('removes override so original flag value is used', () => {
            service.setOverride('clr.flag', false);
            expect(service.isEnabled('clr.flag')).toBe(false);
            service.clearOverride('clr.flag');
            expect(service.isEnabled('clr.flag')).toBe(true);
        });

        it('throws for empty featureId', () => {
            expect(() => service.clearOverride('')).toThrow(FeatureFlagError);
        });

        it('throws for featureId with invalid characters', () => {
            expect(() => service.clearOverride('flag with spaces')).toThrow(FeatureFlagError);
        });
    });
});

describe('FeatureFlagService error codes', () => {
    let service: FeatureFlagService;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
        vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
        vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

        service = createService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('FeatureFlagError typed errors', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        it('throws FeatureFlagError instance from enable()', () => {
            try {
                service.enable('');
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(FeatureFlagError);
                expect((error as FeatureFlagError).featureFlagCode).toBe(FeatureFlagErrorCode.INVALID_FEATURE_ID);
                expect((error as FeatureFlagError).code).toBe(FeatureFlagErrorCode.INVALID_FEATURE_ID);
            }
        });

        it('throws FeatureFlagError instance from disable()', () => {
            try {
                service.disable('flag!invalid');
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(FeatureFlagError);
                expect((error as FeatureFlagError).featureFlagCode).toBe(FeatureFlagErrorCode.INVALID_FEATURE_ID);
            }
        });

        it('throws FeatureFlagError instance from setOverride() with bad id', () => {
            try {
                service.setOverride('', true);
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(FeatureFlagError);
                expect((error as FeatureFlagError).featureFlagCode).toBe(FeatureFlagErrorCode.INVALID_FEATURE_ID);
            }
        });

        it('throws FeatureFlagError instance from setOverride() with bad value', () => {
            try {
                service.setOverride('council.planning', 'yes' as never as boolean);
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(FeatureFlagError);
                expect((error as FeatureFlagError).featureFlagCode).toBe(FeatureFlagErrorCode.INVALID_OVERRIDE);
            }
        });

        it('throws FeatureFlagError instance from clearOverride()', () => {
            try {
                service.clearOverride('');
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(FeatureFlagError);
                expect((error as FeatureFlagError).featureFlagCode).toBe(FeatureFlagErrorCode.INVALID_FEATURE_ID);
            }
        });

        it('FeatureFlagError has timestamp and context', () => {
            try {
                service.enable('a'.repeat(257));
                expect.fail('should have thrown');
            } catch (error) {
                const ffError = error as FeatureFlagError;
                expect(ffError.timestamp).toBeDefined();
                expect(typeof ffError.timestamp).toBe('string');
                expect(ffError.context).toBeDefined();
            }
        });
    });

    describe('evaluate fallback behavior', () => {
        beforeEach(async () => {
            const flags: FeatureFlag[] = [
                { id: 'safe.flag', enabled: true, description: 'Safe flag' },
            ];
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(flags));
            await service.initialize();
        });

        it('never throws for null featureId', () => {
            expect(() => service.evaluate(null as never as string)).not.toThrow();
            expect(service.evaluate(null as never as string)).toBe(false);
        });

        it('never throws for undefined featureId', () => {
            expect(() => service.evaluate(undefined as never as string)).not.toThrow();
            expect(service.evaluate(undefined as never as string)).toBe(false);
        });

        it('never throws for numeric featureId', () => {
            expect(() => service.evaluate(42 as never as string)).not.toThrow();
            expect(service.evaluate(42 as never as string)).toBe(false);
        });

        it('never throws for invalid context with valid featureId', () => {
            expect(() => service.evaluate('safe.flag', 123 as never as EvaluationContext)).not.toThrow();
            expect(service.evaluate('safe.flag', 123 as never as EvaluationContext)).toBe(false);
        });

        it('still returns true for valid enabled flag', () => {
            expect(service.evaluate('safe.flag')).toBe(true);
        });

        it('returns false for non-existent flag without throwing', () => {
            expect(service.evaluate('does.not.exist')).toBe(false);
        });

        it('returns override value when set', () => {
            service.setOverride('safe.flag', false);
            expect(service.evaluate('safe.flag')).toBe(false);
            service.clearOverride('safe.flag');
            expect(service.evaluate('safe.flag')).toBe(true);
        });
    });
});
