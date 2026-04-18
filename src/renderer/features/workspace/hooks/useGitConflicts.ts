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

type InvokeGitFn = <T>(channel: string, ...args: (string | number | boolean)[]) => Promise<T>;

/**
 * Hook for git conflict operations
 */
export function useGitConflicts(
    canRun: boolean,
    workspacePath: string | undefined,
    invokeGit: InvokeGitFn
) {
    const [conflicts, setConflicts] = useState<GitConflict[]>([]);
    const [conflictAnalytics, setConflictAnalytics] = useState<Record<string, number>>({});

    const fetchConflicts = useCallback(async () => {
        if (!canRun || !workspacePath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; conflicts?: GitConflict[]; analytics?: Record<string, number> }>(
            'git:getConflicts',
            workspacePath
        );
        if (response.success) {
            setConflicts(response.conflicts ?? []);
            setConflictAnalytics(response.analytics ?? {});
        }
    }, [canRun, workspacePath, invokeGit]);

    const resolveConflict = useCallback(
        async (filePath: string, strategy: 'ours' | 'theirs' | 'manual') => {
            if (!canRun || !workspacePath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:resolveConflict',
                workspacePath,
                filePath,
                strategy
            );
            await fetchConflicts();
            return response.success;
        },
        [canRun, workspacePath, invokeGit, fetchConflicts]
    );

    const openMergeTool = useCallback(
        async (filePath?: string) => {
            if (!canRun || !workspacePath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:openMergeTool',
                workspacePath,
                filePath ?? ''
            );
            await fetchConflicts();
            return response.success;
        },
        [canRun, workspacePath, invokeGit, fetchConflicts]
    );

    return {
        conflicts,
        conflictAnalytics,
        fetchConflicts,
        resolveConflict,
        openMergeTool,
    };
}
