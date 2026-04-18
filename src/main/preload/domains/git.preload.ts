/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IpcRenderer } from 'electron';

export interface GitBridge {
    getBranch: (cwd: string) => Promise<{ success: boolean; branch?: string; error?: string }>;
    getStatus: (cwd: string) => Promise<{
        success: boolean;
        isClean?: boolean;
        changes?: number;
        files?: Array<{ path: string; status: string }>;
        error?: string;
    }>;
    getLastCommit: (cwd: string) => Promise<{
        success: boolean;
        hash?: string;
        message?: string;
        author?: string;
        relativeTime?: string;
        date?: string;
        error?: string;
    }>;
    getRecentCommits: (
        cwd: string,
        count?: number
    ) => Promise<{
        success: boolean;
        commits?: Array<{ hash: string; message: string; author: string; date: string }>;
        error?: string;
    }>;
    getFileHistory: (
        cwd: string,
        filePath: string,
        count?: number
    ) => Promise<{
        success: boolean;
        commits?: Array<{
            hash: string;
            message: string;
            author: string;
            relativeTime: string;
            date: string;
        }>;
        error?: string;
    }>;
    getBranches: (cwd: string) => Promise<{ success: boolean; branches?: string[]; error?: string }>;
    isRepository: (cwd: string) => Promise<{ success: boolean; isRepository?: boolean }>;
    getFileDiff: (
        cwd: string,
        filePath: string,
        staged?: boolean
    ) => Promise<{ original: string; modified: string; success: boolean; error?: string }>;
    getUnifiedDiff: (
        cwd: string,
        filePath: string,
        staged?: boolean
    ) => Promise<{ diff: string; success: boolean; error?: string }>;
    stageFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
    unstageFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
    getDetailedStatus: (cwd: string) => Promise<{
        success: boolean;
        staged?: Array<{ path: string; status: string }>;
        unstaged?: Array<{ path: string; status: string }>;
        error?: string;
    }>;
    checkout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>;
    commit: (cwd: string, message: string) => Promise<{ success: boolean; error?: string }>;
    push: (
        cwd: string,
        remote?: string,
        branch?: string
    ) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
    pull: (cwd: string) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
    getRemotes: (cwd: string) => Promise<{
        success: boolean;
        remotes?: Array<{ name: string; url: string; fetch: boolean; push: boolean }>;
        error?: string;
    }>;
    getTrackingInfo: (cwd: string) => Promise<{
        success: boolean;
        tracking?: string | null;
        ahead?: number;
        behind?: number;
    }>;
    getCommitStats: (
        cwd: string,
        days?: number
    ) => Promise<{ success: boolean; commitCounts?: Record<string, number>; error?: string }>;
    getDiffStats: (cwd: string) => Promise<{
        success: boolean;
        staged?: { added: number; deleted: number; files: number };
        unstaged?: { added: number; deleted: number; files: number };
        total?: { added: number; deleted: number; files: number };
        error?: string;
    }>;
}

export function createGitBridge(ipc: IpcRenderer): GitBridge {
    return {
        getBranch: cwd => ipc.invoke('git:getBranch', cwd),
        getStatus: cwd => ipc.invoke('git:getStatus', cwd),
        getLastCommit: cwd => ipc.invoke('git:getLastCommit', cwd),
        getRecentCommits: (cwd, count) => ipc.invoke('git:getRecentCommits', cwd, count),
        getFileHistory: (cwd, filePath, count) =>
            ipc.invoke('git:getFileHistory', cwd, filePath, count),
        getBranches: cwd => ipc.invoke('git:getBranches', cwd),
        isRepository: cwd => ipc.invoke('git:isRepository', cwd),
        getFileDiff: (cwd, filePath, staged) => ipc.invoke('git:getFileDiff', cwd, filePath, staged),
        getUnifiedDiff: (cwd, filePath, staged) => ipc.invoke('git:getUnifiedDiff', cwd, filePath, staged),
        stageFile: (cwd, filePath) => ipc.invoke('git:stageFile', cwd, filePath),
        unstageFile: (cwd, filePath) => ipc.invoke('git:unstageFile', cwd, filePath),
        getDetailedStatus: cwd => ipc.invoke('git:getDetailedStatus', cwd),
        checkout: (cwd, branch) => ipc.invoke('git:checkout', cwd, branch),
        commit: (cwd, message) => ipc.invoke('git:commit', cwd, message),
        push: (cwd, remote, branch) => ipc.invoke('git:push', cwd, remote, branch),
        pull: cwd => ipc.invoke('git:pull', cwd),
        getRemotes: cwd => ipc.invoke('git:getRemotes', cwd),
        getTrackingInfo: cwd => ipc.invoke('git:getTrackingInfo', cwd),
        getCommitStats: (cwd, days) => ipc.invoke('git:getCommitStats', cwd, days),
        getDiffStats: cwd => ipc.invoke('git:getDiffStats', cwd),
    };
}
