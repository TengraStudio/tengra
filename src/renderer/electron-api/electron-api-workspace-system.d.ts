import type {
    FileEntry,
    ProcessInfo,
} from '@renderer/electron.d';
import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionTelemetry,
} from '@shared/schemas/inline-suggestions.schema';

import type {
    FileSearchResult,
    IpcValue,
    TodoFile,
    Workspace,
    WorkspaceAnalysis,
} from '@/shared/types';

export interface ElectronApiWorkspaceSystemDomain {
    code: {
        scanTodos: (rootPath: string) => Promise<TodoFile[]>;
        findSymbols: (rootPath: string, query: string) => Promise<FileSearchResult[]>;
        findDefinition: (rootPath: string, symbol: string) => Promise<FileSearchResult | null>;
        findReferences: (rootPath: string, symbol: string) => Promise<FileSearchResult[]>;
        findImplementations: (rootPath: string, symbol: string) => Promise<FileSearchResult[]>;
        getSymbolRelationships: (
            rootPath: string,
            symbol: string,
            maxItems?: number
        ) => Promise<FileSearchResult[]>;
        getFileOutline: (filePath: string) => Promise<FileSearchResult[]>;
        previewRenameSymbol: (
            rootPath: string,
            symbol: string,
            newSymbol: string,
            maxFiles?: number
        ) => Promise<{
            success: boolean;
            applied: boolean;
            symbol: string;
            newSymbol: string;
            totalFiles: number;
            totalOccurrences: number;
            changes: Array<{
                file: string;
                replacements: Array<{ line: number; occurrences: number; before: string; after: string }>;
            }>;
            updatedFiles: string[];
            errors: Array<{ file: string; error: string }>;
        }>;
        applyRenameSymbol: (
            rootPath: string,
            symbol: string,
            newSymbol: string,
            maxFiles?: number
        ) => Promise<{
            success: boolean;
            applied: boolean;
            symbol: string;
            newSymbol: string;
            totalFiles: number;
            totalOccurrences: number;
            changes: Array<{
                file: string;
                replacements: Array<{ line: number; occurrences: number; before: string; after: string }>;
            }>;
            updatedFiles: string[];
            errors: Array<{ file: string; error: string }>;
        }>;
        generateFileDocumentation: (
            filePath: string,
            format?: 'markdown' | 'jsdoc-comments'
        ) => Promise<{
            success: boolean;
            filePath: string;
            format: 'markdown' | 'jsdoc-comments';
            content: string;
            symbolCount: number;
            generatedAt: string;
            error?: string;
        }>;
        generateWorkspaceDocumentation: (
            rootPath: string,
            maxFiles?: number
        ) => Promise<{
            success: boolean;
            filePath: string;
            format: 'markdown' | 'jsdoc-comments';
            content: string;
            symbolCount: number;
            generatedAt: string;
            error?: string;
        }>;
        analyzeQuality: (rootPath: string, maxFiles?: number) => Promise<{
            rootPath: string;
            filesScanned: number;
            totalLines: number;
            functionSymbols: number;
            classSymbols: number;
            longLineCount: number;
            todoLikeCount: number;
            consoleUsageCount: number;
            averageComplexity: number;
            securityIssueCount: number;
            topSecurityFindings: Array<{ file: string; line: number; rule: string; snippet: string }>;
            highestComplexityFiles: Array<{ file: string; complexity: number }>;
            qualityScore: number;
            generatedAt: string;
        }>;
        searchFiles: (
            rootPath: string,
            query: string,
            workspaceId?: string,
            isRegex?: boolean
        ) => Promise<FileSearchResult[]>;
        indexWorkspace: (rootPath: string, workspaceId: string) => Promise<void>;
        queryIndexedSymbols: (
            query: string
        ) => Promise<{ name: string; path: string; line: number }[]>;
        getSymbolAnalytics: (rootPath: string) => Promise<{
            totalSymbols: number;
            uniqueFiles: number;
            uniqueKinds: number;
            byKind: Record<string, number>;
            byExtension: Record<string, number>;
            topFiles: Array<{ path: string; count: number }>;
            topSymbols: Array<{ name: string; count: number }>;
            generatedAt: string;
        }>;
    };

    // Workspace System
    workspace: {
        analyze: (rootPath: string, workspaceId: string) => Promise<WorkspaceAnalysis>;
        generateLogo: (
            workspacePath: string,
            options: { prompt: string; style: string; model: string; count: number }
        ) => Promise<string[]>;
        analyzeIdentity: (
            workspacePath: string
        ) => Promise<{ suggestedPrompts: string[]; colors: string[] }>;
        applyLogo: (workspacePath: string, tempLogoPath: string) => Promise<string>;
        getCompletion: (text: string) => Promise<string>;
        getInlineSuggestion: (request: InlineSuggestionRequest) => Promise<InlineSuggestionResponse>;
        trackInlineSuggestionTelemetry: (
            event: InlineSuggestionTelemetry
        ) => Promise<{ success: boolean }>;
        improveLogoPrompt: (prompt: string) => Promise<string>;
        uploadLogo: (workspacePath: string) => Promise<string | null>;
        analyzeDirectory: (dirPath: string) => Promise<{
            hasPackageJson: boolean;
            pkg: Record<string, IpcValue>;
            readme: string | null;
            stats: { fileCount: number; totalSize: number };
        }>;
        watch: (rootPath: string) => Promise<boolean>;
        unwatch: (rootPath: string) => Promise<boolean>;
        getEnv: (rootPath: string) => Promise<Record<string, string>>;
        saveEnv: (rootPath: string, vars: Record<string, string>) => Promise<{ success: boolean }>;
        onFileChange: (
            callback: (event: string, path: string, rootPath: string) => void
        ) => () => void;
    };

    // Workspace System
    workspace: {
        analyze: (rootPath: string, workspaceId: string) => Promise<WorkspaceAnalysis>;
        generateLogo: (
            workspacePath: string,
            options: { prompt: string; style: string; model: string; count: number }
        ) => Promise<string[]>;
        analyzeIdentity: (
            workspacePath: string
        ) => Promise<{ suggestedPrompts: string[]; colors: string[] }>;
        applyLogo: (workspacePath: string, tempLogoPath: string) => Promise<string>;
        getCompletion: (text: string) => Promise<string>;
        getInlineSuggestion: (request: InlineSuggestionRequest) => Promise<InlineSuggestionResponse>;
        trackInlineSuggestionTelemetry: (
            event: InlineSuggestionTelemetry
        ) => Promise<{ success: boolean }>;
        improveLogoPrompt: (prompt: string) => Promise<string>;
        uploadLogo: (workspacePath: string) => Promise<string | null>;
        analyzeDirectory: (dirPath: string) => Promise<{
            hasPackageJson: boolean;
            pkg: Record<string, IpcValue>;
            readme: string | null;
            stats: { fileCount: number; totalSize: number };
        }>;
        watch: (rootPath: string) => Promise<boolean>;
        unwatch: (rootPath: string) => Promise<boolean>;
        getEnv: (rootPath: string) => Promise<Record<string, string>>;
        saveEnv: (rootPath: string, vars: Record<string, string>) => Promise<{ success: boolean }>;
        onFileChange: (
            callback: (event: string, path: string, rootPath: string) => void
        ) => () => void;
    };

    process: {
        spawn: (command: string, args: string[], cwd: string) => Promise<string>;
        kill: (id: string) => Promise<boolean>;
        list: () => Promise<ProcessInfo[]>;
        scanScripts: (rootPath: string) => Promise<Record<string, string>>;
        resize: (id: string, cols: number, rows: number) => Promise<void>;
        write: (id: string, data: string) => Promise<void>;
        onData: (callback: (data: { id: string; data: string }) => void) => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => void;
        removeListeners: () => void;
    };

    files: {
        listDirectory: (path: string) => Promise<FileEntry[]>;
        readFile: (path: string) => Promise<string>;
        readImage: (
            path: string
        ) => Promise<{ success: boolean; content?: string; error?: string }>;
        writeFile: (path: string, content: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
    };

    // Proxy
    performance: {
        getMemoryStats: () => Promise<IpcValue>;
        detectLeak: () => Promise<IpcValue>;
        triggerGC: () => Promise<IpcValue>;
        getDashboard: () => Promise<IpcValue>;
    };
    git: {
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
        getBranches: (
            cwd: string
        ) => Promise<{ success: boolean; branches?: string[]; error?: string }>;
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
        unstageFile: (
            cwd: string,
            filePath: string
        ) => Promise<{ success: boolean; error?: string }>;
        getDetailedStatus: (cwd: string) => Promise<{
            success: boolean;
            stagedFiles?: Array<{ status: string; path: string; staged: boolean }>;
            unstagedFiles?: Array<{ status: string; path: string; staged: boolean }>;
            allFiles?: Array<{ status: string; path: string; staged: boolean }>;
            error?: string;
        }>;
        checkout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>;
        commit: (cwd: string, message: string) => Promise<{ success: boolean; error?: string }>;
        push: (
            cwd: string,
            remote?: string,
            branch?: string
        ) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
        pull: (
            cwd: string
        ) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
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
        getCommitDiff: (
            cwd: string,
            hash: string
        ) => Promise<{ diff: string; success: boolean; error?: string }>;
    };

    // LLM chat
    clipboard: {
        writeText: (text: string) => Promise<{ success: boolean }>;
        readText: () => Promise<{ success: boolean; text: string }>;
    };
    // Database
}