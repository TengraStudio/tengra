import * as fs from 'fs/promises';
import * as path from 'path';

import { FileSystemService } from '@main/services/data/filesystem.service';
import {
    clearWorkspaceIgnoreMatcherCache,
    getWorkspaceIgnoreMatcher,
} from '@main/services/workspace/workspace-ignore.util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@main/services/workspace/workspace-ignore.util', () => ({
    DEFAULT_WORKSPACE_EXPLORER_IGNORE_PATTERNS: [],
    getWorkspaceIgnoreMatcher: vi.fn(async (rootPath: string) => ({
        rootPath,
        patterns: [],
        ignoresAbsolute: () => false,
        ignoresRelative: () => false,
    })),
    clearWorkspaceIgnoreMatcherCache: vi.fn(),
}));

vi.mock('fs/promises');
vi.mock('https', () => ({ get: vi.fn() }));

// Override the setup.ts fs mock to include realpathSync.native and lstatSync
vi.mock('fs', () => ({
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ isDirectory: () => false, size: 0 })),
    lstatSync: vi.fn(() => ({ isSymbolicLink: () => false })),
    realpathSync: { native: vi.fn((p: string) => p) },
    watch: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })),
    createWriteStream: vi.fn(() => ({ on: vi.fn(), close: vi.fn(), destroy: vi.fn() }))
}));

describe('FileSystemService', () => {
    let service: FileSystemService;
    const allowedRoot = path.resolve('/allowed');

    beforeEach(() => {
        vi.clearAllMocks();
        clearWorkspaceIgnoreMatcherCache();
        service = new FileSystemService([allowedRoot]);
    });

    describe('readFile', () => {
        it('should read a text file successfully', async () => {
            const content = Buffer.from('hello world');
            vi.mocked(fs.stat).mockResolvedValue({ size: content.length } as Awaited<ReturnType<typeof fs.stat>>);
            vi.mocked(fs.readFile).mockResolvedValue(content as never as string);

            const result = await service.readFile(path.join(allowedRoot, 'test.txt'));
            expect(result.success).toBe(true);
            expect(result.data).toBe('hello world');
        });

        it('should reject files outside allowed roots', async () => {
            const result = await service.readFile('/forbidden/file.txt');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Access denied');
        });

        it('should reject files larger than 10MB', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ size: 11 * 1024 * 1024 } as Awaited<ReturnType<typeof fs.stat>>);
            const result = await service.readFile(path.join(allowedRoot, 'big.txt'));
            expect(result.success).toBe(false);
            expect(result.error).toContain('too large');
        });

        it('should detect binary files', async () => {
            const content = Buffer.from([0x48, 0x65, 0x00, 0x6c]);
            vi.mocked(fs.stat).mockResolvedValue({ size: content.length } as Awaited<ReturnType<typeof fs.stat>>);
            vi.mocked(fs.readFile).mockResolvedValue(content as never as string);

            const result = await service.readFile(path.join(allowedRoot, 'bin.dat'));
            expect(result.success).toBe(false);
            expect(result.error).toContain('binary');
        });
    });

    describe('writeFile', () => {
        it('should write content to file', async () => {
            vi.mocked(fs.mkdir).mockResolvedValue(undefined);
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);
            const result = await service.writeFile(path.join(allowedRoot, 'out.txt'), 'data');
            expect(result.success).toBe(true);
        });

        it('should reject writes outside allowed roots', async () => {
            const result = await service.writeFile('/forbidden/out.txt', 'data');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Access denied');
        });
    });

    describe('fileExists', () => {
        it('should return true for existing file', async () => {
            vi.mocked(fs.access).mockResolvedValue(undefined);
            const result = await service.fileExists(path.join(allowedRoot, 'exists.txt'));
            expect(result.exists).toBe(true);
        });

        it('should return false for missing file', async () => {
            vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
            const result = await service.fileExists(path.join(allowedRoot, 'missing.txt'));
            expect(result.exists).toBe(false);
        });
    });

    describe('createDirectory', () => {
        it('should create a directory', async () => {
            vi.mocked(fs.mkdir).mockResolvedValue(undefined);
            const result = await service.createDirectory(path.join(allowedRoot, 'newdir'));
            expect(result.success).toBe(true);
        });
    });

    describe('listDirectory', () => {
        it('returns directory entries without per-entry stat calls', async () => {
            vi.mocked(fs.readdir).mockResolvedValue([
                { name: 'src', isDirectory: () => true },
                { name: 'README.md', isDirectory: () => false },
            ] as never);

            const result = await service.listDirectory(allowedRoot);

            expect(result).toEqual({
                success: true,
                data: [
                    { name: 'src', isDirectory: true },
                    { name: 'README.md', isDirectory: false },
                ],
            });
            expect(fs.stat).not.toHaveBeenCalled();
        });

        it('filters files ignored by workspace ignore files', async () => {
            vi.mocked(fs.readdir).mockResolvedValue([
                { name: 'src', isDirectory: () => true },
                { name: 'debug.log', isDirectory: () => false },
            ] as never);
            vi.mocked(getWorkspaceIgnoreMatcher).mockResolvedValue({
                rootPath: allowedRoot,
                patterns: ['*.log'],
                ignoresAbsolute: (candidatePath: string) => candidatePath.endsWith('.log'),
                ignoresRelative: (candidatePath: string) => candidatePath.endsWith('.log'),
            });

            const result = await service.listDirectory(allowedRoot);

            expect(result).toEqual({
                success: true,
                data: [{ name: 'src', isDirectory: true }],
            });
        });
    });

    describe('deleteFile', () => {
        it('should delete a file', async () => {
            vi.mocked(fs.unlink).mockResolvedValue(undefined);
            const result = await service.deleteFile(path.join(allowedRoot, 'del.txt'));
            expect(result.success).toBe(true);
        });
    });

    describe('copyFile', () => {
        it('should copy a file within allowed roots', async () => {
            vi.mocked(fs.mkdir).mockResolvedValue(undefined);
            vi.mocked(fs.copyFile).mockResolvedValue(undefined);
            const result = await service.copyFile(
                path.join(allowedRoot, 'a.txt'),
                path.join(allowedRoot, 'b.txt')
            );
            expect(result.success).toBe(true);
            expect(fs.mkdir).toHaveBeenCalled();
        });
    });

    describe('copyPath', () => {
        it('should copy a directory recursively within allowed roots', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true,
            } as Awaited<ReturnType<typeof fs.stat>>);
            vi.mocked(fs.mkdir).mockResolvedValue(undefined);
            vi.mocked(fs.cp).mockResolvedValue(undefined);

            const result = await service.copyPath(
                path.join(allowedRoot, 'source-dir'),
                path.join(allowedRoot, 'target-dir')
            );

            expect(result.success).toBe(true);
            expect(fs.cp).toHaveBeenCalledWith(
                path.join(allowedRoot, 'source-dir'),
                path.join(allowedRoot, 'target-dir'),
                expect.objectContaining({ recursive: true, force: true })
            );
        });
    });

    describe('downloadFile', () => {
        it('should reject non-https URLs', async () => {
            const result = await service.downloadFile('http://evil.com/file', path.join(allowedRoot, 'dl.bin'));
            expect(result.success).toBe(false);
            expect(result.error).toContain('https');
        });

        it('should reject disallowed hosts', async () => {
            const result = await service.downloadFile('https://evil.com/file', path.join(allowedRoot, 'dl.bin'));
            expect(result.success).toBe(false);
            expect(result.error).toContain('not allowed');
        });
    });

    describe('updateAllowedRoots', () => {
        it('should update allowed roots and grant access', async () => {
            const newRoot = path.resolve('/newroot');
            service.updateAllowedRoots([newRoot]);
            vi.mocked(fs.mkdir).mockResolvedValue(undefined);
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);
            const result = await service.writeFile(path.join(newRoot, 'test.txt'), 'data');
            expect(result.success).toBe(true);
        });
    });
});
