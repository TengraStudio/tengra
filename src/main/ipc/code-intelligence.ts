/**
 * IPC handlers for Code Intelligence Service
 */
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { FileSearchResult } from '@shared/types/common';
import { ipcMain } from 'electron';


export const registerCodeIntelligenceIpc = (codeIntelligenceService: CodeIntelligenceService) => {
    /**
     * Scan project for TODOs
     */
    ipcMain.handle('code:scanTodos', createSafeIpcHandler<Awaited<ReturnType<CodeIntelligenceService['scanProjectTodos']>>, [string]>('code:scanTodos', async (_, rootPath) => {
        return await codeIntelligenceService.scanProjectTodos(rootPath);
    }, []));


    /**
     * Find symbols in project
     */
    ipcMain.handle('code:findSymbols', createSafeIpcHandler<FileSearchResult[], [string, string]>('code:findSymbols', async (_, rootPath, query) => {
        return await codeIntelligenceService.findSymbols(rootPath, query);
    }, []));

    /**
     * Search files in project
     */
    ipcMain.handle('code:searchFiles', createSafeIpcHandler<FileSearchResult[], [string, string, string, boolean]>('code:searchFiles', async (_, rootPath, query, projectId, isRegex = false) => {
        return await codeIntelligenceService.searchFiles(rootPath, query, projectId, isRegex);
    }, []));

    /**
     * Index a project
     */
    ipcMain.handle('code:indexProject', createSafeIpcHandler<void, [string, string, boolean]>('code:indexProject', async (_, rootPath, projectId, force = false) => {
        return await codeIntelligenceService.indexProject(rootPath, projectId, force);
    }, void 0));



    /**
     * Query indexed symbols
     */
    ipcMain.handle('code:queryIndexedSymbols', createSafeIpcHandler<FileSearchResult[], [string]>('code:queryIndexedSymbols', async (_, query) => {
        return await codeIntelligenceService.queryIndexedSymbols(query);
    }, []));

    /**
     * Find symbol definition
     */
    ipcMain.handle('code:findDefinition', createSafeIpcHandler<FileSearchResult | null, [string, string]>('code:findDefinition', async (_, rootPath, symbol) => {
        return await codeIntelligenceService.findDefinition(rootPath, symbol);
    }, null));

    /**
     * Find symbol references/usages
     */
    ipcMain.handle('code:findReferences', createSafeIpcHandler<FileSearchResult[], [string, string]>('code:findReferences', async (_, rootPath, symbol) => {
        return await codeIntelligenceService.findReferences(rootPath, symbol);
    }, []));

    /**
     * Find likely symbol implementations
     */
    ipcMain.handle('code:findImplementations', createSafeIpcHandler<FileSearchResult[], [string, string]>('code:findImplementations', async (_, rootPath, symbol) => {
        return await codeIntelligenceService.findImplementations(rootPath, symbol);
    }, []));

    /**
     * Get symbol relationship graph edges (flat list)
     */
    ipcMain.handle('code:getSymbolRelationships', createSafeIpcHandler<FileSearchResult[], [string, string, number?]>('code:getSymbolRelationships', async (_, rootPath, symbol, maxItems) => {
        return await codeIntelligenceService.getSymbolRelationships(rootPath, symbol, maxItems);
    }, []));

    /**
     * Get file symbol outline
     */
    ipcMain.handle('code:getFileOutline', createSafeIpcHandler<FileSearchResult[], [string]>('code:getFileOutline', async (_, filePath) => {
        return await codeIntelligenceService.getFileOutline(filePath);
    }, []));

    /**
     * Preview symbol rename refactor
     */
    ipcMain.handle('code:previewRenameSymbol', createSafeIpcHandler<Awaited<ReturnType<CodeIntelligenceService['renameSymbol']>>, [string, string, string, number?]>('code:previewRenameSymbol', async (_, rootPath, symbol, newSymbol, maxFiles) => {
        return await codeIntelligenceService.renameSymbol(rootPath, symbol, newSymbol, false, maxFiles);
    }, {
        success: false,
        applied: false,
        symbol: '',
        newSymbol: '',
        totalFiles: 0,
        totalOccurrences: 0,
        changes: [],
        updatedFiles: [],
        errors: [],
    }));

    /**
     * Apply symbol rename refactor
     */
    ipcMain.handle('code:applyRenameSymbol', createSafeIpcHandler<Awaited<ReturnType<CodeIntelligenceService['renameSymbol']>>, [string, string, string, number?]>('code:applyRenameSymbol', async (_, rootPath, symbol, newSymbol, maxFiles) => {
        return await codeIntelligenceService.renameSymbol(rootPath, symbol, newSymbol, true, maxFiles);
    }, {
        success: false,
        applied: true,
        symbol: '',
        newSymbol: '',
        totalFiles: 0,
        totalOccurrences: 0,
        changes: [],
        updatedFiles: [],
        errors: [],
    }));

    /**
     * Generate documentation preview for a file
     */
    ipcMain.handle('code:generateFileDocumentation', createSafeIpcHandler<Awaited<ReturnType<CodeIntelligenceService['generateFileDocumentation']>>, [string, ('markdown' | 'jsdoc-comments')?]>('code:generateFileDocumentation', async (_, filePath, format = 'markdown') => {
        return await codeIntelligenceService.generateFileDocumentation(filePath, format);
    }, {
        success: false,
        filePath: '',
        format: 'markdown',
        content: '',
        symbolCount: 0,
        generatedAt: '',
        error: 'Failed to generate documentation',
    }));

    /**
     * Generate markdown documentation summary for a project
     */
    ipcMain.handle('code:generateProjectDocumentation', createSafeIpcHandler<Awaited<ReturnType<CodeIntelligenceService['generateProjectDocumentation']>>, [string, number?]>('code:generateProjectDocumentation', async (_, rootPath, maxFiles) => {
        return await codeIntelligenceService.generateProjectDocumentation(rootPath, maxFiles);
    }, {
        success: false,
        filePath: '',
        format: 'markdown',
        content: '',
        symbolCount: 0,
        generatedAt: '',
        error: 'Failed to generate project documentation',
    }));

    /**
     * Analyze project code quality
     */
    ipcMain.handle('code:analyzeQuality', createSafeIpcHandler<Awaited<ReturnType<CodeIntelligenceService['analyzeCodeQuality']>>, [string, number?]>('code:analyzeQuality', async (_, rootPath, maxFiles) => {
        return await codeIntelligenceService.analyzeCodeQuality(rootPath, maxFiles);
    }, {
        rootPath: '',
        filesScanned: 0,
        totalLines: 0,
        functionSymbols: 0,
        classSymbols: 0,
        longLineCount: 0,
        todoLikeCount: 0,
        consoleUsageCount: 0,
        securityIssueCount: 0,
        topSecurityFindings: [],
        averageComplexity: 0,
        highestComplexityFiles: [],
        qualityScore: 0,
        generatedAt: '',
    }));

    /**
     * Get symbol analytics for a project path
     */
    ipcMain.handle('code:getSymbolAnalytics', createSafeIpcHandler<Awaited<ReturnType<CodeIntelligenceService['getSymbolAnalytics']>>, [string]>('code:getSymbolAnalytics', async (_, rootPath) => {
        return await codeIntelligenceService.getSymbolAnalytics(rootPath);
    }, {
        totalSymbols: 0,
        uniqueFiles: 0,
        uniqueKinds: 0,
        byKind: {},
        byExtension: {},
        topFiles: [],
        topSymbols: [],
        generatedAt: '',
    }));
};
