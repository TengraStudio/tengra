/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { FileManagementService } from '@main/services/data/file.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_NOTES_PATH = path.join(os.tmpdir(), 'tengra-tests', 'notes');
const TEST_RENAME_PATH = path.join(os.tmpdir(), 'tengra-tests', 'rename');
const TEST_WATCH_PATH = path.join(os.tmpdir(), 'tengra-tests', 'watch');

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('electron', () => ({
    app: {
        once: vi.fn(),
        getPath: vi.fn().mockReturnValue(path.join(os.tmpdir(), 'tengra-tests', 'userData'))
    }
}));

vi.mock('fs/promises');
vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn().mockReturnValue({
        on: vi.fn(),
        close: vi.fn(),
        destroy: vi.fn()
    }),
    watch: vi.fn().mockReturnValue({
        on: vi.fn(),
        close: vi.fn()
    }),
    FSWatcher: vi.fn()
}));

vi.mock('child_process', () => ({
    spawn: vi.fn()
}));

vi.mock('https', () => ({
    get: vi.fn()
}));

describe('FileManagementService', () => {
    let service: FileManagementService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new FileManagementService();
    });

    describe('extractStrings', () => {
        it('should extract printable strings from a file', async () => {
            const buffer = Buffer.from('hello\x00world\x00test');
            vi.mocked(fs.stat).mockResolvedValue({ size: buffer.length } as Awaited<ReturnType<typeof fs.stat>>);
            vi.mocked(fs.readFile).mockResolvedValue(buffer as never as string);

            const result = await service.extractStrings('/test/file.bin');
            expect(result.success).toBe(true);
            expect(result.result?.strings).toContain('hello');
            expect(result.result?.strings).toContain('world');
        });

        it('should respect minLength parameter', async () => {
            const buffer = Buffer.from('ab\x00cdef\x00gh');
            vi.mocked(fs.stat).mockResolvedValue({ size: buffer.length } as Awaited<ReturnType<typeof fs.stat>>);
            vi.mocked(fs.readFile).mockResolvedValue(buffer as never as string);

            const result = await service.extractStrings('/test/file.bin', 4);
            expect(result.success).toBe(true);
            expect(result.result?.strings).toEqual(['cdef']);
        });

        it('should return error for invalid path', async () => {
            const result = await service.extractStrings('\0invalid');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should return error when file exceeds size limit', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ size: 20 * 1024 * 1024 } as Awaited<ReturnType<typeof fs.stat>>);

            const result = await service.extractStrings('/test/big.bin');
            expect(result.success).toBe(false);
            expect(result.error).toContain('size limit');
        });
    });

    describe('syncNote', () => {
        it('should write a note file', async () => {
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            const result = await service.syncNote('My Note', 'content here', TEST_NOTES_PATH);
            expect(result.success).toBe(true);
            expect(result.result?.path).toContain('my_note.md');
        });

        it('should return error when content exceeds write limit', async () => {
            const bigContent = 'x'.repeat(11 * 1024 * 1024);
            const result = await service.syncNote('big', bigContent, TEST_NOTES_PATH);
            expect(result.success).toBe(false);
            expect(result.error).toContain('size limit');
        });
    });

    describe('batchRename', () => {
        it('should rename matching files', async () => {
            vi.mocked(fs.readdir).mockResolvedValue(['file_old.txt', 'file_old2.txt', 'other.txt'] as never as Awaited<ReturnType<typeof fs.readdir>>);
            vi.mocked(fs.rename).mockResolvedValue(undefined);

            const result = await service.batchRename(TEST_RENAME_PATH, '_old', '_new');
            expect(result.success).toBe(true);
            expect(result.message).toContain('2 files renamed');
        });

        it('should handle empty directory', async () => {
            vi.mocked(fs.readdir).mockResolvedValue([] as never as Awaited<ReturnType<typeof fs.readdir>>);

            const result = await service.batchRename(TEST_RENAME_PATH, 'x', 'y');
            expect(result.success).toBe(true);
            expect(result.message).toContain('0 files renamed');
        });
    });

    describe('applyEdits', () => {
        it('should apply edits to file', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as Awaited<ReturnType<typeof fs.stat>>);
            vi.mocked(fs.readFile).mockResolvedValue('line1\nline2\nline3' as never as string);
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            const result = await service.applyEdits('/test/file.md', [
                { startLine: 2, endLine: 2, replacement: 'replaced' }
            ]);
            expect(result.success).toBe(true);
        });

        it('should return error for invalid line range', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as Awaited<ReturnType<typeof fs.stat>>);
            vi.mocked(fs.readFile).mockResolvedValue('line1\nline2' as never as string);

            const result = await service.applyEdits('/test/file.md', [
                { startLine: 1, endLine: 5, replacement: 'x' }
            ]);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid line range');
        });

        it('should reject disallowed file types', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ size: 10 } as Awaited<ReturnType<typeof fs.stat>>);

            const result = await service.applyEdits('/test/file.exe', [
                { startLine: 1, endLine: 1, replacement: 'x' }
            ]);
            expect(result.success).toBe(false);
            expect(result.error).toContain('File type not allowed');
        });
    });

    describe('watchFolder', () => {
        it('should set up a folder watcher', () => {
            const result = service.watchFolder(TEST_WATCH_PATH);
            expect(result.success).toBe(true);
            expect(result.data?.close).toBeInstanceOf(Function);
        });
    });
});
