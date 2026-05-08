/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useState } from 'react';

import { appLogger } from '@/utils/renderer-logger';

interface UseWorkspaceBranchStateOptions {
    workspacePath?: string;
    enabled?: boolean;
    t: (path: string, options?: Record<string, string | number>) => string;
}

interface WorkspaceBranchSnapshot {
    branchName: string;
    branches: string[];
}

async function loadWorkspaceBranchSnapshot(workspacePath: string): Promise<WorkspaceBranchSnapshot> {
    const repoResult = await window.electron.git.isRepository(workspacePath);
    if (!repoResult.isRepository) {
        return { branchName: 'N/A', branches: [] };
    }

    const [branchResult, branchesResult] = await Promise.all([
        window.electron.git.getBranch(workspacePath),
        window.electron.git.getBranches(workspacePath),
    ]);

    return {
        branchName: branchResult.success ? (branchResult.branch ?? 'main') : 'main',
        branches: branchesResult.success ? (branchesResult.branches ?? []) : [],
    };
}

export function useWorkspaceBranchState({
    workspacePath,
    enabled = true, 
}: UseWorkspaceBranchStateOptions): {
    currentBranchName: string;
    availableBranches: string[];
    isBranchLoading: boolean;
    isBranchSwitching: boolean;
    handleBranchSelect: (branch: string) => Promise<void>;
} {
    const [currentBranchName, setCurrentBranchName] = useState('main');
    const [availableBranches, setAvailableBranches] = useState<string[]>([]);
    const [isBranchLoading, setIsBranchLoading] = useState(false);
    const [isBranchSwitching, setIsBranchSwitching] = useState(false);

    const refreshBranchState = useCallback(async () => {
        if (!enabled) {
            setIsBranchLoading(false);
            return;
        }
        if (!workspacePath) {
            setCurrentBranchName('main');
            setAvailableBranches([]);
            return;
        }

        setIsBranchLoading(true);
        try {
            const snapshot = await loadWorkspaceBranchSnapshot(workspacePath);
            setCurrentBranchName(snapshot.branchName);
            setAvailableBranches(snapshot.branches);
        } catch (error) {
            appLogger.error('useWorkspaceBranchState', 'Failed to load branch data', error as Error);



            setAvailableBranches([]);
        } finally {
            setIsBranchLoading(false);
        }
    }, [enabled, workspacePath]);

    const [prevEnabled, setPrevEnabled] = useState(enabled);
    if (enabled !== prevEnabled) {
        setPrevEnabled(enabled);
        if (!enabled) {
            setCurrentBranchName('main');
            setAvailableBranches([]);
            setIsBranchLoading(false);
        }
    }

    useEffect(() => {
        if (enabled) {
            queueMicrotask(() => {
                void refreshBranchState();
            });
        }
    }, [enabled, refreshBranchState]);

    const handleBranchSelect = useCallback(
        async (branch: string) => {
            if (!enabled) {
                return;
            }
            if (!workspacePath || branch === currentBranchName) {
                return;
            }

            setIsBranchSwitching(true);
            try {
                const result = await window.electron.git.checkout(workspacePath, branch);
                if (!result.success) {
                    return;
                }

                setCurrentBranchName(branch);
                await refreshBranchState();
            } catch (error) {
                appLogger.error('useWorkspaceBranchState', 'Failed to switch workspace branch', error as Error);
            } finally {
                setIsBranchSwitching(false);
            }
        },
        [currentBranchName, enabled, workspacePath, refreshBranchState]
    );

    return {
        currentBranchName,
        availableBranches,
        isBranchLoading,
        isBranchSwitching,
        handleBranchSelect,
    };
}

