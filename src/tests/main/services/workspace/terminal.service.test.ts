import path from 'path';

import { TerminalService } from '@main/services/workspace/terminal.service';
import { app } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_DATA_PATH = 'C:/user-data';
const fileStore = new Map<string, string>();
const existingPaths = new Set<string>();
const normalizePath = (targetPath: string) => targetPath.replace(/\\/g, '/');

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => USER_DATA_PATH),
    },
}));

vi.mock('fs', () => {
    const writeToFile = (targetPath: string, content: string) => {
        const normalized = normalizePath(targetPath);
        fileStore.set(normalized, content);
        existingPaths.add(normalized);
    };

    return {
        existsSync: vi.fn((targetPath: string) => {
            if (typeof targetPath !== 'string') {
                return false;
            }
            const normalized = normalizePath(targetPath);
            return existingPaths.has(normalized) || fileStore.has(normalized) || targetPath.endsWith('.exe') || targetPath.startsWith('/bin/');
        }),
        mkdirSync: vi.fn((targetPath: string) => {
            if (typeof targetPath === 'string') {
                existingPaths.add(normalizePath(targetPath));
            }
        }),
        createWriteStream: vi.fn((targetPath: string) => ({
            write: (chunk: string) => {
                const current = fileStore.get(targetPath) ?? '';
                writeToFile(targetPath, `${current}${chunk}`);
            },
            end: vi.fn(),
        })),
        promises: {
            readFile: vi.fn(async (targetPath: string) => {
                const normalized = normalizePath(targetPath);
                if (!fileStore.has(normalized)) {
                    throw new Error('ENOENT');
                }
                return fileStore.get(normalized) ?? '';
            }),
            writeFile: vi.fn(async (targetPath: string, content: string) => {
                writeToFile(targetPath, content);
            }),
            mkdir: vi.fn(async (targetPath: string) => {
                existingPaths.add(targetPath);
            }),
            unlink: vi.fn(async (targetPath: string) => {
                const normalized = normalizePath(targetPath);
                fileStore.delete(normalized);
                existingPaths.delete(normalized);
            }),
            stat: vi.fn(async (targetPath: string) => {
                const content = fileStore.get(normalizePath(targetPath)) ?? '';
                return {
                    size: Buffer.byteLength(content, 'utf-8'),
                    mtimeMs: Date.now(),
                };
            }),
            open: vi.fn(async (targetPath: string) => {
                const content = fileStore.get(normalizePath(targetPath)) ?? '';
                return {
                    read: async (buffer: Buffer, offset: number, length: number, position: number) => {
                        const chunk = content.slice(position, position + length);
                        buffer.write(chunk, offset, 'utf-8');
                        return { bytesRead: Buffer.byteLength(chunk, 'utf-8'), buffer };
                    },
                    close: async () => undefined,
                };
            }),
            readdir: vi.fn(async () => []),
            access: vi.fn(async () => undefined),
        },
    };
});

vi.mock('@main/services/terminal/backends/node-pty.backend', () => ({
    NodePtyBackend: class {
        id = 'node-pty';

        async isAvailable() {
            return true;
        }

        async create() {
            return {
                write: vi.fn(),
                resize: vi.fn(),
                kill: vi.fn(),
            };
        }
    }
}));

vi.mock('@main/services/terminal/backends/ghostty.backend', () => ({
    GhosttyBackend: class {
        id = 'ghostty';
        async isAvailable() { return false; }
        async create() { throw new Error('Unavailable backend'); }
    }
}));
vi.mock('@main/services/terminal/backends/alacritty.backend', () => ({
    AlacrittyBackend: class {
        id = 'alacritty';
        async isAvailable() { return false; }
        async create() { throw new Error('Unavailable backend'); }
    }
}));
vi.mock('@main/services/terminal/backends/warp.backend', () => ({
    WarpBackend: class {
        id = 'warp';
        async isAvailable() { return false; }
        async create() { throw new Error('Unavailable backend'); }
    }
}));
vi.mock('@main/services/terminal/backends/kitty.backend', () => ({
    KittyBackend: class {
        id = 'kitty';
        async isAvailable() { return false; }
        async create() { throw new Error('Unavailable backend'); }
    }
}));
vi.mock('@main/services/terminal/backends/windows-terminal.backend', () => ({
    WindowsTerminalBackend: class {
        id = 'windows-terminal';
        async isAvailable() { return false; }
        async create() { throw new Error('Unavailable backend'); }
    }
}));

describe('TerminalService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fileStore.clear();
        existingPaths.clear();
        existingPaths.add(normalizePath(path.join(USER_DATA_PATH, 'terminal-logs')));
    });

    it('creates, writes, resizes, and kills terminal sessions', async () => {
        const service = new TerminalService();

        const created = await service.createSession({
            id: 'session-1',
            cwd: USER_DATA_PATH,
            onData: vi.fn(),
            onExit: vi.fn(),
        });

        expect(created).toBe(true);
        expect(service.getActiveSessions()).toEqual(['session-1']);
        expect(service.write('session-1', 'echo hello')).toBe(true);
        expect(service.resize('session-1', 120, 40)).toBe(true);
        expect(service.kill('session-1')).toBe(true);
        expect(service.getActiveSessions()).toEqual([]);
    });

    it('persists snapshots and restores sessions after restart', async () => {
        const serviceBeforeRestart = new TerminalService();
        await serviceBeforeRestart.createSession({
            id: 'persist-1',
            cwd: USER_DATA_PATH,
            onData: vi.fn(),
            onExit: vi.fn(),
            title: 'Persisted Session',
        });

        await serviceBeforeRestart.cleanup();

        const snapshotPath = normalizePath(path.join(USER_DATA_PATH, 'terminal-sessions.json'));
        expect(fileStore.get(snapshotPath)).toContain('persist-1');

        const serviceAfterRestart = new TerminalService();
        await serviceAfterRestart.initialize();

        const snapshots = serviceAfterRestart.getSessionSnapshots();
        expect(snapshots.map(snapshot => snapshot.id)).toContain('persist-1');

        const restoreResult = await serviceAfterRestart.restoreAllSnapshots({
            onData: vi.fn(),
            onExit: vi.fn(),
        });

        expect(restoreResult.restored).toBe(1);
        expect(restoreResult.failed).toBe(0);
        expect(restoreResult.sessionIds).toContain('persist-1');
    });

    it('uses userData path from electron app for persistence files', () => {
        new TerminalService();
        expect(app.getPath).toHaveBeenCalledWith('userData');
    });
});
