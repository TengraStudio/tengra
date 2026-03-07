import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionTelemetry,
} from '@shared/schemas/inline-suggestions.schema';
import { IpcValue, WorkspaceAnalysis } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface WorkspaceBridge {
    analyze: (rootPath: string, workspaceId: string) => Promise<WorkspaceAnalysis>;
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
        readme: string | null;
        stats: { fileCount: number; totalSize: number };
    }>;
    applyLogo: (workspacePath: string, tempLogoPath: string) => Promise<string>;
    getCompletion: (text: string) => Promise<string>;
    getInlineSuggestion: (request: InlineSuggestionRequest) => Promise<InlineSuggestionResponse>;
    trackInlineSuggestionTelemetry: (
        event: InlineSuggestionTelemetry
    ) => Promise<{ success: boolean }>;
    improveLogoPrompt: (prompt: string) => Promise<string>;
    uploadLogo: (workspacePath: string) => Promise<string | null>;
    watch: (rootPath: string) => Promise<boolean>;
    unwatch: (rootPath: string) => Promise<boolean>;
    getEnv: (rootPath: string) => Promise<Record<string, string>>;
    saveEnv: (rootPath: string, vars: Record<string, string>) => Promise<{ success: boolean }>;
    onFileChange: (
        callback: (event: string, path: string, rootPath: string) => void
    ) => () => void;
}

interface WrappedWorkspaceResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
    };
}

function isWrappedWorkspaceResponse<T>(value: T | WrappedWorkspaceResponse<T>): value is WrappedWorkspaceResponse<T> {
    return typeof value === 'object' && value !== null && 'success' in value;
}

function unwrapWorkspaceResponse<T>(value: T | WrappedWorkspaceResponse<T>): T {
    if (!isWrappedWorkspaceResponse(value)) {
        return value;
    }

    if (value.success && value.data !== undefined) {
        return value.data;
    }

    if (value.success) {
        throw new Error('Workspace IPC request completed without data');
    }

    throw new Error(value.error?.message ?? 'Workspace IPC request failed');
}

export function createWorkspaceBridge(ipc: IpcRenderer): WorkspaceBridge {
    return {
        analyze: (rootPath, workspaceId) =>
            ipc.invoke('workspace:analyze', rootPath, workspaceId).then(unwrapWorkspaceResponse),
        analyzeIdentity: rootPath =>
            ipc.invoke('workspace:analyzeIdentity', rootPath).then(unwrapWorkspaceResponse),
        generateLogo: (workspacePath, options) =>
            ipc.invoke('workspace:generateLogo', workspacePath, options).then(unwrapWorkspaceResponse),
        analyzeDirectory: dirPath =>
            ipc.invoke('workspace:analyzeDirectory', dirPath).then(unwrapWorkspaceResponse),
        applyLogo: (workspacePath, tempLogoPath) =>
            ipc.invoke('workspace:applyLogo', workspacePath, tempLogoPath).then(unwrapWorkspaceResponse),
        getCompletion: text => ipc.invoke('workspace:getCompletion', text).then(unwrapWorkspaceResponse),
        getInlineSuggestion: request =>
            ipc.invoke('workspace:getInlineSuggestion', request).then(unwrapWorkspaceResponse),
        trackInlineSuggestionTelemetry: event =>
            ipc.invoke('workspace:trackInlineSuggestionTelemetry', event).then(unwrapWorkspaceResponse),
        improveLogoPrompt: prompt =>
            ipc.invoke('workspace:improveLogoPrompt', prompt).then(unwrapWorkspaceResponse),
        uploadLogo: workspacePath => ipc.invoke('workspace:uploadLogo', workspacePath).then(unwrapWorkspaceResponse),
        watch: rootPath => ipc.invoke('workspace:watch', rootPath).then(unwrapWorkspaceResponse),
        unwatch: rootPath => ipc.invoke('workspace:unwatch', rootPath).then(unwrapWorkspaceResponse),
        getEnv: rootPath => ipc.invoke('workspace:getEnv', rootPath).then(unwrapWorkspaceResponse),
        saveEnv: (rootPath, vars) => ipc.invoke('workspace:saveEnv', rootPath, vars).then(unwrapWorkspaceResponse),
        onFileChange: callback => {
            const listener = (_event: IpcRendererEvent, event: string, path: string, rootPath: string) =>
                callback(event, path, rootPath);
            ipc.on('workspace:file-change', listener);
            return () => ipc.removeListener('workspace:file-change', listener);
        },
    };
}

/** @deprecated Use WorkspaceBridge instead */
export type ProjectBridge = WorkspaceBridge;
/** @deprecated Use createWorkspaceBridge instead */
export const createProjectBridge = createWorkspaceBridge;
