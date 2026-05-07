/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CODE_CHANNELS } from '@shared/constants/ipc-channels';
import {
    FileSearchResult,
    TodoItem,
    WorkspaceCodeMap,
    WorkspaceDependencyGraph,
} from '@shared/types';
import { IpcRenderer } from 'electron';

export interface CodeBridge {
    scanTodos: (rootPath: string) => Promise<TodoItem[]>;
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
}

export function createCodeBridge(ipc: IpcRenderer): CodeBridge {
    return {
        scanTodos: rootPath => ipc.invoke(CODE_CHANNELS.SCAN_TODOS, rootPath),
        findSymbols: (rootPath, query) => ipc.invoke(CODE_CHANNELS.FIND_SYMBOLS, rootPath, query),
        findDefinition: (rootPath, symbol) => ipc.invoke(CODE_CHANNELS.FIND_DEFINITION, rootPath, symbol),
        findReferences: (rootPath, symbol) => ipc.invoke(CODE_CHANNELS.FIND_REFERENCES, rootPath, symbol),
        findImplementations: (rootPath, symbol) =>
            ipc.invoke(CODE_CHANNELS.FIND_IMPLEMENTATIONS, rootPath, symbol),
        getSymbolRelationships: (rootPath, symbol, maxItems) =>
            ipc.invoke(CODE_CHANNELS.GET_SYMBOL_RELATIONSHIPS, rootPath, symbol, maxItems),
        getFileOutline: filePath => ipc.invoke(CODE_CHANNELS.GET_FILE_OUTLINE, filePath),
        previewRenameSymbol: (rootPath, symbol, newSymbol, maxFiles) =>
            ipc.invoke(CODE_CHANNELS.PREVIEW_RENAME_SYMBOL, rootPath, symbol, newSymbol, maxFiles),
        applyRenameSymbol: (rootPath, symbol, newSymbol, maxFiles) =>
            ipc.invoke(CODE_CHANNELS.APPLY_RENAME_SYMBOL, rootPath, symbol, newSymbol, maxFiles),
        generateFileDocumentation: (filePath, format) =>
            ipc.invoke(CODE_CHANNELS.GENERATE_FILE_DOCUMENTATION, filePath, format),
        generateWorkspaceDocumentation: (rootPath, maxFiles) =>
            ipc.invoke(CODE_CHANNELS.GENERATE_WORKSPACE_DOCUMENTATION, rootPath, maxFiles),
        analyzeQuality: (rootPath, maxFiles) => ipc.invoke(CODE_CHANNELS.ANALYZE_QUALITY, rootPath, maxFiles),
        searchFiles: (rootPath, query, workspaceId, isRegex) =>
            ipc.invoke(CODE_CHANNELS.SEARCH_FILES, rootPath, query, workspaceId, isRegex),
        indexWorkspace: (rootPath, workspaceId) => ipc.invoke(CODE_CHANNELS.INDEX_WORKSPACE, rootPath, workspaceId),
        queryIndexedSymbols: query => ipc.invoke(CODE_CHANNELS.QUERY_INDEXED_SYMBOLS, query),
        getSymbolAnalytics: rootPath => ipc.invoke(CODE_CHANNELS.GET_SYMBOL_ANALYTICS, rootPath),
        getWorkspaceDependencyGraph: rootPath => ipc.invoke(CODE_CHANNELS.GET_WORKSPACE_DEPENDENCY_GRAPH, rootPath),
        getWorkspaceCodeMap: rootPath => ipc.invoke(CODE_CHANNELS.GET_WORKSPACE_CODE_MAP, rootPath),
    };
}

