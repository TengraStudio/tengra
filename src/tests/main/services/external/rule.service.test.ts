import path from 'path';

import { RuleService } from '@main/services/external/rule.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

const mockStat = vi.fn();
const mockReadFile = vi.fn();

vi.mock('fs', () => ({
    promises: {
        stat: (...args: unknown[]) => mockStat(...args),
        readFile: (...args: unknown[]) => mockReadFile(...args),
    },
}));

describe('RuleService', () => {
    let service: RuleService;
    const projectRoot = '/test/project';
    const rulesPath = path.join(projectRoot, '.tengra', 'RULES.md');

    beforeEach(() => {
        vi.clearAllMocks();
        service = new RuleService();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('getRules', () => {
        it('should return file content when RULES.md exists', async () => {
            mockStat.mockResolvedValue({ mtimeMs: 1000 });
            mockReadFile.mockResolvedValue('# My Rules\n- Rule 1');

            const result = await service.getRules(projectRoot);

            expect(result).toBe('# My Rules\n- Rule 1');
            expect(mockReadFile).toHaveBeenCalledWith(rulesPath, 'utf-8');
        });

        it('should return null when file does not exist (ENOENT)', async () => {
            const error = new Error('ENOENT') as Error & { code: string };
            error.code = 'ENOENT';
            mockStat.mockRejectedValue(error);

            const result = await service.getRules(projectRoot);

            expect(result).toBeNull();
        });

        it('should return null and warn on non-ENOENT errors', async () => {
            const { appLogger } = await import('@main/logging/logger');
            const error = new Error('Permission denied') as Error & { code: string };
            error.code = 'EACCES';
            mockStat.mockRejectedValue(error);

            const result = await service.getRules(projectRoot);

            expect(result).toBeNull();
            expect(appLogger.warn).toHaveBeenCalled();
        });

        it('should return cached content when file has not changed', async () => {
            mockStat.mockResolvedValue({ mtimeMs: 1000 });
            mockReadFile.mockResolvedValue('cached content');

            await service.getRules(projectRoot);
            mockReadFile.mockClear();

            mockStat.mockResolvedValue({ mtimeMs: 1000 });
            const result = await service.getRules(projectRoot);

            expect(result).toBe('cached content');
            expect(mockReadFile).not.toHaveBeenCalled();
        });

        it('should re-read file when mtime changes', async () => {
            mockStat.mockResolvedValue({ mtimeMs: 1000 });
            mockReadFile.mockResolvedValue('old content');
            await service.getRules(projectRoot);

            mockStat.mockResolvedValue({ mtimeMs: 2000 });
            mockReadFile.mockResolvedValue('new content');
            const result = await service.getRules(projectRoot);

            expect(result).toBe('new content');
            expect(mockReadFile).toHaveBeenCalledTimes(2);
        });

        it('should handle empty file content', async () => {
            mockStat.mockResolvedValue({ mtimeMs: 1000 });
            mockReadFile.mockResolvedValue('');

            const result = await service.getRules(projectRoot);
            expect(result).toBe('');
        });

        it('should handle different project roots independently', async () => {
            mockStat.mockResolvedValue({ mtimeMs: 1000 });
            mockReadFile.mockResolvedValueOnce('rules A').mockResolvedValueOnce('rules B');

            const resultA = await service.getRules('/project-a');
            const resultB = await service.getRules('/project-b');

            expect(resultA).toBe('rules A');
            expect(resultB).toBe('rules B');
        });

        it('should handle error without code property gracefully', async () => {
            mockStat.mockRejectedValue(new Error('unknown error'));

            const result = await service.getRules(projectRoot);
            expect(result).toBeNull();
        });
    });

    describe('clearCache', () => {
        it('should clear cache so next getRules re-reads file', async () => {
            mockStat.mockResolvedValue({ mtimeMs: 1000 });
            mockReadFile.mockResolvedValue('content');

            await service.getRules(projectRoot);
            service.clearCache(projectRoot);
            mockReadFile.mockClear();

            mockStat.mockResolvedValue({ mtimeMs: 1000 });
            mockReadFile.mockResolvedValue('content');
            await service.getRules(projectRoot);

            expect(mockReadFile).toHaveBeenCalledTimes(1);
        });

        it('should not throw when clearing cache for uncached project', () => {
            expect(() => service.clearCache('/nonexistent')).not.toThrow();
        });
    });
});
