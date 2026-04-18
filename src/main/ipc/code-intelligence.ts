/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    CodeQualityAnalysisSchema,
    DocumentationPreviewResultSchema,
    FileSearchResultSchema,
    RenameSymbolResultSchema,
    SymbolAnalyticsSchema,
    WorkspaceCodeMapSchema,
    WorkspaceDependencyGraphSchema,
} from '@shared/schemas/code-intelligence.schema';
import { ipcMain } from 'electron';
import { z } from 'zod';

const RootPathSchema = z.string().min(1).trim();
const QuerySchema = z.string().min(1).trim();
const WorkspaceIdSchema = z.string().min(1).trim();

/**
 * Registers IPC handlers for code intelligence operations.
 */
export function registerCodeIntelligenceIpc(codeIntelligenceService: CodeIntelligenceService) {
    /**
     * Find symbols by name/query
     */
    ipcMain.handle('code:findSymbols', createValidatedIpcHandler('code:findSymbols', async (_, rootPath: string, query: string) => {
        return await codeIntelligenceService.findSymbols(rootPath, query);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([RootPathSchema, QuerySchema]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Search files in workspace
     */
    ipcMain.handle('code:searchFiles', createValidatedIpcHandler('code:searchFiles', async (_, rootPath: string, query: string, workspaceId: string, isRegexArg?: boolean) => {
        const isRegex = typeof isRegexArg === 'boolean' ? isRegexArg : false;
        return await codeIntelligenceService.searchFiles(rootPath, query, workspaceId, isRegex);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([
            RootPathSchema,
            QuerySchema,
            WorkspaceIdSchema.optional(),
            z.boolean().optional().default(false)
        ]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Index a workspace
     */
    ipcMain.handle('code:indexWorkspace', createValidatedIpcHandler('code:indexWorkspace', async (_, rootPath: string, workspaceId: string, forceArg?: boolean) => {
        const force = typeof forceArg === 'boolean' ? forceArg : false;
        return await codeIntelligenceService.indexWorkspace(rootPath, workspaceId, force);
    }, {
        defaultValue: undefined,
        argsSchema: z.tuple([
            RootPathSchema,
            WorkspaceIdSchema,
            z.boolean().optional().default(false)
        ]),
        responseSchema: z.undefined(),
    }));

    /**
     * Query indexed symbols semantically
     */
    ipcMain.handle('code:querySymbols', createValidatedIpcHandler('code:querySymbols', async (_, query: string) => {
        return await codeIntelligenceService.queryIndexedSymbols(query);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([QuerySchema]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Get outline for a file
     */
    ipcMain.handle('code:getFileOutline', createValidatedIpcHandler('code:getFileOutline', async (_, filePath: string) => {
        return await codeIntelligenceService.getFileOutline(filePath);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([z.string().min(1)]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Find definition for a symbol
     */
    ipcMain.handle('code:findDefinition', createValidatedIpcHandler('code:findDefinition', async (_, rootPath: string, symbol: string) => {
        return await codeIntelligenceService.findDefinition(rootPath, symbol);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([RootPathSchema, QuerySchema]),
        responseSchema: FileSearchResultSchema.nullable(),
    }));

    /**
     * Find usage for a symbol
     */
    ipcMain.handle('code:findUsage', createValidatedIpcHandler('code:findUsage', async (_, rootPath: string, symbol: string) => {
        return await codeIntelligenceService.findUsage(rootPath, symbol);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([RootPathSchema, QuerySchema]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Find references for a symbol
     */
    ipcMain.handle('code:findReferences', createValidatedIpcHandler('code:findReferences', async (_, rootPath: string, symbol: string) => {
        return await codeIntelligenceService.findReferences(rootPath, symbol);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([RootPathSchema, QuerySchema]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Find implementations for a symbol
     */
    ipcMain.handle('code:findImplementations', createValidatedIpcHandler('code:findImplementations', async (_, rootPath: string, symbol: string) => {
        return await codeIntelligenceService.findImplementations(rootPath, symbol);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([RootPathSchema, QuerySchema]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Get related files/symbols for a given symbol
     */
    ipcMain.handle('code:getSymbolRelationships', createValidatedIpcHandler('code:getSymbolRelationships', async (_, rootPath: string, symbol: string, maxItems?: number) => {
        return await codeIntelligenceService.getSymbolRelationships(rootPath, symbol, maxItems);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([RootPathSchema, QuerySchema, z.number().optional()]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Query indexed symbols semantically
     */
    ipcMain.handle('code:queryIndexedSymbols', createValidatedIpcHandler('code:queryIndexedSymbols', async (_, query: string) => {
        return await codeIntelligenceService.queryIndexedSymbols(query);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([QuerySchema]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Get symbol analytics for a workspace
     */
    ipcMain.handle('code:getSymbolAnalytics', createValidatedIpcHandler('code:getSymbolAnalytics', async (_, rootPath: string) => {
        return await codeIntelligenceService.getSymbolAnalytics(rootPath);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([RootPathSchema]),
        responseSchema: SymbolAnalyticsSchema.nullable(),
    }));

    ipcMain.handle('code:getWorkspaceDependencyGraph', createValidatedIpcHandler('code:getWorkspaceDependencyGraph', async (_, rootPath: string) => {
        return await codeIntelligenceService.getWorkspaceDependencyGraph(rootPath);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([RootPathSchema]),
        responseSchema: WorkspaceDependencyGraphSchema.nullable(),
    }));

    ipcMain.handle('code:getWorkspaceCodeMap', createValidatedIpcHandler('code:getWorkspaceCodeMap', async (_, rootPath: string) => {
        return await codeIntelligenceService.getWorkspaceCodeMap(rootPath);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([RootPathSchema]),
        responseSchema: WorkspaceCodeMapSchema.nullable(),
    }));

    /**
     * Scan for TODOs in a workspace
     */
    ipcMain.handle('code:scanTodos', createValidatedIpcHandler('code:scanTodos', async (_, rootPath: string) => {
        return await codeIntelligenceService.scanTodos(rootPath);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([RootPathSchema]),
        responseSchema: z.array(FileSearchResultSchema),
    }));

    /**
     * Get code quality analysis
     */
    ipcMain.handle('code:analyzeQuality', createValidatedIpcHandler('code:analyzeQuality', async (_, rootPath: string, maxFiles?: number) => {
        return await codeIntelligenceService.analyzeCodeQuality(rootPath, maxFiles);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([RootPathSchema, z.number().optional()]),
        responseSchema: CodeQualityAnalysisSchema.nullable(),
    }));

    /**
     * Preview symbol rename
     */
    ipcMain.handle('code:previewRenameSymbol', createValidatedIpcHandler('code:previewRenameSymbol', async (_, rootPath: string, symbol: string, newSymbol: string, maxFiles?: number) => {
        return await codeIntelligenceService.renameSymbol(rootPath, symbol, newSymbol, false, maxFiles);
    }, {
        defaultValue: { success: false, applied: false, symbol: '', newSymbol: '', totalFiles: 0, totalOccurrences: 0, changes: [], updatedFiles: [], errors: [] },
        argsSchema: z.tuple([RootPathSchema, QuerySchema, QuerySchema, z.number().optional()]),
        responseSchema: RenameSymbolResultSchema,
    }));

    /**
     * Apply symbol rename
     */
    ipcMain.handle('code:applyRenameSymbol', createValidatedIpcHandler('code:applyRenameSymbol', async (_, rootPath: string, symbol: string, newSymbol: string, maxFiles?: number) => {
        return await codeIntelligenceService.renameSymbol(rootPath, symbol, newSymbol, true, maxFiles);
    }, {
        defaultValue: { success: false, applied: false, symbol: '', newSymbol: '', totalFiles: 0, totalOccurrences: 0, changes: [], updatedFiles: [], errors: [] },
        argsSchema: z.tuple([RootPathSchema, QuerySchema, QuerySchema, z.number().optional()]),
        responseSchema: RenameSymbolResultSchema,
    }));

    /**
     * Generate file documentation
     */
    ipcMain.handle('code:generateFileDocumentation', createValidatedIpcHandler('code:generateFileDocumentation', async (_, filePath: string, format?: 'markdown' | 'jsdoc-comments') => {
        return await codeIntelligenceService.generateFileDocumentation(filePath, format);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([z.string().min(1), z.enum(['markdown', 'jsdoc-comments']).optional()]),
        responseSchema: DocumentationPreviewResultSchema.nullable(),
    }));

    /**
     * Generate workspace documentation
     */
    ipcMain.handle('code:generateWorkspaceDocumentation', createValidatedIpcHandler('code:generateWorkspaceDocumentation', async (_, rootPath: string, maxFiles?: number) => {
        return await codeIntelligenceService.generateWorkspaceDocumentation(rootPath, maxFiles);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([RootPathSchema, z.number().optional()]),
        responseSchema: DocumentationPreviewResultSchema.nullable(),
    }));
}
