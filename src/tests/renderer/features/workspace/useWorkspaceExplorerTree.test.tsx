/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileNode } from '@/features/workspace/components';
import { useWorkspaceExplorerTree } from '@/features/workspace/hooks/useWorkspaceExplorerTree';
import { applyGitTreeStatus } from '@/features/workspace/utils/gitTreeStatus'; 
import type { WorkspaceMount } from '@/types';
import { webElectronMock } from '@/web-bridge';

vi.mock('@/features/workspace/utils/gitTreeStatus', () => ({
    applyGitTreeStatus: vi.fn(),
}));

const TEST_MOUNT: WorkspaceMount = {
    id: 'mount-1',
    name: 'Repo',
    type: 'local',
    rootPath: '/repo',
};

interface ElectronWorkspaceTestControls {
    emitFileChange: (event: string, path: string, rootPath?: string) => void;
    watch: ReturnType<typeof vi.fn>;
    unwatch: ReturnType<typeof vi.fn>;
}

function setupElectronMocks(listDirectory: ReturnType<typeof vi.fn>): ElectronWorkspaceTestControls {
    const base = window.electron ?? webElectronMock;
    let fileChangeListener: ((event: string, path: string, rootPath: string) => void) | null = null;
    const watch = vi.fn().mockResolvedValue(true);
    const unwatch = vi.fn().mockResolvedValue(true);
    window.electron = {
        ...base,
        files: {
            ...base.files,
            listDirectory,
        },
        ssh: {
            ...base.ssh,
            listDir: vi.fn(),
        },
        ipcRenderer: {
            ...base.ipcRenderer,
            invoke: vi.fn(),
        },
        workspace: {
            ...base.workspace,
            watch,
            unwatch,
            onFileChange: callback => {
                fileChangeListener = callback;
                return () => {
                    fileChangeListener = null;
                };
            },
        },
    } as typeof window.electron;

    return {
        emitFileChange: (event: string, path: string, rootPath = TEST_MOUNT.rootPath) => {
            fileChangeListener?.(event, path, rootPath);
        },
        watch,
        unwatch,
    };
}

describe('useWorkspaceExplorerTree', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
        vi.useRealTimers();
    });

    it('renders directory rows before git decorations finish loading', async () => {
        const listDirectory = vi.fn().mockResolvedValue({
            success: true,
            files: [
                { name: 'src', isDirectory: true },
                { name: 'README.md', isDirectory: false },
            ],
        });
        let resolveGitDecorations: ((nodes: FileNode[]) => void) | null = null;
        let pendingNodes: FileNode[] = [];
        vi.mocked(applyGitTreeStatus).mockImplementation(
            async (_cwd, _directoryPath, nodes) =>
                await new Promise<FileNode[]>(resolve => {
                    pendingNodes = nodes;
                    resolveGitDecorations = resolve;
                })
        );
        setupElectronMocks(listDirectory);

        const { result } = renderHook(() =>
            useWorkspaceExplorerTree({
                workspaceId: 'workspace-1',
                mounts: [TEST_MOUNT],
                refreshSignal: 0,
                storageKey: 'workspace.explorer.test',
            })
        );

        await waitFor(() =>
            expect(
                result.current.visibleRows
                    .filter(row => row.type === 'entry')
                    .map(row => row.entry.name)
            ).toEqual(['src', 'README.md'])
        );

        expect(applyGitTreeStatus).toHaveBeenCalledWith(
            TEST_MOUNT.rootPath,
            TEST_MOUNT.rootPath,
            expect.any(Array)
        );

        await act(async () => {
            resolveGitDecorations?.(pendingNodes);
            await Promise.resolve();
        });
    });

    it('does not re-fetch already loaded directories when revealing the same path', async () => {
        const listDirectory = vi.fn().mockImplementation(async (path: string) => {
            if (path === '/repo') {
                return {
                    success: true,
                    files: [{ name: 'src', isDirectory: true }],
                };
            }

            if (path === '/repo/src') {
                return {
                    success: true,
                    files: [{ name: 'app.ts', isDirectory: false }],
                };
            }

            return {
                success: true,
                files: [],
            };
        });
        vi.mocked(applyGitTreeStatus).mockImplementation(async (_cwd, _directoryPath, nodes) => nodes);
        setupElectronMocks(listDirectory);

        const { result } = renderHook(() =>
            useWorkspaceExplorerTree({
                workspaceId: 'workspace-1',
                mounts: [TEST_MOUNT],
                refreshSignal: 0,
                storageKey: 'workspace.explorer.test',
            })
        );

        await waitFor(() =>
            expect(
                result.current.visibleRows.some(
                    row => row.type === 'entry' && row.entry.path === '/repo/src'
                )
            ).toBe(true)
        );

        await act(async () => {
            await result.current.revealPath('/repo/src/app.ts');
        });

        await waitFor(() =>
            expect(
                result.current.visibleRows.some(
                    row => row.type === 'entry' && row.entry.path === '/repo/src/app.ts'
                )
            ).toBe(true)
        );

        expect(listDirectory).toHaveBeenCalledTimes(2);

        await act(async () => {
            await result.current.revealPath('/repo/src/app.ts');
        });

        expect(listDirectory).toHaveBeenCalledTimes(2);
    });

    it('reloads only the affected loaded directory when workspace watcher events arrive', async () => {
        const listDirectory = vi.fn().mockImplementation(async (path: string) => {
            if (path === '/repo') {
                return {
                    success: true,
                    files: [{ name: 'src', isDirectory: true }],
                };
            }

            if (path === '/repo/src') {
                const currentCallCount = listDirectory.mock.calls.filter(
                    ([calledPath]) => calledPath === '/repo/src'
                ).length;
                return {
                    success: true,
                    files: currentCallCount > 1
                        ? [
                            { name: 'app.ts', isDirectory: false },
                            { name: 'new.ts', isDirectory: false },
                        ]
                        : [{ name: 'app.ts', isDirectory: false }],
                };
            }

            return {
                success: true,
                files: [],
            };
        });
        vi.mocked(applyGitTreeStatus).mockImplementation(async (_cwd, _directoryPath, nodes) => nodes);
        const workspaceControls = setupElectronMocks(listDirectory);

        const { result, unmount } = renderHook(() =>
            useWorkspaceExplorerTree({
                workspaceId: 'workspace-1',
                mounts: [TEST_MOUNT],
                refreshSignal: 0,
                storageKey: 'workspace.explorer.test',
            })
        );

        await waitFor(() =>
            expect(
                result.current.visibleRows.some(
                    row => row.type === 'entry' && row.entry.path === '/repo/src'
                )
            ).toBe(true)
        );

        await act(async () => {
            await result.current.revealPath('/repo/src/app.ts');
        });

        await waitFor(() =>
            expect(
                result.current.visibleRows.some(
                    row => row.type === 'entry' && row.entry.path === '/repo/src/app.ts'
                )
            ).toBe(true)
        );

        expect(workspaceControls.watch).toHaveBeenCalledWith('/repo');
        expect(listDirectory).toHaveBeenCalledTimes(2);

        await act(async () => {
            workspaceControls.emitFileChange('rename', '/repo/src/new.ts');
            await new Promise(resolve => {
                window.setTimeout(resolve, 120);
            });
        });

        await waitFor(() =>
            expect(
                result.current.visibleRows.some(
                    row => row.type === 'entry' && row.entry.path === '/repo/src/new.ts'
                )
            ).toBe(true)
        );

        expect(listDirectory).toHaveBeenCalledTimes(3);
        expect(listDirectory).toHaveBeenLastCalledWith('/repo/src');

        unmount();
        await waitFor(() => {
            expect(workspaceControls.unwatch).toHaveBeenCalledWith('/repo');
        });
    });
});

