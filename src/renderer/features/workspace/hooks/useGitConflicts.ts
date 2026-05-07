/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useState } from 'react';

import { GitConflict } from '../components/git/types';


/**
 * Hook for git conflict operations
 */
export function useGitConflicts(
    canRun: boolean,
    workspacePath: string | undefined
) {
    const [conflicts, setConflicts] = useState<GitConflict[]>([]);
    const [conflictAnalytics, setConflictAnalytics] = useState<Record<string, number>>({});

    const fetchConflicts = useCallback(async () => {
        if (!canRun || !workspacePath) {
            return;
        }
        const response = await window.electron.git.getConflicts(workspacePath);
        if (response.success) {
            setConflicts(response.conflicts ?? []);
            setConflictAnalytics(response.analytics ?? {});
        }
    }, [canRun, workspacePath]);

    const resolveConflict = useCallback(
        async (filePath: string, strategy: 'ours' | 'theirs' | 'manual') => {
            if (!canRun || !workspacePath) {
                return false;
            }
            const response = await window.electron.git.resolveConflict(
                workspacePath,
                filePath,
                strategy
            );
            await fetchConflicts();
            return response.success;
        },
        [canRun, workspacePath, fetchConflicts]
    );

    const openMergeTool = useCallback(
        async (filePath?: string) => {
            if (!canRun || !workspacePath) {
                return false;
            }
            const response = await window.electron.git.openMergeTool(
                workspacePath,
                filePath ?? ''
            );
            await fetchConflicts();
            return response.success;
        },
        [canRun, workspacePath, fetchConflicts]
    );

    return {
        conflicts,
        conflictAnalytics,
        fetchConflicts,
        resolveConflict,
        openMergeTool,
    };
}

