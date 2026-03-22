import { type MutableRefObject, useCallback, useEffect } from 'react';

import { WorkspaceMount } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface PendingDirectoryReloadLike {
    mountId: string;
    directoryPath: string;
    parentKey: string | null;
}

interface UseWorkspaceExplorerWatchersArgs {
    mounts: WorkspaceMount[];
    mountsRef: MutableRefObject<WorkspaceMount[]>;
    watchedRootsRef: MutableRefObject<Set<string>>;
    pendingReloadTimeoutRef: MutableRefObject<number | null>;
    pendingDirectoryReloadsRef: MutableRefObject<Map<string, PendingDirectoryReloadLike>>;
    queueDirectoryReload: (mount: WorkspaceMount, targetPath: string) => void;
}

const WATCH_RELEASE_DELAY_MS = 250;
const workspaceWatchRefCounts = new Map<string, number>();
const workspaceWatchReleaseTimers = new Map<string, number>();

function retainWorkspaceWatch(rootPath: string): boolean {
    const releaseTimer = workspaceWatchReleaseTimers.get(rootPath);
    if (releaseTimer !== undefined) {
        window.clearTimeout(releaseTimer);
        workspaceWatchReleaseTimers.delete(rootPath);
    }
    const currentCount = workspaceWatchRefCounts.get(rootPath) ?? 0;
    workspaceWatchRefCounts.set(rootPath, currentCount + 1);
    return currentCount === 0;
}

function releaseWorkspaceWatch(
    rootPath: string,
    onRelease: (releasedRootPath: string) => void
): void {
    const currentCount = workspaceWatchRefCounts.get(rootPath) ?? 0;
    if (currentCount <= 1) {
        workspaceWatchRefCounts.delete(rootPath);
        const timeoutId = window.setTimeout(() => {
            workspaceWatchReleaseTimers.delete(rootPath);
            if ((workspaceWatchRefCounts.get(rootPath) ?? 0) > 0) {
                return;
            }
            onRelease(rootPath);
        }, WATCH_RELEASE_DELAY_MS);
        workspaceWatchReleaseTimers.set(rootPath, timeoutId);
        return;
    }
    workspaceWatchRefCounts.set(rootPath, currentCount - 1);
}

export function useWorkspaceExplorerWatchers({
    mounts,
    mountsRef,
    watchedRootsRef,
    pendingReloadTimeoutRef,
    pendingDirectoryReloadsRef,
    queueDirectoryReload,
}: UseWorkspaceExplorerWatchersArgs): void {
    const releaseWatch = useCallback((rootPath: string) => {
        releaseWorkspaceWatch(rootPath, releasedRootPath => {
            void window.electron.workspace.unwatch(releasedRootPath).catch(error => {
                appLogger.warn('WorkspaceExplorer', 'Failed to stop workspace watch', {
                    rootPath: releasedRootPath,
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        });
    }, []);

    const stopAllWorkspaceWatches = useCallback(() => {
        const watchedRoots = Array.from(watchedRootsRef.current);
        watchedRootsRef.current.clear();
        for (const watchedRoot of watchedRoots) {
            releaseWatch(watchedRoot);
        }
    }, [releaseWatch, watchedRootsRef]);

    const clearPendingDirectoryReloads = useCallback(() => {
        if (pendingReloadTimeoutRef.current !== null) {
            window.clearTimeout(pendingReloadTimeoutRef.current);
            pendingReloadTimeoutRef.current = null;
        }
        pendingDirectoryReloadsRef.current.clear();
    }, [pendingDirectoryReloadsRef, pendingReloadTimeoutRef]);

    useEffect(() => {
        const localMounts = mounts.filter(mount => mount.type === 'local');
        const nextRoots = new Set(localMounts.map(mount => mount.rootPath));

        for (const watchedRoot of Array.from(watchedRootsRef.current)) {
            if (nextRoots.has(watchedRoot)) {
                continue;
            }
            watchedRootsRef.current.delete(watchedRoot);
            releaseWatch(watchedRoot);
        }

        for (const mount of localMounts) {
            if (watchedRootsRef.current.has(mount.rootPath)) {
                continue;
            }
            watchedRootsRef.current.add(mount.rootPath);
            if (!retainWorkspaceWatch(mount.rootPath)) {
                continue;
            }
            void window.electron.workspace.watch(mount.rootPath).catch(error => {
                watchedRootsRef.current.delete(mount.rootPath);
                releaseWatch(mount.rootPath);
                appLogger.warn('WorkspaceExplorer', 'Failed to start workspace watch', {
                    rootPath: mount.rootPath,
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        }
    }, [mounts, releaseWatch, watchedRootsRef]);

    useEffect(() => {
        const unsubscribe = window.electron.workspace.onFileChange(
            (_eventType, changedPath, rootPath) => {
                const mount = mountsRef.current.find(
                    item =>
                        item.type === 'local' &&
                        item.rootPath.replace(/\\/g, '/') === rootPath.replace(/\\/g, '/')
                );
                if (!mount) {
                    return;
                }
                queueDirectoryReload(mount, changedPath);
            }
        );

        return () => {
            unsubscribe();
            clearPendingDirectoryReloads();
            stopAllWorkspaceWatches();
        };
    }, [
        clearPendingDirectoryReloads,
        mountsRef,
        queueDirectoryReload,
        stopAllWorkspaceWatches,
    ]);
}
