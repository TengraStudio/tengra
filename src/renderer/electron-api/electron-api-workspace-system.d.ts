/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionUsageStats,
} from '@shared/schemas/inline-suggestions.schema';

import type {
    FileEntry,
    ProcessInfo,
} from '@/electron.d';
import type {
    FileDiff,
    FileSearchResult,
    IpcValue,
    ServiceResponse,
    TodoFile,
    Workspace,
    WorkspaceAnalysis,
    WorkspaceCodeMap,
    WorkspaceDefinitionLocation,
    WorkspaceDependencyGraph,
    WorkspaceIssue,
    WorkspaceStats,
} from '@/shared/types';
import type {
    GitBlameLine,
    GitCommitDetails,
    GitConflict,
    GitFileHistoryItem,
    GitFlowStatus,
    GitHookInfo,
    GitHotspot,
    GitRebasePlanCommit,
    GitRefComparison,
    GitRepositoryStats,
    GitStash,
    GitSubmodule,
} from '@/shared/types/git';

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
        getWorkspaceDependencyGraph: (rootPath: string) => Promise<WorkspaceDependencyGraph | null>;
        getWorkspaceCodeMap: (rootPath: string) => Promise<WorkspaceCodeMap | null>;
    };

    // Workspace System
    workspace: {
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
        trackInlineSuggestionUsageStats: (
            event: InlineSuggestionUsageStats
        ) => Promise<{ success: boolean }>;
        improveLogoPrompt: (prompt: string) => Promise<string>;
        uploadLogo: (workspacePath: string) => Promise<string | null>;
        analyzeDirectory: (dirPath: string) => Promise<{
            hasPackageJson: boolean;
            pkg: Record<string, IpcValue>;
            stats: WorkspaceStats;
        }>;
        watch: (rootPath: string) => Promise<boolean>;
        unwatch: (rootPath: string) => Promise<boolean>;
        setActive: (rootPath: string | null) => Promise<{ rootPath: string | null }>;
        clearActive: (rootPath?: string) => Promise<{ rootPath: string | null }>;
        getEnv: (rootPath: string) => Promise<Record<string, string>>;
        saveEnv: (rootPath: string, vars: Record<string, string>) => Promise<{ success: boolean }>;
        onFileChange: (
            callback: (event: string, path: string, rootPath: string) => void
        ) => () => void;
        getFileDiff: (diffId: string) => Promise<{ oldValue: string; newValue: string }>;
        pullDiagnostics: (payload: {
            workspaceId: string;
            filePath: string;
            languageId: string;
        }) => Promise<WorkspaceIssue[] | null>;
        getCodeActions: (payload: {
            workspaceId: string;
            filePath: string;
            languageId: string;
            range: unknown;
            diagnostics: WorkspaceIssue[];
        }) => Promise<unknown[] | null>;
    };

    process: {
        spawn: (command: string, args: string[], cwd: string) => Promise<string>;
        kill: (id: string) => Promise<boolean>;
        list: () => Promise<ProcessInfo[]>;
        scanScripts: (rootPath: string) => Promise<Record<string, string>>;
        resize: (id: string, cols: number, rows: number) => Promise<void>;
        write: (id: string, data: string) => Promise<void>;
        onData: (callback: (data: { id: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => () => void;
        removeListeners: () => void;
    };

    files: {
        listDirectory: (path: string) => Promise<ServiceResponse<FileEntry[]>>;
        readFile: (path: string) => Promise<ServiceResponse<string>>;
        readImage: (
            path: string
        ) => Promise<{ success: boolean; content?: string; error?: string }>;
        writeFile: (
            path: string,
            content: string,
            context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
        ) => Promise<{ success: boolean; error?: string }>;
        exists: (path: string) => Promise<{ success: boolean; data: boolean; error?: string }>;
        createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
        deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
        deleteDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
        copyPath: (
            sourcePath: string,
            destinationPath: string
        ) => Promise<{ success: boolean; error?: string }>;
        renamePath: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
        searchFiles: (
            rootPath: string,
            pattern: string
        ) => Promise<{ success: boolean; results: string[]; error?: string }>;
        selectFile: (options?: {
            title?: string;
            filters?: Array<{ name: string; extensions: string[] }>;
        }) => Promise<{ success: boolean; path?: string; error?: string }>;
        revertFileChange: (diffId: string) => Promise<{ success: boolean; error?: string }>;
        getFileDiff: (diffId: string) => Promise<{ success: boolean; data?: FileDiff; error?: string }>;
    };

    // Proxy
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
            count?: number,
            skip?: number
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
            commits?: GitFileHistoryItem[];
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
        stageAll: (cwd: string) => Promise<{ success: boolean; error?: string }>;
        unstageFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
        unstageAll: (cwd: string) => Promise<{ success: boolean; error?: string }>;
        getDetailedStatus: (cwd: string) => Promise<{
            success: boolean;
            staged?: Array<{ path: string; status: string }>;
            unstaged?: Array<{ path: string; status: string }>;
            untracked?: Array<{ path: string; status: string }>;
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
        getCommitDiff: (cwd: string, hash: string) => Promise<{ diff: string; success: boolean; error?: string }>;
        getStagedDiff: (cwd: string) => Promise<{ diff: string; success: boolean; error?: string }>;

        getConflicts: (cwd: string) => Promise<{
            success: boolean;
            conflicts?: GitConflict[];
            analytics?: Record<string, number>;
            error?: string;
        }>;
        resolveConflict: (
            cwd: string,
            filePath: string,
            strategy: 'ours' | 'theirs' | 'manual'
        ) => Promise<{ success: boolean; error?: string }>;
        openMergeTool: (cwd: string, filePath?: string) => Promise<{ success: boolean; error?: string }>;
        getBlame: (cwd: string, filePath: string) => Promise<{ success: boolean; lines?: GitBlameLine[]; error?: string }>;
        getCommitDetails: (cwd: string, hash: string) => Promise<{ success: boolean; details?: GitCommitDetails; error?: string }>;
        getRebaseStatus: (cwd: string) => Promise<{
            success: boolean;
            inRebase?: boolean;
            currentBranch?: string;
            conflictCount?: number;
            conflicts?: GitConflict[];
            error?: string;
        }>;
        getStashes: (cwd: string) => Promise<{ success: boolean; stashes?: GitStash[]; error?: string }>;
        createStash: (cwd: string, message: string, includeUntracked?: boolean) => Promise<{ success: boolean; error?: string }>;
        applyStash: (cwd: string, stashRef: string, pop: boolean) => Promise<{ success: boolean; error?: string }>;
        dropStash: (cwd: string, stashRef: string) => Promise<{ success: boolean; error?: string }>;
        exportStash: (cwd: string, stashRef: string) => Promise<{ success: boolean; patch?: string; error?: string }>;
        runControlledOperation: (
            cwd: string,
            command: string,
            operationId: string,
            timeoutMs: number
        ) => Promise<{
            success: boolean;
            error?: string;
            stdout?: string;
            stderr?: string;
        }>;
        getRebasePlan: (cwd: string, ontoBranch: string) => Promise<{ success: boolean; plan?: GitRebasePlanCommit[]; error?: string }>;
        getSubmodules: (cwd: string) => Promise<{ success: boolean; submodules?: GitSubmodule[]; error?: string }>;
        cancelOperation: (operationId: string) => Promise<{ success: boolean; error?: string }>;
        getFlowStatus: (cwd: string) => Promise<{ success: boolean; flowStatus?: GitFlowStatus; error?: string }>;
        startFlowBranch: (
            cwd: string,
            branchType: string,
            branchName: string,
            baseBranch?: string
        ) => Promise<{ success: boolean; error?: string }>;
        finishFlowBranch: (
            cwd: string,
            branchName: string,
            targetBranch?: string,
            shouldDelete?: boolean
        ) => Promise<{ success: boolean; error?: string }>;
        getHooks: (cwd: string) => Promise<{ success: boolean; hooks?: GitHookInfo[]; templates?: string[]; error?: string }>;
        installHook: (cwd: string, hookName: string, templateName: string) => Promise<{ success: boolean; error?: string }>;
        validateHook: (cwd: string, hookName: string) => Promise<{
            success: boolean;
            validation?: { hookName: string; hasShebang: boolean; executable: boolean; valid: boolean };
            error?: string;
        }>;
        testHook: (cwd: string, hookName: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>;
        getRepositoryStats: (cwd: string, days?: number) => Promise<{ success: boolean; stats?: GitRepositoryStats; error?: string }>;
        exportRepositoryStats: (cwd: string, days?: number) => Promise<{ success: boolean; export?: { authorsCsv: string }; error?: string }>;
        createBranch: (cwd: string, name: string, startPoint?: string) => Promise<{ success: boolean; error?: string }>;
        deleteBranch: (cwd: string, name: string, force?: boolean) => Promise<{ success: boolean; error?: string }>;
        renameBranch: (cwd: string, oldName: string, newName: string) => Promise<{ success: boolean; error?: string }>;
        setUpstream: (cwd: string, branch: string, remote: string, upstreamBranch: string) => Promise<{ success: boolean; error?: string }>;
        generatePrSummary: (cwd: string, base: string, head: string) => Promise<{ success: boolean; summary?: string; error?: string }>;
        compareRefs: (cwd: string, base: string, head: string) => Promise<GitRefComparison>;
        getHotspots: (cwd: string, limit?: number, days?: number) => Promise<{ success: boolean; hotspots: GitHotspot[]; error?: string }>;
        getGitHubData: (repoUrl: string, type: 'pulls' | 'issues') => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        getGitHubPrDetails: (repoUrl: string, prNumber: number) => Promise<{ success: boolean; data?: { pr: unknown; files: unknown[]; comments: unknown[]; reviews: unknown[]; checks: unknown[] }; error?: string }>;
        updateGitHubPrState: (repoUrl: string, prNumber: number, state: 'open' | 'closed') => Promise<{ success: boolean; data?: unknown; error?: string }>;
        mergeGitHubPr: (repoUrl: string, prNumber: number) => Promise<{ success: boolean; data?: unknown; error?: string }>;
        approveGitHubPr: (repoUrl: string, prNumber: number) => Promise<{ success: boolean; data?: unknown; error?: string }>;
        getTreeStatusPreview: (cwd: string, directoryPath: string) => Promise<unknown>;
    };

    // LLM chat
    clipboard: {
        writeText: (text: string) => Promise<{ success: boolean }>;
        readText: () => Promise<{ success: boolean; text: string }>;
    };
    // Database
}

