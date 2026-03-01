import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({
    execFile: vi.fn()
}));

vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn()
    }
}));

vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e))
}));

import { execFile } from 'child_process';
import { promises as fs } from 'fs';

import { GitService } from '@main/services/project/git.service';

const mockedExecFile = vi.mocked(execFile);

function setupExecFile(stdout: string, stderr = ''): void {
    mockedExecFile.mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
            (cb as (err: Error | null, stdout: string, stderr: string) => void)(null, stdout, stderr);
            return undefined as never;
        }
    );
}

function setupExecFileError(message: string): void {
    mockedExecFile.mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: unknown) => {
            (cb as (err: Error | null, stdout: string, stderr: string) => void)(new Error(message), '', '');
            return undefined as never;
        }
    );
}

describe('GitService', () => {
    let service: GitService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new GitService();
    });

    describe('getStatus', () => {
        it('should parse git status output', async () => {
            setupExecFile(' M src/file.ts\n?? new.ts\n');
            const result = await service.getStatus('/repo');
            expect(result).toEqual([
                { path: 'src/file.ts', status: ' M' },
                { path: 'new.ts', status: '??' }
            ]);
        });

        it('should return empty array when no output', async () => {
            setupExecFile('');
            const result = await service.getStatus('/repo');
            expect(result).toEqual([]);
        });
    });

    describe('add', () => {
        it('should execute git add', async () => {
            setupExecFile('');
            const result = await service.add('/repo', 'file.ts');
            expect(result.success).toBe(true);
            expect(mockedExecFile).toHaveBeenCalledWith(
                'git',
                ['add', '--', 'file.ts'],
                expect.objectContaining({ cwd: '/repo' }),
                expect.any(Function)
            );
        });

        it('should default to adding all files', async () => {
            setupExecFile('');
            await service.add('/repo');
            expect(mockedExecFile).toHaveBeenCalledWith(
                'git',
                ['add', '--', '.'],
                expect.objectContaining({ cwd: '/repo' }),
                expect.any(Function)
            );
        });
    });

    describe('commit', () => {
        it('should execute git commit with message', async () => {
            setupExecFile('1 file changed');
            const result = await service.commit('/repo', 'feat: init');
            expect(result.success).toBe(true);
            expect(mockedExecFile).toHaveBeenCalledWith(
                'git',
                ['commit', '-m', 'feat: init'],
                expect.objectContaining({ cwd: '/repo' }),
                expect.any(Function)
            );
        });
    });

    describe('push', () => {
        it('should push with defaults', async () => {
            setupExecFile('');
            const result = await service.push('/repo');
            expect(result.success).toBe(true);
            expect(mockedExecFile).toHaveBeenCalledWith(
                'git',
                ['push', 'origin', 'main'],
                expect.objectContaining({ cwd: '/repo' }),
                expect.any(Function)
            );
        });
    });

    describe('pull', () => {
        it('should pull successfully', async () => {
            setupExecFile('Already up to date.');
            const result = await service.pull('/repo');
            expect(result.success).toBe(true);
        });
    });

    describe('getLog', () => {
        it('should parse log entries', async () => {
            setupExecFile('abc1234|feat: init|John|2024-01-01T00:00:00Z');
            const result = await service.getLog('/repo', 5);
            expect(result).toEqual([{
                hash: 'abc1234',
                message: 'feat: init',
                author: 'John',
                date: '2024-01-01T00:00:00Z'
            }]);
        });

        it('should return empty for blank cwd', async () => {
            const result = await service.getLog('');
            expect(result).toEqual([]);
        });

        it('should return empty when no output', async () => {
            setupExecFile('');
            const result = await service.getLog('/repo');
            expect(result).toEqual([]);
        });
    });

    describe('getBranches', () => {
        it('should return branches', async () => {
            setupExecFile('* main\n  feature');
            const result = await service.getBranches('/repo');
            expect(result.success).toBe(true);
            expect(result.stdout).toContain('main');
        });
    });

    describe('checkout', () => {
        it('should checkout branch', async () => {
            setupExecFile('');
            const result = await service.checkout('/repo', 'develop');
            expect(result.success).toBe(true);
        });
    });

    describe('cancelOperation', () => {
        it('should return false for empty operationId', () => {
            expect(service.cancelOperation('')).toBe(false);
            expect(service.cancelOperation('  ')).toBe(false);
        });

        it('should return false for unknown operationId', () => {
            expect(service.cancelOperation('unknown-op')).toBe(false);
        });
    });

    describe('executeRaw', () => {
        it('should execute arbitrary git command', async () => {
            setupExecFile('v2.40.0');
            const result = await service.executeRaw('/repo', '--version');
            expect(result.success).toBe(true);
            expect(result.stdout).toBe('v2.40.0');
        });
    });

    describe('error handling', () => {
        it('should decorate lock errors with guidance', async () => {
            setupExecFileError('Unable to create index.lock');
            const result = await service.executeRaw('/repo', 'status');
            expect(result.success).toBe(false);
            expect(result.lockRecoveryGuidance).toBeDefined();
            expect(result.error).toContain('lock');
        });

        it('should detect timeout errors', async () => {
            setupExecFileError('command timed out');
            const result = await service.executeRaw('/repo', 'fetch');
            expect(result.success).toBe(false);
            expect(result.timedOut).toBe(true);
        });
    });

    describe('stageFile / unstageFile', () => {
        it('should stage a file', async () => {
            setupExecFile('');
            const result = await service.stageFile('/repo', 'src/a.ts');
            expect(result.success).toBe(true);
        });

        it('should unstage a file', async () => {
            setupExecFile('');
            const result = await service.unstageFile('/repo', 'src/a.ts');
            expect(result.success).toBe(true);
        });
    });

    describe('getFileDiff', () => {
        it('should parse unified diff', async () => {
            setupExecFile('@@ -1,2 +1,2 @@\n-old line\n+new line\n context\n');
            const result = await service.getFileDiff('/repo', 'file.ts');
            expect(result.success).toBe(true);
            expect(result.original).toContain('old line');
            expect(result.modified).toContain('new line');
        });

        it('should handle error gracefully', async () => {
            setupExecFileError('fatal: bad object');
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
            const result = await service.getFileDiff('/repo', 'missing.ts');
            expect(result.success).toBe(false);
        });
    });

    describe('getUnifiedDiff', () => {
        it('should return diff string', async () => {
            setupExecFile('diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ @@\n+added');
            const result = await service.getUnifiedDiff('/repo', 'f');
            expect(result.success).toBe(true);
            expect(result.diff).toContain('added');
        });
    });

    describe('getCommitDiff', () => {
        it('should return commit diff', async () => {
            setupExecFile('commit abc\nAuthor: X\ndiff content');
            const result = await service.getCommitDiff('/repo', 'abc');
            expect(result.success).toBe(true);
            expect(result.diff).toContain('diff content');
        });

        it('should handle stderr-only failure', async () => {
            setupExecFile('', 'bad revision');
            // When success=true but stdout empty and stderr present, diff is empty string
            const result = await service.getCommitDiff('/repo', 'invalid');
            expect(result.diff).toBe('');
        });
    });
});
