/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import type { WorkspaceMount } from '@/types';

import type { WorkspaceExplorerRow } from '../hooks/useWorkspaceExplorerTree';
import { buildFallbackExplorerRows, extractFallbackDirectoryEntries } from '../utils/workspace-explorer.util';

interface FallbackOptions {
    mounts: WorkspaceMount[];
    hasMounts: boolean;
    isAnyMountLoading: boolean;
    filterQuery: string;
    displayRowsCount: number;
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean;
}

export function useWorkspaceExplorerFallback({
    mounts,
    hasMounts,
    isAnyMountLoading,
    filterQuery,
    displayRowsCount,
    onEnsureMount,
}: FallbackOptions) {
    const [fallbackRows, setFallbackRows] = React.useState<WorkspaceExplorerRow[]>([]);
    const [fallbackLoading, setFallbackLoading] = React.useState(false);
    const fallbackRequestKeyRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (displayRowsCount > 0) {
            fallbackRequestKeyRef.current = null;
            if (fallbackRows.length > 0) {
                queueMicrotask(() => {
                    setFallbackRows([]);
                });
            }
            if (fallbackLoading) {
                queueMicrotask(() => {
                    setFallbackLoading(false);
                });
            }
            return;
        }

        if (filterQuery.trim().length > 0 || !hasMounts || isAnyMountLoading) {
            return;
        }

        const requestKey = mounts
            .map(mount => `${mount.id}:${mount.type}:${mount.rootPath}`)
            .join('|');

        if (fallbackRequestKeyRef.current === requestKey) {
            return;
        }

        fallbackRequestKeyRef.current = requestKey;
        let cancelled = false;

        const loadFallbackRows = async () => {
            setFallbackLoading(true);
            try {
                const entriesByMount = new Map<string, Array<{ name: string; isDirectory: boolean }>>();

                for (const mount of mounts) {
                    const rootPath = typeof mount.rootPath === 'string' ? mount.rootPath.trim() : '';
                    if (!rootPath) {
                        continue;
                    }

                    const isReady = onEnsureMount ? await onEnsureMount(mount) : true;
                    if (!isReady) {
                        continue;
                    }

                    const result = mount.type === 'local'
                        ? await window.electron.files.listDirectory(rootPath)
                        : await window.electron.ssh.listDir(mount.id, rootPath);

                    if (!result.success) {
                        continue;
                    }

                    const entries = extractFallbackDirectoryEntries(result);
                    if (entries.length > 0) {
                        entriesByMount.set(mount.id, entries);
                    }
                }

                if (cancelled) {
                    return;
                }

                setFallbackRows(buildFallbackExplorerRows(mounts, entriesByMount));
            } finally {
                if (!cancelled) {
                    setFallbackLoading(false);
                }
            }
        };

        void loadFallbackRows();

        return () => {
            cancelled = true;
        };
    }, [displayRowsCount, fallbackLoading, fallbackRows.length, filterQuery, hasMounts, isAnyMountLoading, mounts, onEnsureMount]);

    return { fallbackRows, fallbackLoading };
}
