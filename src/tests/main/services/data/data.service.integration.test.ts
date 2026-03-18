/**
 * DataService Integration Tests
 * Tests the full lifecycle: initialize → getPath → getAllPaths → cleanup
 */

import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: vi.fn().mockReturnValue('/mock/userData') }
}));

vi.mock('fs/promises', () => ({
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import * as fsp from 'fs/promises';
import * as path from 'path';

import type { TelemetryService } from '@main/services/analysis/telemetry.service';
import type { DataType } from '@main/services/data/data.service';
import {
    DATA_SERVICE_PERFORMANCE_BUDGETS,
    DataService,
    DataServiceErrorCode,
    DataServiceTelemetryEvent} from '@main/services/data/data.service';

describe('DataService Integration', () => {
    let service: DataService;

    beforeEach(async () => {
        vi.clearAllMocks();
        service = new DataService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    it('should complete full lifecycle: initialize → getPath → getAllPaths → cleanup', async () => {
        expect(service.isInitialized()).toBe(true);

        const dbPath = service.getPath('db');
        expect(typeof dbPath).toBe('string');
        expect(dbPath.length).toBeGreaterThan(0);

        const allPaths = service.getAllPaths();
        expect(typeof allPaths).toBe('object');
        expect(allPaths.db).toBe(dbPath);

        await service.cleanup();
        expect(service.isInitialized()).toBe(false);
    });

    it('should have valid error codes', () => {
        expect(DataServiceErrorCode.INITIALIZATION_FAILED).toBeDefined();
        expect(DataServiceErrorCode.PATH_TYPE_INVALID).toBeDefined();
        expect(DataServiceErrorCode.DIRECTORY_CREATE_FAILED).toBeDefined();
        expect(DataServiceErrorCode.PERMISSION_DENIED).toBeDefined();
    });

    it('should have valid telemetry events', () => {
        expect(DataServiceTelemetryEvent.INITIALIZE_START).toBeDefined();
        expect(DataServiceTelemetryEvent.INITIALIZE_COMPLETE).toBeDefined();
        expect(DataServiceTelemetryEvent.PATH_ACCESSED).toBeDefined();
    });

    it('should have valid performance budgets', () => {
        expect(DATA_SERVICE_PERFORMANCE_BUDGETS.INITIALIZE_MS).toBe(5000);
        expect(DATA_SERVICE_PERFORMANCE_BUDGETS.GET_PATH_MS).toBe(10);
    });

    it('should return paths for all valid data types', () => {
        const validTypes: DataType[] = ['db', 'config', 'logs', 'models', 'gallery', 'galleryImages', 'galleryVideos', 'data'];
        for (const type of validTypes) {
            const p = service.getPath(type);
            expect(typeof p).toBe('string');
            expect(p.length).toBeGreaterThan(0);
        }
    });

    it('should return a base directory string', () => {
        const baseDir = service.getBaseDir();
        expect(typeof baseDir).toBe('string');
        expect(baseDir).toContain('userData');
    });

    it('should return a copy of paths from getAllPaths', () => {
        const paths1 = service.getAllPaths();
        const paths2 = service.getAllPaths();
        expect(paths1).toEqual(paths2);
        expect(paths1).not.toBe(paths2);
    });

    it('should throw on invalid data type after initialization', () => {
        expect(() => service.getPath('invalid' as DataType)).toThrow();
    });

    it('should be safe to call cleanup multiple times', async () => {
        await service.cleanup();
        await expect(service.cleanup()).resolves.toBeUndefined();
    });

    describe('telemetry lifecycle (B-0485)', () => {
        it('should track events through full init→use→cleanup cycle', async () => {
            const freshService = new DataService();
            const trackFn = vi.fn().mockReturnValue({ success: true });
            freshService.setTelemetryService({ track: trackFn } as never as TelemetryService);

            await freshService.initialize();
            freshService.getPath('db');
            await freshService.cleanup();

            const eventNames = trackFn.mock.calls.map((c: TestValue[]) => c[0]);
            expect(eventNames).toContain(DataServiceTelemetryEvent.INITIALIZE_START);
            expect(eventNames).toContain(DataServiceTelemetryEvent.INITIALIZE_COMPLETE);
            expect(eventNames.filter(
                (e): boolean => e === DataServiceTelemetryEvent.PATH_ACCESSED
            ).length).toBe(1);
        });

        it('should include durationMs in initialize complete event', async () => {
            const freshService = new DataService();
            const trackFn = vi.fn().mockReturnValue({ success: true });
            freshService.setTelemetryService({ track: trackFn } as never as TelemetryService);

            await freshService.initialize();

            const completeCall = trackFn.mock.calls.find(
                (c: TestValue[]) => c[0] === DataServiceTelemetryEvent.INITIALIZE_COMPLETE
            );
            expect(completeCall).toBeDefined();
            const props = completeCall![1] as Record<string, TestValue>;
            expect(typeof props.durationMs).toBe('number');
            expect(props.success).toBe(true);
            await freshService.cleanup();
        });
    });

    describe('migration flow regression (B-0482)', () => {
        it('should survive migrate when no old paths exist', async () => {
            vi.mocked(fsp.access).mockRejectedValue(new Error('ENOENT'));
            await expect(service.migrate()).resolves.toBeUndefined();
        });

        it('should survive migrate when readdir throws', async () => {
            vi.mocked(fsp.access).mockResolvedValue(undefined);
            vi.mocked(fsp.readdir).mockRejectedValue(new Error('IO error'));
            await expect(service.migrate()).resolves.toBeUndefined();
        });

        it('should survive migrate when rename throws', async () => {
            vi.mocked(fsp.access).mockResolvedValue(undefined);
            vi.mocked(fsp.readdir).mockResolvedValue([] as Awaited<ReturnType<typeof fsp.readdir>>);
            vi.mocked(fsp.rename).mockRejectedValue(new Error('EPERM'));
            await expect(service.migrate()).resolves.toBeUndefined();
        });
    });

    describe('re-initialization regression (B-0482)', () => {
        it('should re-initialize cleanly after cleanup', async () => {
            await service.cleanup();
            expect(service.isInitialized()).toBe(false);

            await service.initialize();
            expect(service.isInitialized()).toBe(true);

            const p = service.getPath('logs');
            expect(typeof p).toBe('string');
        });

        it('should maintain consistent paths across re-init cycles', async () => {
            const pathsBefore = service.getAllPaths();
            await service.cleanup();
            await service.initialize();
            const pathsAfter = service.getAllPaths();
            expect(pathsAfter).toEqual(pathsBefore);
        });
    });

    describe('error propagation regression (B-0484)', () => {
        it('should propagate DIRECTORY_CREATE_FAILED on init failure', async () => {
            const freshService = new DataService();
            vi.mocked(fsp.mkdir).mockRejectedValueOnce(new Error('ENOSPC'));

            try {
                await freshService.initialize();
                expect.fail('Should have thrown');
            } catch (error) {
                const err = error as Error & { code?: string };
                expect(err.code).toBe(DataServiceErrorCode.DIRECTORY_CREATE_FAILED);
            }
        });

        it('should propagate PATH_TYPE_INVALID for bad type on initialized service', () => {
            try {
                service.getPath('__proto__' as DataType);
                expect.fail('Should have thrown');
            } catch (error) {
                const err = error as Error & { code?: string };
                expect(err.code).toBe(DataServiceErrorCode.PATH_TYPE_INVALID);
            }
        });

        it('should include the invalid type name in the error message', () => {
            try {
                service.getPath('badtype' as DataType);
                expect.fail('Should have thrown');
            } catch (error) {
                const err = error as Error;
                expect(err.message).toContain('badtype');
            }
        });
    });

    describe('input validation guards (B-0483)', () => {
        it('should reject prototype pollution attempts via getPath', () => {
            const attacks = ['__proto__', 'constructor', 'prototype'];
            for (const atk of attacks) {
                expect(() => service.getPath(atk as DataType)).toThrow();
            }
        });

        it('should validate path traversal protection', () => {
            const root = path.resolve('/safe/root');
            const inside = path.join(root, 'sub', 'file.txt');
            const outside = path.resolve('/other/dir');
            expect(service.validatePath(inside, root)).toBe(true);
            expect(service.validatePath(outside, root)).toBe(false);
        });
    });

    describe('performance budgets verification (B-0486)', () => {
        it('should define all expected budget keys', () => {
            expect(DATA_SERVICE_PERFORMANCE_BUDGETS).toHaveProperty('INITIALIZE_MS');
            expect(DATA_SERVICE_PERFORMANCE_BUDGETS).toHaveProperty('MIGRATE_MS');
            expect(DATA_SERVICE_PERFORMANCE_BUDGETS).toHaveProperty('ENSURE_DIRECTORY_MS');
            expect(DATA_SERVICE_PERFORMANCE_BUDGETS).toHaveProperty('GET_PATH_MS');
        });

        it('should have positive numeric budget values', () => {
            for (const value of Object.values(DATA_SERVICE_PERFORMANCE_BUDGETS)) {
                expect(typeof value).toBe('number');
                expect(value).toBeGreaterThan(0);
            }
        });
    });

    describe('state machine for UX (B-0487)', () => {
        it('should expose correct state for loading UI', async () => {
            const freshService = new DataService();
            // Before init: show loading or setup prompt
            expect(freshService.isInitialized()).toBe(false);

            // After init: show ready state
            await freshService.initialize();
            expect(freshService.isInitialized()).toBe(true);

            // After cleanup: show disconnected/offline state
            await freshService.cleanup();
            expect(freshService.isInitialized()).toBe(false);
        });

        it('should provide base dir even before initialization', () => {
            const freshService = new DataService();
            const dir = freshService.getBaseDir();
            expect(typeof dir).toBe('string');
            expect(dir.length).toBeGreaterThan(0);
        });

        it('should provide all paths even before initialization', () => {
            const freshService = new DataService();
            const paths = freshService.getAllPaths();
            expect(Object.keys(paths).length).toBe(8);
        });
    });
});
