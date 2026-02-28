import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/mock/userData')
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

// Unmock path to get real resolve behavior for validatePath tests
vi.unmock('path');

vi.mock('fs/promises', () => ({
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    rename: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined)
}));

import * as fsp from 'fs/promises';
import * as path from 'path';

import type { Dirent } from 'fs';

import {
    DATA_SERVICE_PERFORMANCE_BUDGETS,
    DataService,
    DataServiceErrorCode,
    DataServiceTelemetryEvent,
    DataType
} from '@main/services/data/data.service';
import type { TelemetryService } from '@main/services/analysis/telemetry.service';

describe('DataService', () => {
    let service: DataService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new DataService();
    });

    describe('getPath', () => {
        const validTypes: DataType[] = ['auth', 'db', 'config', 'logs', 'models', 'gallery', 'galleryImages', 'galleryVideos', 'data'];

        it.each(validTypes)('should return a path string for valid type "%s"', (type) => {
            const result = service.getPath(type);
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should throw with PATH_TYPE_INVALID code for empty string', () => {
            try {
                service.getPath('' as DataType);
                expect.fail('Expected error to be thrown');
            } catch (error: unknown) {
                const err = error as Error & { code?: string };
                expect(err.code).toBe(DataServiceErrorCode.PATH_TYPE_INVALID);
            }
        });

        it('should throw with PATH_TYPE_INVALID code for undefined cast as DataType', () => {
            try {
                service.getPath(undefined as unknown as DataType);
                expect.fail('Expected error to be thrown');
            } catch (error: unknown) {
                const err = error as Error & { code?: string };
                expect(err.code).toBe(DataServiceErrorCode.PATH_TYPE_INVALID);
            }
        });

        it('should throw with PATH_TYPE_INVALID code for null cast as DataType', () => {
            try {
                service.getPath(null as unknown as DataType);
                expect.fail('Expected error to be thrown');
            } catch (error: unknown) {
                const err = error as Error & { code?: string };
                expect(err.code).toBe(DataServiceErrorCode.PATH_TYPE_INVALID);
            }
        });

        it('should throw with PATH_TYPE_INVALID code for an unknown type string', () => {
            try {
                service.getPath('nonexistent' as DataType);
                expect.fail('Expected error to be thrown');
            } catch (error: unknown) {
                const err = error as Error & { code?: string };
                expect(err.code).toBe(DataServiceErrorCode.PATH_TYPE_INVALID);
                expect(err.message).toContain('nonexistent');
            }
        });

        it('should return consistent paths across multiple calls', () => {
            const first = service.getPath('auth');
            const second = service.getPath('auth');
            expect(first).toBe(second);
        });
    });

    describe('validatePath', () => {
        it('should return true for a path within the allowed root', () => {
            const root = path.resolve('/allowed/root');
            const target = path.join(root, 'subdir', 'file.txt');
            expect(service.validatePath(target, root)).toBe(true);
        });

        it('should return true when target equals the allowed root', () => {
            const root = path.resolve('/allowed/root');
            expect(service.validatePath(root, root)).toBe(true);
        });

        it('should return false for path traversal with ../', () => {
            const root = path.resolve('/allowed/root');
            const target = path.join(root, '..', 'outside');
            expect(service.validatePath(target, root)).toBe(false);
        });

        it('should return false for absolute path outside root', () => {
            const root = path.resolve('/allowed/root');
            const target = path.resolve('/other/directory/file.txt');
            expect(service.validatePath(target, root)).toBe(false);
        });

        it('should return false for path with multiple traversal segments', () => {
            const root = path.resolve('/allowed/root/deep');
            const target = path.join(root, '..', '..', 'outside');
            expect(service.validatePath(target, root)).toBe(false);
        });
    });

    describe('getAllPaths', () => {
        it('should return an object containing all data type paths', () => {
            const paths = service.getAllPaths();
            const expectedKeys: DataType[] = ['auth', 'db', 'config', 'logs', 'models', 'gallery', 'galleryImages', 'galleryVideos', 'data'];
            for (const key of expectedKeys) {
                expect(paths).toHaveProperty(key);
                expect(typeof paths[key]).toBe('string');
            }
        });

        it('should return a copy that does not mutate internal state', () => {
            const paths = service.getAllPaths();
            const originalAuth = paths.auth;
            paths.auth = '/mutated/path';

            const freshPaths = service.getAllPaths();
            expect(freshPaths.auth).toBe(originalAuth);
        });
    });

    describe('getBaseDir', () => {
        it('should return a non-empty string', () => {
            const baseDir = service.getBaseDir();
            expect(typeof baseDir).toBe('string');
            expect(baseDir.length).toBeGreaterThan(0);
        });

        it('should return a path under userData', () => {
            const baseDir = service.getBaseDir();
            expect(baseDir).toContain('mock');
            expect(baseDir).toContain('userData');
        });
    });

    describe('isInitialized', () => {
        it('should return false before initialization', () => {
            expect(service.isInitialized()).toBe(false);
        });

        it('should return true after successful initialization', async () => {
            await service.initialize();
            expect(service.isInitialized()).toBe(true);
        });

        it('should return false after cleanup', async () => {
            await service.initialize();
            expect(service.isInitialized()).toBe(true);
            await service.cleanup();
            expect(service.isInitialized()).toBe(false);
        });
    });

    describe('initialize', () => {
        it('should call mkdir to create directories', async () => {
            await service.initialize();
            expect(fsp.mkdir).toHaveBeenCalled();
        });

        it('should set initialized to true on success', async () => {
            await service.initialize();
            expect(service.isInitialized()).toBe(true);
        });

        it('should throw and not set initialized when mkdir fails', async () => {
            vi.mocked(fsp.mkdir).mockRejectedValueOnce(new Error('Permission denied'));

            await expect(service.initialize()).rejects.toThrow();
            expect(service.isInitialized()).toBe(false);
        });
    });

    describe('cleanup', () => {
        it('should set initialized to false', async () => {
            await service.initialize();
            await service.cleanup();
            expect(service.isInitialized()).toBe(false);
        });

        it('should be safe to call even when not initialized', async () => {
            await expect(service.cleanup()).resolves.toBeUndefined();
            expect(service.isInitialized()).toBe(false);
        });
    });

    describe('initialize error handling (B-0484)', () => {
        it('should attach DIRECTORY_CREATE_FAILED code when mkdir throws', async () => {
            vi.mocked(fsp.mkdir).mockRejectedValueOnce(new Error('EACCES'));

            try {
                await service.initialize();
                expect.fail('Expected error');
            } catch (error: unknown) {
                const err = error as Error & { code?: string };
                expect(err.code).toBe(DataServiceErrorCode.DIRECTORY_CREATE_FAILED);
                expect(err.message).toContain('EACCES');
            }
        });

        it('should remain uninitialized after directory creation failure', async () => {
            vi.mocked(fsp.mkdir).mockRejectedValueOnce(new Error('disk full'));
            await expect(service.initialize()).rejects.toThrow();
            expect(service.isInitialized()).toBe(false);
        });
    });

    describe('telemetry integration (B-0485)', () => {
        it('should accept telemetry service via setTelemetryService', () => {
            const mockTelemetry = { track: vi.fn().mockReturnValue({ success: true }) };
            expect(() => {
                service.setTelemetryService(mockTelemetry as unknown as TelemetryService);
            }).not.toThrow();
        });

        it('should track INITIALIZE_START and INITIALIZE_COMPLETE on success', async () => {
            const trackFn = vi.fn().mockReturnValue({ success: true });
            service.setTelemetryService({ track: trackFn } as unknown as TelemetryService);

            await service.initialize();

            const eventNames = trackFn.mock.calls.map((c: unknown[]) => c[0]);
            expect(eventNames).toContain(DataServiceTelemetryEvent.INITIALIZE_START);
            expect(eventNames).toContain(DataServiceTelemetryEvent.INITIALIZE_COMPLETE);
        });

        it('should track INITIALIZE_ERROR on failure', async () => {
            const trackFn = vi.fn().mockReturnValue({ success: true });
            service.setTelemetryService({ track: trackFn } as unknown as TelemetryService);
            vi.mocked(fsp.mkdir).mockRejectedValueOnce(new Error('fail'));

            await expect(service.initialize()).rejects.toThrow();

            const eventNames = trackFn.mock.calls.map((c: unknown[]) => c[0]);
            expect(eventNames).toContain(DataServiceTelemetryEvent.INITIALIZE_ERROR);
        });

        it('should track PATH_ACCESSED when getPath is called', () => {
            const trackFn = vi.fn().mockReturnValue({ success: true });
            service.setTelemetryService({ track: trackFn } as unknown as TelemetryService);

            service.getPath('auth');

            const pathCalls = trackFn.mock.calls.filter(
                (c: unknown[]) => c[0] === DataServiceTelemetryEvent.PATH_ACCESSED
            );
            expect(pathCalls.length).toBe(1);
            expect((pathCalls[0][1] as Record<string, unknown>).type).toBe('auth');
        });

        it('should track DIRECTORY_CREATED events during initialization', async () => {
            const trackFn = vi.fn().mockReturnValue({ success: true });
            service.setTelemetryService({ track: trackFn } as unknown as TelemetryService);

            await service.initialize();

            const dirEvents = trackFn.mock.calls.filter(
                (c: unknown[]) => c[0] === DataServiceTelemetryEvent.DIRECTORY_CREATED
            );
            expect(dirEvents.length).toBeGreaterThan(0);
        });

        it('should not throw when telemetry service is not set', async () => {
            await expect(service.initialize()).resolves.toBeUndefined();
            expect(() => service.getPath('auth')).not.toThrow();
        });
    });

    describe('migrate (B-0481/B-0482)', () => {
        it('should skip migrations when old paths do not exist', async () => {
            vi.mocked(fsp.access).mockRejectedValue(new Error('ENOENT'));

            await service.migrate();
            expect(fsp.rename).not.toHaveBeenCalled();
        });

        it('should migrate files when old path exists and new does not', async () => {
            // First access call (old path) succeeds, second (new path) fails
            vi.mocked(fsp.access)
                .mockResolvedValueOnce(undefined)   // old exists
                .mockRejectedValueOnce(new Error('ENOENT')); // new does not

            vi.mocked(fsp.readdir).mockResolvedValueOnce([] as unknown as Dirent[]);

            await service.migrate();
            // Should attempt mkdir for migration paths
            expect(fsp.mkdir).toHaveBeenCalled();
        });

        it('should handle migration errors gracefully without throwing', async () => {
            vi.mocked(fsp.access).mockResolvedValue(undefined);
            vi.mocked(fsp.readdir).mockRejectedValue(new Error('read error'));

            // Should not throw — errors are logged and skipped
            await expect(service.migrate()).resolves.toBeUndefined();
        });

        it('should clean up legacy .cli-proxy-api folder if present', async () => {
            // Make all migration paths fail (ENOENT) except the legacy cleanup path
            let callCount = 0;
            vi.mocked(fsp.access).mockImplementation(async () => {
                callCount++;
                // Let the legacy folder check succeed (last access call)
                if (callCount > 12) return undefined;
                throw new Error('ENOENT');
            });

            await service.migrate();
            // rm should be called for legacy cleanup
            expect(fsp.rm).toHaveBeenCalled();
        });
    });

    describe('input validation edge cases (B-0483)', () => {
        it('should reject numeric type cast as DataType', () => {
            expect(() => service.getPath(42 as unknown as DataType)).toThrow();
        });

        it('should reject object cast as DataType', () => {
            expect(() => service.getPath({} as unknown as DataType)).toThrow();
        });

        it('should reject array cast as DataType', () => {
            expect(() => service.getPath([] as unknown as DataType)).toThrow();
        });

        it('should reject boolean cast as DataType', () => {
            expect(() => service.getPath(true as unknown as DataType)).toThrow();
        });

        it('should reject type with trailing whitespace', () => {
            expect(() => service.getPath('auth ' as DataType)).toThrow();
        });

        it('should reject case-sensitive mismatch', () => {
            expect(() => service.getPath('Auth' as DataType)).toThrow();
        });
    });

    describe('state transitions for UX (B-0487)', () => {
        it('should transition: uninitialized → initialized → cleaned up', async () => {
            expect(service.isInitialized()).toBe(false);
            await service.initialize();
            expect(service.isInitialized()).toBe(true);
            await service.cleanup();
            expect(service.isInitialized()).toBe(false);
        });

        it('should allow re-initialization after cleanup', async () => {
            await service.initialize();
            await service.cleanup();
            expect(service.isInitialized()).toBe(false);

            await service.initialize();
            expect(service.isInitialized()).toBe(true);
        });

        it('should maintain path access after re-initialization', async () => {
            await service.initialize();
            const pathBefore = service.getPath('config');
            await service.cleanup();
            await service.initialize();
            const pathAfter = service.getPath('config');
            expect(pathAfter).toBe(pathBefore);
        });
    });

    describe('performance budgets (B-0486)', () => {
        it('should export correct budget thresholds', () => {
            expect(DATA_SERVICE_PERFORMANCE_BUDGETS.INITIALIZE_MS).toBe(5000);
            expect(DATA_SERVICE_PERFORMANCE_BUDGETS.MIGRATE_MS).toBe(30000);
            expect(DATA_SERVICE_PERFORMANCE_BUDGETS.ENSURE_DIRECTORY_MS).toBe(1000);
            expect(DATA_SERVICE_PERFORMANCE_BUDGETS.GET_PATH_MS).toBe(10);
        });

        it('should have immutable budget object', () => {
            const budgets = DATA_SERVICE_PERFORMANCE_BUDGETS;
            expect(Object.isFrozen(budgets)).toBe(true);
        });
    });
});
