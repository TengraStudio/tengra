import { registerGitAdvancedIpc } from '@main/ipc/git-advanced';
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: TestValue[]) => Promise<TestValue>) => {
            ipcHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));


vi.mock('@main/utils/operation-wrapper.util', () => ({
    withOperationGuard: vi.fn(async (_scope: string, fn: () => Promise<TestValue>) => fn())
}));

describe('Git Advanced IPC Handlers', () => {
    let gitService: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
        ipcHandlers.clear();
        vi.clearAllMocks();
        gitService = {
            executeRaw: vi.fn(async (_cwd: string, command: string) => {
                if (command.startsWith('rev-list')) {
                    return { success: true, stdout: '42' };
                }
                if (command.startsWith('shortlog')) {
                    return { success: true, stdout: '10 John Doe <john@example.com>' };
                }
                if (command.includes('--name-only')) {
                    return { success: true, stdout: 'src/a.ts\nsrc/a.ts\nsrc/b.ts' };
                }
                if (command.includes('--date=short')) {
                    return { success: true, stdout: '2026-02-10\n2026-02-10\n2026-02-11' };
                }
                return { success: true, stdout: '', stderr: '' };
            }),
            cancelOperation: vi.fn((id: string) => id === 'op-1')
        };
        registerGitAdvancedIpc(gitService as never as Parameters<typeof registerGitAdvancedIpc>[0], (_e) => {});
    });

    it('registers advanced git handlers', () => {
        expect(ipcMain.handle).toHaveBeenCalled();
        expect(ipcHandlers.has('git:getRepositoryStats')).toBe(true);
        expect(ipcHandlers.has('git:runControlledOperation')).toBe(true);
        expect(ipcHandlers.has('git:cancelOperation')).toBe(true);
    });

    it('rejects non-allowlisted controlled command', async () => {
        const handler = ipcHandlers.get('git:runControlledOperation');
        const result = await handler?.({}, 'C:/repo', 'reset --hard', 'op-2', 5000);
        expect(result).toEqual({
            success: false,
            error: 'Operation is not allowed for controlled execution',
        });
    });

    it('returns repository stats and clamps invalid days', async () => {
        const handler = ipcHandlers.get('git:getRepositoryStats');
        const result = await handler?.({}, 'C:/repo', -1);
        expect((result as Record<string, TestValue>).success).toBe(true);
        expect((result as Record<string, Record<string, TestValue>>).stats.totalCommits).toBe(42);
        expect((result as Record<string, Record<string, TestValue>>).stats.days).toBe(365);
    });
});

