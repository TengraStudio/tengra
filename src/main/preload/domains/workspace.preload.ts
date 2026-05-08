/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FILES_CHANNELS, WORKSPACE_CHANNELS } from '@shared/constants/ipc-channels';
import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionUsageStats,
} from '@shared/schemas/inline-suggestions.schema';
import { IpcValue, WorkspaceAnalysis, WorkspaceDefinitionLocation, WorkspaceIssue, WorkspaceStats } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface WorkspaceBridge {
    analyze: (rootPath: string, workspaceId: string) => Promise<WorkspaceAnalysis>;
    analyzeSummary: (rootPath: string, workspaceId?: string) => Promise<WorkspaceAnalysis>;
    getFileDiagnostics: (rootPath: string, filePath: string, content: string) => Promise<WorkspaceIssue[]>;
    getFileDefinition: (
        rootPath: string,
        filePath: string,
        content: string,
        line: number,
        column: number
    ) => Promise<WorkspaceDefinitionLocation[]>;
    analyzeIdentity: (
        rootPath: string
    ) => Promise<{ suggestedPrompts: string[]; colors: string[] }>;
    generateLogo: (
        workspacePath: string,
        options: { prompt: string; style: string; model: string; count: number }
    ) => Promise<string[]>;
    analyzeDirectory: (dirPath: string) => Promise<{
        hasPackageJson: boolean;
        pkg: Record<string, IpcValue>;
        stats: WorkspaceStats;
    }>;
    applyLogo: (workspacePath: string, tempLogoPath: string) => Promise<string>;
    getCompletion: (text: string) => Promise<string>;
    getInlineSuggestion: (request: InlineSuggestionRequest) => Promise<InlineSuggestionResponse>;
    trackInlineSuggestionUsageStats: (
        event: InlineSuggestionUsageStats
    ) => Promise<{ success: boolean }>;
    improveLogoPrompt: (prompt: string) => Promise<string>;
    uploadLogo: (workspacePath: string) => Promise<string | null>;
    watch: (rootPath: string) => Promise<boolean>;
    unwatch: (rootPath: string) => Promise<boolean>;
    setActive: (rootPath: string | null) => Promise<{ rootPath: string | null }>;
    clearActive: (rootPath?: string) => Promise<{ rootPath: string | null }>;
    getEnv: (rootPath: string) => Promise<Record<string, string>>;
    saveEnv: (rootPath: string, vars: Record<string, string>) => Promise<{ success: boolean }>;
    getFileDiff: (diffId: string) => Promise<{ oldValue: string; newValue: string }>;
    onFileChange: (
        callback: (event: string, path: string, rootPath: string) => void
    ) => () => void;
    pullDiagnostics: (payload: { workspaceId: string; filePath: string; languageId: string }) => Promise<unknown[] | null>;
    getCodeActions: (payload: {
        workspaceId: string;
        filePath: string;
        languageId: string;
        range: unknown;
        diagnostics: unknown[];
    }) => Promise<unknown[] | null>;
}

interface WrappedWorkspaceResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
    };
}

function isWrappedWorkspaceResponse<T>(
    value: T | WrappedWorkspaceResponse<T> | null | undefined
): value is WrappedWorkspaceResponse<T> {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as Partial<WrappedWorkspaceResponse<T>>;
    return typeof candidate.success === 'boolean';
}

function unwrapWorkspaceResponse<T>(
    value: T | WrappedWorkspaceResponse<T> | null | undefined
): T {
    if (value === undefined) {
        throw new Error('Workspace IPC request returned no response');
    }
    if (value === null) {
        throw new Error('Workspace IPC request returned null response');
    }
    if (!isWrappedWorkspaceResponse(value)) {
        return value;
    }

    if (value.success && value.data !== undefined) {
        return value.data;
    }

    if (value.success) {
        throw new Error('Workspace IPC request completed without data');
    }

    const message =
        value.error && typeof value.error.message === 'string'
            ? value.error.message
            : 'Workspace IPC request failed';
    throw new Error(message);
}

export function createWorkspaceBridge(ipc: IpcRenderer): WorkspaceBridge {
    return {
        analyze: (rootPath, workspaceId) =>
            ipc.invoke(WORKSPACE_CHANNELS.ANALYZE, rootPath, workspaceId).then(unwrapWorkspaceResponse),
        analyzeSummary: (rootPath, workspaceId) =>
            ipc.invoke(WORKSPACE_CHANNELS.ANALYZE_SUMMARY, rootPath, workspaceId).then(unwrapWorkspaceResponse),
        getFileDiagnostics: (rootPath, filePath, content) =>
            ipc.invoke(WORKSPACE_CHANNELS.GET_FILE_DIAGNOSTICS, rootPath, filePath, content).then(unwrapWorkspaceResponse),
        getFileDefinition: (rootPath, filePath, content, line, column) =>
            ipc.invoke(
                WORKSPACE_CHANNELS.GET_FILE_DEFINITION,
                rootPath,
                filePath,
                content,
                { line, column }
            ).then(unwrapWorkspaceResponse),
        analyzeIdentity: rootPath =>
            ipc.invoke(WORKSPACE_CHANNELS.ANALYZE_IDENTITY, rootPath).then(unwrapWorkspaceResponse),
        generateLogo: (workspacePath, options) =>
            ipc.invoke(WORKSPACE_CHANNELS.GENERATE_LOGO, workspacePath, options).then(unwrapWorkspaceResponse),
        analyzeDirectory: dirPath =>
            ipc.invoke(WORKSPACE_CHANNELS.ANALYZE_DIRECTORY, dirPath).then(unwrapWorkspaceResponse),
        applyLogo: (workspacePath, tempLogoPath) =>
            ipc.invoke(WORKSPACE_CHANNELS.APPLY_LOGO, workspacePath, tempLogoPath).then(unwrapWorkspaceResponse),
        getCompletion: text => ipc.invoke(WORKSPACE_CHANNELS.GET_COMPLETION, text).then(unwrapWorkspaceResponse),
        getInlineSuggestion: request =>
            ipc.invoke(WORKSPACE_CHANNELS.GET_INLINE_SUGGESTION, request).then(unwrapWorkspaceResponse),
        trackInlineSuggestionUsageStats: event =>
            ipc.invoke(WORKSPACE_CHANNELS.TRACK_INLINE_SUGGESTION_usageStats, event).then(unwrapWorkspaceResponse),
        improveLogoPrompt: prompt =>
            ipc.invoke(WORKSPACE_CHANNELS.IMPROVE_LOGO_PROMPT, prompt).then(unwrapWorkspaceResponse),
        uploadLogo: workspacePath => ipc.invoke(WORKSPACE_CHANNELS.UPLOAD_LOGO, workspacePath).then(unwrapWorkspaceResponse),
        watch: rootPath => ipc.invoke(WORKSPACE_CHANNELS.WATCH, rootPath).then(unwrapWorkspaceResponse),
        unwatch: rootPath => ipc.invoke(WORKSPACE_CHANNELS.UNWATCH, rootPath).then(unwrapWorkspaceResponse),
        setActive: rootPath => ipc.invoke(WORKSPACE_CHANNELS.SET_ACTIVE, rootPath).then(unwrapWorkspaceResponse),
        clearActive: rootPath => ipc.invoke(WORKSPACE_CHANNELS.CLEAR_ACTIVE, rootPath).then(unwrapWorkspaceResponse),
        getEnv: rootPath => ipc.invoke(WORKSPACE_CHANNELS.GET_ENV, rootPath).then(unwrapWorkspaceResponse),
        saveEnv: (rootPath, vars) => ipc.invoke(WORKSPACE_CHANNELS.SAVE_ENV, rootPath, vars).then(unwrapWorkspaceResponse),
        getFileDiff: diffId => ipc.invoke(FILES_CHANNELS.GET_FILE_DIFF, diffId).then(unwrapWorkspaceResponse),
        onFileChange: callback => {
            const listener = (_event: IpcRendererEvent, data: { event: string; path: string; rootPath: string }[] | { event: string; path: string; rootPath: string }) => {
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    callback(item.event, item.path, item.rootPath);
                }
            };
            ipc.on(WORKSPACE_CHANNELS.FILE_CHANGE_EVENT, listener);
            return () => ipc.removeListener(WORKSPACE_CHANNELS.FILE_CHANGE_EVENT, listener);
        },
        pullDiagnostics: payload =>
            ipc.invoke(WORKSPACE_CHANNELS.PULL_DIAGNOSTICS, payload).then(unwrapWorkspaceResponse),
        getCodeActions: payload =>
            ipc.invoke(WORKSPACE_CHANNELS.GET_CODE_ACTIONS, payload).then(unwrapWorkspaceResponse),
    };
}

