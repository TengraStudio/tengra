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

import { DataService, DataServiceErrorCode, DataType } from '@main/services/data/data.service';

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
});
