import { FileSearchResult, TodoItem } from '@shared/types';
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
}

export function createCodeBridge(ipc: IpcRenderer): CodeBridge {
    return {
        scanTodos: rootPath => ipc.invoke('code:scanTodos', rootPath),
        findSymbols: (rootPath, query) => ipc.invoke('code:findSymbols', rootPath, query),
        findDefinition: (rootPath, symbol) => ipc.invoke('code:findDefinition', rootPath, symbol),
        findReferences: (rootPath, symbol) => ipc.invoke('code:findReferences', rootPath, symbol),
        findImplementations: (rootPath, symbol) =>
            ipc.invoke('code:findImplementations', rootPath, symbol),
        getSymbolRelationships: (rootPath, symbol, maxItems) =>
            ipc.invoke('code:getSymbolRelationships', rootPath, symbol, maxItems),
        getFileOutline: filePath => ipc.invoke('code:getFileOutline', filePath),
        previewRenameSymbol: (rootPath, symbol, newSymbol, maxFiles) =>
            ipc.invoke('code:previewRenameSymbol', rootPath, symbol, newSymbol, maxFiles),
        applyRenameSymbol: (rootPath, symbol, newSymbol, maxFiles) =>
            ipc.invoke('code:applyRenameSymbol', rootPath, symbol, newSymbol, maxFiles),
        generateFileDocumentation: (filePath, format) =>
            ipc.invoke('code:generateFileDocumentation', filePath, format),
        generateWorkspaceDocumentation: (rootPath, maxFiles) =>
            ipc.invoke('code:generateWorkspaceDocumentation', rootPath, maxFiles),
        analyzeQuality: (rootPath, maxFiles) => ipc.invoke('code:analyzeQuality', rootPath, maxFiles),
        searchFiles: (rootPath, query, workspaceId, isRegex) =>
            ipc.invoke('code:searchFiles', rootPath, query, workspaceId, isRegex),
        indexWorkspace: (rootPath, workspaceId) => ipc.invoke('code:indexWorkspace', rootPath, workspaceId),
        queryIndexedSymbols: query => ipc.invoke('code:queryIndexedSymbols', query),
        getSymbolAnalytics: rootPath => ipc.invoke('code:getSymbolAnalytics', rootPath),
    };
}
