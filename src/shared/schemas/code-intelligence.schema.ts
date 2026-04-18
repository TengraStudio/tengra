/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { z } from 'zod';

export const FileSearchResultSchema = z.object({
    file: z.string().max(4096),
    line: z.number().int().nonnegative(),
    text: z.string(),
    type: z.string().optional(),
    name: z.string().optional(),
});

export const SymbolAnalyticsSchema = z.object({
    totalSymbols: z.number().int().nonnegative(),
    uniqueFiles: z.number().int().nonnegative(),
    uniqueKinds: z.number().int().nonnegative(),
    byKind: z.record(z.string(), z.number().int().nonnegative()),
    byExtension: z.record(z.string(), z.number().int().nonnegative()),
    topFiles: z.array(z.object({
        path: z.string().max(4096),
        count: z.number().int().nonnegative(),
    })).max(20),
    topSymbols: z.array(z.object({
        name: z.string(),
        count: z.number().int().nonnegative(),
    })).max(20),
    generatedAt: z.string().datetime(),
});

export const RenameLineChangeSchema = z.object({
    line: z.number().int().positive(),
    occurrences: z.number().int().nonnegative(),
    before: z.string(),
    after: z.string(),
});

export const RenameFileChangeSchema = z.object({
    file: z.string().max(4096),
    replacements: z.array(RenameLineChangeSchema).max(2000),
});

export const RenameSymbolResultSchema = z.object({
    success: z.boolean(),
    applied: z.boolean(),
    symbol: z.string(),
    newSymbol: z.string(),
    totalFiles: z.number().int().nonnegative(),
    totalOccurrences: z.number().int().nonnegative(),
    changes: z.array(RenameFileChangeSchema).max(2000),
    updatedFiles: z.array(z.string().max(4096)).max(2000),
    errors: z.array(z.object({
        file: z.string().max(4096),
        error: z.string(),
    })).max(2000),
});

export const DocumentationPreviewResultSchema = z.object({
    success: z.boolean(),
    filePath: z.string().max(4096),
    format: z.enum(['markdown', 'jsdoc-comments']),
    content: z.string(),
    symbolCount: z.number().int().nonnegative(),
    generatedAt: z.string(),
    error: z.string().optional(),
});

export const CodeQualityAnalysisSchema = z.object({
    rootPath: z.string().max(4096),
    filesScanned: z.number().int().nonnegative(),
    totalLines: z.number().int().nonnegative(),
    functionSymbols: z.number().int().nonnegative(),
    classSymbols: z.number().int().nonnegative(),
    longLineCount: z.number().int().nonnegative(),
    todoLikeCount: z.number().int().nonnegative(),
    consoleUsageCount: z.number().int().nonnegative(),
    averageComplexity: z.number().nonnegative(),
    securityIssueCount: z.number().int().nonnegative(),
    topSecurityFindings: z.array(z.object({
        file: z.string().max(4096),
        line: z.number().int().positive(),
        rule: z.string(),
        snippet: z.string(),
    })).max(500),
    highestComplexityFiles: z.array(z.object({
        file: z.string().max(4096),
        complexity: z.number().nonnegative(),
    })).max(500),
    qualityScore: z.number().nonnegative(),
    generatedAt: z.string(),
});

export const WorkspaceDependencyGraphNodeSchema = z.object({
    path: z.string().max(4096),
    relativePath: z.string().max(4096),
    extension: z.string().max(32),
    symbolCount: z.number().int().nonnegative(),
    outboundDependencyCount: z.number().int().nonnegative(),
    inboundDependencyCount: z.number().int().nonnegative(),
    externalDependencyCount: z.number().int().nonnegative(),
});

export const WorkspaceDependencyGraphEdgeSchema = z.object({
    from: z.string().max(4096),
    to: z.string().max(4096),
    kind: z.enum(['workspace', 'package']),
    specifier: z.string().max(4096),
});

export const WorkspaceDependencyGraphSchema = z.object({
    rootPath: z.string().max(4096),
    indexedFileCount: z.number().int().nonnegative(),
    generatedAt: z.string(),
    nodes: z.array(WorkspaceDependencyGraphNodeSchema).max(5000),
    edges: z.array(WorkspaceDependencyGraphEdgeSchema).max(20_000),
    externalDependencies: z.array(z.string().max(256)).max(5000),
});

export const WorkspaceCodeMapSymbolSchema = z.object({
    name: z.string(),
    kind: z.string(),
    line: z.number().int().positive(),
    signature: z.string(),
});

export const WorkspaceCodeMapFileSchema = z.object({
    path: z.string().max(4096),
    relativePath: z.string().max(4096),
    extension: z.string().max(32),
    symbolCount: z.number().int().nonnegative(),
    topLevelSymbols: z.array(WorkspaceCodeMapSymbolSchema).max(50),
});

export const WorkspaceCodeMapFolderSchema = z.object({
    path: z.string().max(4096),
    fileCount: z.number().int().nonnegative(),
    symbolCount: z.number().int().nonnegative(),
});

export const WorkspaceCodeMapSchema = z.object({
    rootPath: z.string().max(4096),
    totalFiles: z.number().int().nonnegative(),
    totalSymbols: z.number().int().nonnegative(),
    generatedAt: z.string(),
    files: z.array(WorkspaceCodeMapFileSchema).max(5000),
    folders: z.array(WorkspaceCodeMapFolderSchema).max(2000),
});
