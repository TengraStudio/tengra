import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
} from '@shared/schemas/inline-suggestions.schema';
import { IpcValue, ProjectAnalysis } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface ProjectBridge {
    analyze: (rootPath: string, projectId: string) => Promise<ProjectAnalysis>;
    analyzeIdentity: (
        rootPath: string
    ) => Promise<{ suggestedPrompts: string[]; colors: string[] }>;
    generateLogo: (
        projectPath: string,
        options: { prompt: string; style: string; model: string; count: number }
    ) => Promise<string[]>;
    analyzeDirectory: (dirPath: string) => Promise<{
        hasPackageJson: boolean;
        pkg: Record<string, IpcValue>;
        readme: string | null;
        stats: { fileCount: number; totalSize: number };
    }>;
    applyLogo: (projectPath: string, tempLogoPath: string) => Promise<string>;
    getCompletion: (text: string) => Promise<string>;
    getInlineSuggestion: (request: InlineSuggestionRequest) => Promise<InlineSuggestionResponse>;
    improveLogoPrompt: (prompt: string) => Promise<string>;
    uploadLogo: (projectPath: string) => Promise<string | null>;
    watch: (rootPath: string) => Promise<boolean>;
    unwatch: (rootPath: string) => Promise<boolean>;
    getEnv: (rootPath: string) => Promise<Record<string, string>>;
    saveEnv: (rootPath: string, vars: Record<string, string>) => Promise<{ success: boolean }>;
    onFileChange: (
        callback: (event: string, path: string, rootPath: string) => void
    ) => () => void;
}

interface WrappedProjectResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
    };
}

function isWrappedProjectResponse<T>(value: T | WrappedProjectResponse<T>): value is WrappedProjectResponse<T> {
    return typeof value === 'object' && value !== null && 'success' in value;
}

function unwrapProjectResponse<T>(value: T | WrappedProjectResponse<T>): T {
    if (!isWrappedProjectResponse(value)) {
        return value;
    }

    if (value.success && value.data !== undefined) {
        return value.data;
    }

    if (value.success) {
        throw new Error('Project IPC request completed without data');
    }

    throw new Error(value.error?.message ?? 'Project IPC request failed');
}

export function createProjectBridge(ipc: IpcRenderer): ProjectBridge {
    return {
        analyze: (rootPath, projectId) =>
            ipc.invoke('project:analyze', rootPath, projectId).then(unwrapProjectResponse),
        analyzeIdentity: rootPath =>
            ipc.invoke('project:analyzeIdentity', rootPath).then(unwrapProjectResponse),
        generateLogo: (projectPath, options) =>
            ipc.invoke('project:generateLogo', projectPath, options).then(unwrapProjectResponse),
        analyzeDirectory: dirPath =>
            ipc.invoke('project:analyzeDirectory', dirPath).then(unwrapProjectResponse),
        applyLogo: (projectPath, tempLogoPath) =>
            ipc.invoke('project:applyLogo', projectPath, tempLogoPath).then(unwrapProjectResponse),
        getCompletion: text => ipc.invoke('project:getCompletion', text).then(unwrapProjectResponse),
        getInlineSuggestion: request =>
            ipc.invoke('project:getInlineSuggestion', request).then(unwrapProjectResponse),
        improveLogoPrompt: prompt =>
            ipc.invoke('project:improveLogoPrompt', prompt).then(unwrapProjectResponse),
        uploadLogo: projectPath => ipc.invoke('project:uploadLogo', projectPath).then(unwrapProjectResponse),
        watch: rootPath => ipc.invoke('project:watch', rootPath).then(unwrapProjectResponse),
        unwatch: rootPath => ipc.invoke('project:unwatch', rootPath).then(unwrapProjectResponse),
        getEnv: rootPath => ipc.invoke('project:getEnv', rootPath).then(unwrapProjectResponse),
        saveEnv: (rootPath, vars) => ipc.invoke('project:saveEnv', rootPath, vars).then(unwrapProjectResponse),
        onFileChange: callback => {
            const listener = (_event: IpcRendererEvent, event: string, path: string, rootPath: string) =>
                callback(event, path, rootPath);
            ipc.on('project:file-change', listener);
            return () => ipc.removeListener('project:file-change', listener);
        },
    };
}
