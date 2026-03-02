import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/mock/userData')
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

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

import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';

type ReaddirResult = Awaited<ReturnType<typeof fsp.readdir>>;

// Computed paths matching DataService internals
const MOCK_USER_DATA = '/mock/userData';
const MOCK_ROOT = path.dirname(MOCK_USER_DATA);
const MOCK_BASE_DIR = path.join(MOCK_USER_DATA, 'data');
const MOCK_AUTH_DIR = path.join(MOCK_BASE_DIR, 'auth');
const MOCK_DB_DIR = path.join(MOCK_USER_DATA, 'db');
const MOCK_CONFIG_DIR = path.join(MOCK_BASE_DIR, 'config');

// Old migration source paths
const OLD_AUTH_DIR = path.join(MOCK_ROOT, 'auth');
const OLD_AUTH_ENC = path.join(MOCK_ROOT, 'cliproxy-auth.enc');
const NEW_AUTH_ENC = path.join(MOCK_AUTH_DIR, 'proxy-auth-token.enc');
const OLD_SETTINGS = path.join(MOCK_ROOT, 'settings.json');
const NEW_SETTINGS = path.join(MOCK_CONFIG_DIR, 'settings.json');
const OLD_DATABASES = path.join(MOCK_ROOT, 'databases');
const LEGACY_CLI_PROXY = path.join(MOCK_ROOT, '.cli-proxy-api');

/**
 * Helper to make fsp.access resolve for paths in the set and reject for others
 */
function mockPathExists(existingPaths: Set<string>): void {
    vi.mocked(fsp.access).mockImplementation(async (p) => {
        if (existingPaths.has(String(p))) {return undefined;}
        throw new Error('ENOENT');
    });
}

describe('DataService Migration', () => {
    let service: DataService;

    beforeEach(() => {
        vi.clearAllMocks();
        // Default: all paths don't exist
        vi.mocked(fsp.access).mockRejectedValue(new Error('ENOENT'));
        vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
        vi.mocked(fsp.rename).mockResolvedValue(undefined);
        vi.mocked(fsp.readdir).mockResolvedValue([] as ReaddirResult);
        vi.mocked(fsp.rm).mockResolvedValue(undefined);
        vi.mocked(fsp.rmdir).mockResolvedValue(undefined);
        service = new DataService();
    });

    describe('forward migration', () => {
        it('should process directory entries via migrateDirectory', async () => {
            mockPathExists(new Set([OLD_AUTH_DIR]));
            vi.mocked(fsp.readdir)
                .mockResolvedValueOnce(['token.json'] as unknown as ReaddirResult)
                .mockResolvedValueOnce([] as ReaddirResult);

            await service.migrate();

            expect(fsp.mkdir).toHaveBeenCalledWith(MOCK_AUTH_DIR, { recursive: true });
            expect(fsp.rename).toHaveBeenCalledWith(
                path.join(OLD_AUTH_DIR, 'token.json'),
                path.join(MOCK_AUTH_DIR, 'token.json')
            );
        });

        it('should process file entries via migrateFile', async () => {
            mockPathExists(new Set([OLD_AUTH_ENC]));

            await service.migrate();

            expect(fsp.mkdir).toHaveBeenCalledWith(MOCK_AUTH_DIR, { recursive: true });
            expect(fsp.rename).toHaveBeenCalledWith(OLD_AUTH_ENC, NEW_AUTH_ENC);
        });
    });

    describe('migrateFile', () => {
        it('should create target directory and rename file', async () => {
            mockPathExists(new Set([OLD_SETTINGS]));

            await service.migrate();

            expect(fsp.mkdir).toHaveBeenCalledWith(MOCK_CONFIG_DIR, { recursive: true });
            expect(fsp.rename).toHaveBeenCalledWith(OLD_SETTINGS, NEW_SETTINGS);
        });

        it('should skip when target file already exists', async () => {
            mockPathExists(new Set([OLD_AUTH_ENC, NEW_AUTH_ENC]));

            await service.migrate();

            const fileMigrationCall = vi.mocked(fsp.rename).mock.calls.find(
                (c) => c[0] === OLD_AUTH_ENC && c[1] === NEW_AUTH_ENC
            );
            expect(fileMigrationCall).toBeUndefined();
        });
    });

    describe('migrateDirectory', () => {
        it('should rename each file in the source directory', async () => {
            mockPathExists(new Set([OLD_DATABASES]));
            vi.mocked(fsp.readdir)
                .mockResolvedValueOnce(['main.db', 'cache.db'] as unknown as ReaddirResult)
                .mockResolvedValueOnce([] as ReaddirResult);

            await service.migrate();

            expect(fsp.rename).toHaveBeenCalledWith(
                path.join(OLD_DATABASES, 'main.db'),
                path.join(MOCK_DB_DIR, 'main.db')
            );
            expect(fsp.rename).toHaveBeenCalledWith(
                path.join(OLD_DATABASES, 'cache.db'),
                path.join(MOCK_DB_DIR, 'cache.db')
            );
        });

        it('should remove old directory when empty after migration', async () => {
            mockPathExists(new Set([OLD_DATABASES]));
            vi.mocked(fsp.readdir)
                .mockResolvedValueOnce(['data.db'] as unknown as ReaddirResult)
                .mockResolvedValueOnce([] as ReaddirResult);

            await service.migrate();

            expect(fsp.rmdir).toHaveBeenCalledWith(OLD_DATABASES);
        });

        it('should not remove old directory when files remain', async () => {
            mockPathExists(new Set([OLD_DATABASES]));
            vi.mocked(fsp.readdir)
                .mockResolvedValueOnce(['data.db'] as unknown as ReaddirResult)
                .mockResolvedValueOnce(['leftover.db'] as unknown as ReaddirResult);

            await service.migrate();

            expect(fsp.rmdir).not.toHaveBeenCalledWith(OLD_DATABASES);
        });

        it('should skip individual files that already exist at destination', async () => {
            const existingNewFile = path.join(MOCK_DB_DIR, 'main.db');
            mockPathExists(new Set([OLD_DATABASES, existingNewFile]));
            vi.mocked(fsp.readdir)
                .mockResolvedValueOnce(['main.db', 'new.db'] as unknown as ReaddirResult)
                .mockResolvedValueOnce([] as ReaddirResult);

            await service.migrate();

            const mainDbRename = vi.mocked(fsp.rename).mock.calls.find(
                (c) => c[0] === path.join(OLD_DATABASES, 'main.db')
            );
            expect(mainDbRename).toBeUndefined();
            expect(fsp.rename).toHaveBeenCalledWith(
                path.join(OLD_DATABASES, 'new.db'),
                path.join(MOCK_DB_DIR, 'new.db')
            );
        });
    });

    describe('missing source', () => {
        it('should skip all migrations when no old paths exist', async () => {
            vi.mocked(fsp.access).mockRejectedValue(new Error('ENOENT'));

            await service.migrate();

            expect(fsp.rename).not.toHaveBeenCalled();
        });

        it('should not throw when old paths are missing', async () => {
            vi.mocked(fsp.access).mockRejectedValue(new Error('ENOENT'));

            await expect(service.migrate()).resolves.toBeUndefined();
        });
    });

    describe('permission errors', () => {
        it('should log error and continue when rename fails with EACCES', async () => {
            mockPathExists(new Set([OLD_AUTH_ENC]));
            vi.mocked(fsp.rename).mockRejectedValueOnce(new Error('EACCES: permission denied'));

            await expect(service.migrate()).resolves.toBeUndefined();

            expect(appLogger.error).toHaveBeenCalledWith(
                'DataService',
                expect.stringContaining('Failed to migrate')
            );
        });

        it('should log error when mkdir fails during file migration', async () => {
            mockPathExists(new Set([OLD_SETTINGS]));
            vi.mocked(fsp.mkdir).mockRejectedValueOnce(new Error('EACCES'));

            await expect(service.migrate()).resolves.toBeUndefined();

            expect(appLogger.error).toHaveBeenCalledWith(
                'DataService',
                expect.stringContaining('Failed to migrate')
            );
        });

        it('should log error when readdir fails during directory migration', async () => {
            mockPathExists(new Set([OLD_AUTH_DIR]));
            vi.mocked(fsp.readdir).mockRejectedValueOnce(new Error('EACCES: permission denied'));

            await expect(service.migrate()).resolves.toBeUndefined();

            expect(appLogger.error).toHaveBeenCalled();
        });
    });

    describe('logging', () => {
        it('should log migration start message', async () => {
            await service.migrate();

            expect(appLogger.info).toHaveBeenCalledWith(
                'DataService',
                'Checking for migrations...'
            );
        });

        it('should log individual file migrations', async () => {
            mockPathExists(new Set([OLD_AUTH_ENC]));

            await service.migrate();

            expect(appLogger.info).toHaveBeenCalledWith(
                'DataService',
                expect.stringContaining('Migrating')
            );
        });

        it('should log errors for failed migration entries', async () => {
            mockPathExists(new Set([OLD_AUTH_DIR]));
            vi.mocked(fsp.readdir).mockRejectedValueOnce(new Error('disk error'));

            await service.migrate();

            expect(appLogger.error).toHaveBeenCalledWith(
                'DataService',
                expect.stringContaining('Failed to migrate')
            );
        });

        it('should log legacy folder cleanup', async () => {
            mockPathExists(new Set([LEGACY_CLI_PROXY]));

            await service.migrate();

            expect(appLogger.info).toHaveBeenCalledWith(
                'DataService',
                expect.stringContaining('legacy .cli-proxy-api')
            );
        });
    });

    describe('partial failure', () => {
        it('should continue processing entries after one migration fails', async () => {
            // Entry 0 (auth dir) fails on readdir, entry 1 (auth enc file) succeeds
            mockPathExists(new Set([OLD_AUTH_DIR, OLD_AUTH_ENC]));
            vi.mocked(fsp.readdir).mockRejectedValueOnce(new Error('disk error'));

            await service.migrate();

            // File migration for entry 1 should still proceed
            expect(fsp.rename).toHaveBeenCalledWith(OLD_AUTH_ENC, NEW_AUTH_ENC);
            expect(appLogger.error).toHaveBeenCalled();
        });

        it('should log error only for the failed entry', async () => {
            mockPathExists(new Set([OLD_AUTH_DIR, OLD_AUTH_ENC]));
            vi.mocked(fsp.readdir).mockRejectedValueOnce(new Error('disk error'));

            await service.migrate();

            const errorCalls = vi.mocked(appLogger.error).mock.calls.filter(
                (c) => typeof c[1] === 'string' && c[1].includes('Failed to migrate')
            );
            expect(errorCalls.length).toBeGreaterThanOrEqual(1);
            expect(errorCalls[0][1]).toContain(OLD_AUTH_DIR);
        });
    });

    describe('empty directory', () => {
        it('should create target directory and remove empty source', async () => {
            mockPathExists(new Set([OLD_AUTH_DIR]));
            vi.mocked(fsp.readdir)
                .mockResolvedValueOnce([] as ReaddirResult)
                .mockResolvedValueOnce([] as ReaddirResult);

            await service.migrate();

            expect(fsp.mkdir).toHaveBeenCalledWith(MOCK_AUTH_DIR, { recursive: true });
            expect(fsp.rmdir).toHaveBeenCalledWith(OLD_AUTH_DIR);

            // No rename calls for files within this directory
            const authRenames = vi.mocked(fsp.rename).mock.calls.filter(
                (c) => (c[0] as string).startsWith(OLD_AUTH_DIR)
            );
            expect(authRenames).toHaveLength(0);
        });
    });

    describe('symlink handling', () => {
        it('should attempt rename for all directory entries including symlinks', async () => {
            mockPathExists(new Set([OLD_AUTH_DIR]));
            vi.mocked(fsp.readdir)
                .mockResolvedValueOnce(['regular.txt', 'symlink.txt'] as unknown as ReaddirResult)
                .mockResolvedValueOnce([] as ReaddirResult);

            await service.migrate();

            expect(fsp.rename).toHaveBeenCalledWith(
                path.join(OLD_AUTH_DIR, 'regular.txt'),
                path.join(MOCK_AUTH_DIR, 'regular.txt')
            );
            expect(fsp.rename).toHaveBeenCalledWith(
                path.join(OLD_AUTH_DIR, 'symlink.txt'),
                path.join(MOCK_AUTH_DIR, 'symlink.txt')
            );
        });

        it('should handle rename failure for symlinks gracefully', async () => {
            mockPathExists(new Set([OLD_AUTH_DIR]));
            vi.mocked(fsp.readdir)
                .mockResolvedValueOnce(['symlink.txt'] as unknown as ReaddirResult);
            vi.mocked(fsp.rename).mockRejectedValueOnce(
                new Error('EPERM: operation not permitted, rename symlink')
            );

            await expect(service.migrate()).resolves.toBeUndefined();

            expect(appLogger.error).toHaveBeenCalledWith(
                'DataService',
                expect.stringContaining('Failed to migrate')
            );
        });
    });

    describe('legacy cleanup', () => {
        it('should remove .cli-proxy-api folder when it exists', async () => {
            mockPathExists(new Set([LEGACY_CLI_PROXY]));

            await service.migrate();

            expect(fsp.rm).toHaveBeenCalledWith(
                LEGACY_CLI_PROXY,
                { recursive: true, force: true }
            );
        });

        it('should handle cleanup failure gracefully', async () => {
            mockPathExists(new Set([LEGACY_CLI_PROXY]));
            vi.mocked(fsp.rm).mockRejectedValueOnce(new Error('EBUSY'));

            await expect(service.migrate()).resolves.toBeUndefined();

            expect(appLogger.error).toHaveBeenCalledWith(
                'DataService',
                expect.stringContaining('Failed to cleanup legacy folder')
            );
        });
    });
});
