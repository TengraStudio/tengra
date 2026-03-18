/**
 * Unit tests for ScannerService
 */
import { appLogger } from '@main/logging/logger';
import { ScannerService, ScanResult } from '@main/services/analysis/scanner.service';
import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock node:fs/promises
vi.mock('node:fs/promises');

/** Helper to create a mock Dirent object */
function mockDirent(name: string, isDir: boolean): Dirent {
    return {
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        isSymbolicLink: () => false,
        path: '',
        parentPath: '',
    } as Dirent;
}

describe('ScannerService', () => {
    let service: ScannerService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ScannerService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create an instance', () => {
            expect(service).toBeInstanceOf(ScannerService);
        });
    });

    describe('scanDirectory', () => {
        it('should return empty array for an empty directory', async () => {
            vi.mocked(fs.readdir).mockResolvedValueOnce([] as never as Awaited<ReturnType<typeof fs.readdir>>);

            const results = await service.scanDirectory('/empty');

            expect(results).toEqual([]);
            expect(fs.readdir).toHaveBeenCalledWith('/empty', { withFileTypes: true });
        });

        it('should scan a single TypeScript file', async () => {
            const dirents = [mockDirent('app.ts', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValueOnce('const x = 1;');

            const results = await service.scanDirectory('/workspace');

            expect(results).toHaveLength(1);
            expect(results[0].path).toBe(path.join('/workspace', 'app.ts'));
            expect(results[0].content).toBe('const x = 1;');
            expect(results[0].chunks).toEqual(['const x = 1;']);
        });

        it('should scan files with various allowed extensions', async () => {
            const extensions = ['.ts', '.tsx', '.js', '.jsx', '.md', '.py', '.go', '.rs', '.java', '.cpp', '.h', '.css', '.html', '.json'];
            const dirents = extensions.map((ext) => mockDirent(`file${ext}`, false));
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValue('content');

            const results = await service.scanDirectory('/workspace');

            expect(results).toHaveLength(extensions.length);
        });

        it('should skip files with disallowed extensions', async () => {
            const dirents = [
                mockDirent('image.png', false),
                mockDirent('binary.exe', false),
                mockDirent('archive.zip', false),
                mockDirent('valid.ts', false),
            ];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValue('content');

            const results = await service.scanDirectory('/workspace');

            expect(results).toHaveLength(1);
            expect(results[0].path).toBe(path.join('/workspace', 'valid.ts'));
        });

        it('should skip empty files', async () => {
            const dirents = [mockDirent('empty.ts', false), mockDirent('filled.ts', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile)
                .mockResolvedValueOnce('')
                .mockResolvedValueOnce('const x = 1;');

            const results = await service.scanDirectory('/workspace');

            expect(results).toHaveLength(1);
            expect(results[0].path).toBe(path.join('/workspace', 'filled.ts'));
        });

        it('should recursively scan subdirectories', async () => {
            // Root directory
            vi.mocked(fs.readdir)
                .mockResolvedValueOnce([
                    mockDirent('src', true),
                    mockDirent('index.ts', false),
                ] as never as Awaited<ReturnType<typeof fs.readdir>>)
                // Subdirectory
                .mockResolvedValueOnce([
                    mockDirent('main.ts', false),
                ] as never as Awaited<ReturnType<typeof fs.readdir>>);

            vi.mocked(fs.readFile).mockResolvedValue('code');

            const results = await service.scanDirectory('/workspace');

            expect(results).toHaveLength(2);
            expect(results[0].path).toBe(path.join('/workspace', 'src', 'main.ts'));
            expect(results[1].path).toBe(path.join('/workspace', 'index.ts'));
        });

        it('should skip ignored directories', async () => {
            const ignoredDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.vscode'];
            const dirents = [
                ...ignoredDirs.map((name) => mockDirent(name, true)),
                mockDirent('app.ts', false),
            ];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValue('content');

            const results = await service.scanDirectory('/workspace');

            // Only the file should be scanned, none of the ignored directories
            expect(results).toHaveLength(1);
            expect(fs.readdir).toHaveBeenCalledTimes(1);
        });

        it('should skip ignored files by name', async () => {
            const dirents = [
                mockDirent('package-lock.json', false),
                mockDirent('yarn.lock', false),
                mockDirent('.DS_Store', false),
                mockDirent('app.ts', false),
            ];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValue('content');

            const results = await service.scanDirectory('/workspace');

            // package-lock.json is .json (allowed ext) but should be read; yarn.lock and .DS_Store have disallowed extensions
            // package-lock.json IS an allowed extension (.json), so it gets scanned
            // yarn.lock has .lock extension (not allowed), .DS_Store has no matching extension
            expect(results.some((r: ScanResult) => r.path.includes('yarn.lock'))).toBe(false);
            expect(results.some((r: ScanResult) => r.path.includes('.DS_Store'))).toBe(false);
        });

        it('should handle case-insensitive extension matching', async () => {
            const dirents = [mockDirent('README.MD', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValue('# README');

            const results = await service.scanDirectory('/workspace');

            expect(results).toHaveLength(1);
        });
    });

    describe('error handling', () => {
        it('should log error and continue when a file read fails', async () => {
            const dirents = [
                mockDirent('broken.ts', false),
                mockDirent('good.ts', false),
            ];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile)
                .mockRejectedValueOnce(new Error('Permission denied'))
                .mockResolvedValueOnce('valid content');

            const results = await service.scanDirectory('/workspace');

            expect(results).toHaveLength(1);
            expect(results[0].path).toBe(path.join('/workspace', 'good.ts'));
            expect(appLogger.error).toHaveBeenCalledWith(
                'ScannerService',
                expect.stringContaining('Permission denied')
            );
        });

        it('should propagate readdir errors', async () => {
            vi.mocked(fs.readdir).mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

            await expect(service.scanDirectory('/nonexistent')).rejects.toThrow('ENOENT');
        });

        it('should log error for file read with non-Error thrown value', async () => {
            const dirents = [mockDirent('fail.ts', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockRejectedValueOnce('string error');

            const results = await service.scanDirectory('/workspace');

            expect(results).toEqual([]);
            expect(appLogger.error).toHaveBeenCalledOnce();
        });
    });

    describe('chunking', () => {
        it('should return single chunk for short text', async () => {
            const shortContent = 'a'.repeat(500);
            const dirents = [mockDirent('short.ts', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValueOnce(shortContent);

            const results = await service.scanDirectory('/workspace');

            expect(results[0].chunks).toHaveLength(1);
            expect(results[0].chunks[0]).toBe(shortContent);
        });

        it('should return single chunk for text exactly at chunk size', async () => {
            const exactContent = 'a'.repeat(1000);
            const dirents = [mockDirent('exact.ts', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValueOnce(exactContent);

            const results = await service.scanDirectory('/workspace');

            expect(results[0].chunks).toHaveLength(1);
            expect(results[0].chunks[0]).toBe(exactContent);
        });

        it('should split long text into overlapping chunks', async () => {
            // 2500 chars with default chunkSize=1000, overlap=200 -> step=800
            // chunks: [0-1000], [800-1800], [1600-2500]
            const longContent = 'a'.repeat(2500);
            const dirents = [mockDirent('long.ts', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValueOnce(longContent);

            const results = await service.scanDirectory('/workspace');
            const chunks = results[0].chunks;

            expect(chunks.length).toBeGreaterThan(1);
            // First chunk should be 1000 chars
            expect(chunks[0]).toHaveLength(1000);
            // Verify overlap: end of first chunk overlaps with start of second
            expect(chunks[0].slice(800)).toBe(chunks[1].slice(0, 200));
        });

        it('should produce chunks that cover the entire text', async () => {
            const content = 'abcdefghij'.repeat(250); // 2500 chars
            const dirents = [mockDirent('full.ts', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValueOnce(content);

            const results = await service.scanDirectory('/workspace');
            const chunks = results[0].chunks;

            // Last chunk should contain the end of the content
            const lastChunk = chunks[chunks.length - 1];
            expect(content.endsWith(lastChunk.slice(-10))).toBe(true);
        });

        it('should handle text just over chunk size', async () => {
            // 1001 chars -> 2 chunks: [0-1000], [800-1001]
            const content = 'x'.repeat(1001);
            const dirents = [mockDirent('over.ts', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValueOnce(content);

            const results = await service.scanDirectory('/workspace');

            expect(results[0].chunks).toHaveLength(2);
            expect(results[0].chunks[0]).toHaveLength(1000);
            expect(results[0].chunks[1]).toHaveLength(201);
        });
    });

    describe('ScanResult structure', () => {
        it('should include path, content, and chunks in each result', async () => {
            const dirents = [mockDirent('test.ts', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValueOnce('const hello = "world";');

            const results = await service.scanDirectory('/workspace');
            const result = results[0];

            expect(result).toHaveProperty('path');
            expect(result).toHaveProperty('content');
            expect(result).toHaveProperty('chunks');
            expect(typeof result.path).toBe('string');
            expect(typeof result.content).toBe('string');
            expect(Array.isArray(result.chunks)).toBe(true);
        });

        it('should use full path including directory', async () => {
            const dirents = [mockDirent('component.tsx', false)];
            vi.mocked(fs.readdir).mockResolvedValueOnce(dirents as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValue('export default () => null;');

            const results = await service.scanDirectory('/workspace/src');

            expect(results[0].path).toBe(path.join('/workspace/src', 'component.tsx'));
        });
    });

    describe('deeply nested directories', () => {
        it('should scan through multiple nested levels', async () => {
            // /root -> /root/a -> /root/a/b -> file.ts
            vi.mocked(fs.readdir)
                .mockResolvedValueOnce([mockDirent('a', true)] as never as Awaited<ReturnType<typeof fs.readdir>>)
                .mockResolvedValueOnce([mockDirent('b', true)] as never as Awaited<ReturnType<typeof fs.readdir>>)
                .mockResolvedValueOnce([mockDirent('file.ts', false)] as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValue('deep content');

            const results = await service.scanDirectory('/root');

            expect(results).toHaveLength(1);
            expect(results[0].path).toBe(path.join('/root', 'a', 'b', 'file.ts'));
        });

        it('should skip ignored directory at any nesting level', async () => {
            // /root -> /root/src -> /root/src/node_modules (should be skipped)
            vi.mocked(fs.readdir)
                .mockResolvedValueOnce([mockDirent('src', true)] as never as Awaited<ReturnType<typeof fs.readdir>>)
                .mockResolvedValueOnce([
                    mockDirent('node_modules', true),
                    mockDirent('index.ts', false),
                ] as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.readFile).mockResolvedValue('code');

            const results = await service.scanDirectory('/root');

            expect(results).toHaveLength(1);
            expect(results[0].path).toBe(path.join('/root', 'src', 'index.ts'));
            // readdir called for /root and /root/src but NOT /root/src/node_modules
            expect(fs.readdir).toHaveBeenCalledTimes(2);
        });
    });
});
