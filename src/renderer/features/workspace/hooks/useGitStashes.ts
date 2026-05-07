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

import { GitStash } from '../components/git/types';

/**
 * Hook for git stash operations
 */
export function useGitStashes(
    canRun: boolean,
    workspacePath: string | undefined
) {
    const [stashes, setStashes] = useState<GitStash[]>([]);

    const fetchStashes = useCallback(async () => {
        if (!canRun || !workspacePath) {
            return;
        }
        const response = await window.electron.git.getStashes(workspacePath);
        if (response.success) {
            setStashes(response.stashes ?? []);
        }
    }, [canRun, workspacePath]);

    const createStash = useCallback(
        async (message: string, includeUntracked = true) => {
            if (!canRun || !workspacePath) {
                return false;
            }
            const response = await window.electron.git.createStash(
                workspacePath,
                message,
                includeUntracked
            );
            await fetchStashes();
            return response.success;
        },
        [canRun, workspacePath, fetchStashes]
    );

    const applyStash = useCallback(
        async (stashRef: string, pop: boolean) => {
            if (!canRun || !workspacePath) {
                return false;
            }
            const response = await window.electron.git.applyStash(
                workspacePath,
                stashRef,
                pop
            );
            await fetchStashes();
            return response.success;
        },
        [canRun, workspacePath, fetchStashes]
    );

    const dropStash = useCallback(
        async (stashRef: string) => {
            if (!canRun || !workspacePath) {
                return false;
            }
            const response = await window.electron.git.dropStash(workspacePath, stashRef);
            await fetchStashes();
            return response.success;
        },
        [canRun, workspacePath, fetchStashes]
    );

    const exportStash = useCallback(
        async (stashRef: string) => {
            if (!canRun || !workspacePath) {
                return;
            }
            const response = await window.electron.git.exportStash(
                workspacePath,
                stashRef
            );
            if (!response.success) {
                return;
            }
            // Download the patch
            const blob = new Blob([response.patch ?? ''], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${stashRef.replace(/[{}@]/g, '_')}.patch`;
            anchor.click();
            URL.revokeObjectURL(url);
        },
        [canRun, workspacePath]
    );

    return {
        stashes,
        fetchStashes,
        createStash,
        applyStash,
        dropStash,
        exportStash,
    };
}

