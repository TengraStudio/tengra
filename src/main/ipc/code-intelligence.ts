import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';
import { z } from 'zod';

const RootPathSchema = z.string().min(1).trim();
const QuerySchema = z.string().min(1).trim();
const ProjectIdSchema = z.string().min(1).trim();

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
        argsSchema: z.tuple([RootPathSchema, QuerySchema])
    }));

    /**
     * Search files in project
     */
    ipcMain.handle('code:searchFiles', createValidatedIpcHandler('code:searchFiles', async (_, rootPath: string, query: string, projectId: string, isRegexArg?: boolean) => {
        const isRegex = typeof isRegexArg === 'boolean' ? isRegexArg : false;
        return await codeIntelligenceService.searchFiles(rootPath, query, projectId, isRegex);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([
            RootPathSchema,
            QuerySchema,
            ProjectIdSchema.optional(),
            z.boolean().optional().default(false)
        ])
    }));

    /**
     * Index a project
     */
    ipcMain.handle('code:indexProject', createValidatedIpcHandler('code:indexProject', async (_, rootPath: string, projectId: string, forceArg?: boolean) => {
        const force = typeof forceArg === 'boolean' ? forceArg : false;
        return await codeIntelligenceService.indexProject(rootPath, projectId, force);
    }, {
        defaultValue: undefined,
        argsSchema: z.tuple([
            RootPathSchema,
            ProjectIdSchema,
            z.boolean().optional().default(false)
        ])
    }));

    /**
     * Query indexed symbols semantically
     */
    ipcMain.handle('code:querySymbols', createValidatedIpcHandler('code:querySymbols', async (_, query: string) => {
        return await codeIntelligenceService.queryIndexedSymbols(query);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([QuerySchema])
    }));

    /**
     * Get outline for a file
     */
    ipcMain.handle('code:getFileOutline', createValidatedIpcHandler('code:getFileOutline', async (_, filePath: string) => {
        return await codeIntelligenceService.getFileOutline(filePath);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([z.string().min(1)])
    }));

    /**
     * Find definition for a symbol
     */
    ipcMain.handle('code:findDefinition', createValidatedIpcHandler('code:findDefinition', async (_, rootPath: string, symbol: string) => {
        return await codeIntelligenceService.findDefinition(rootPath, symbol);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([RootPathSchema, QuerySchema])
    }));

    /**
     * Find usage for a symbol
     */
    ipcMain.handle('code:findUsage', createValidatedIpcHandler('code:findUsage', async (_, rootPath: string, symbol: string) => {
        return await codeIntelligenceService.findUsage(rootPath, symbol);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([RootPathSchema, QuerySchema])
    }));

    /**
     * Get related files/symbols for a given symbol
     */
    ipcMain.handle('code:getSymbolRelationships', createValidatedIpcHandler('code:getSymbolRelationships', async (_, rootPath: string, symbol: string, maxItems?: number) => {
        return await codeIntelligenceService.getSymbolRelationships(rootPath, symbol, maxItems);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([RootPathSchema, QuerySchema, z.number().optional()])
    }));

    /**
     * Get symbol analytics for a project
     */
    ipcMain.handle('code:getSymbolAnalytics', createValidatedIpcHandler('code:getSymbolAnalytics', async (_, rootPath: string) => {
        return await codeIntelligenceService.getSymbolAnalytics(rootPath);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([RootPathSchema])
    }));

    /**
     * Scan for TODOs in a project
     */
    ipcMain.handle('code:scanTodos', createValidatedIpcHandler('code:scanTodos', async (_, rootPath: string) => {
        return await codeIntelligenceService.scanTodos(rootPath);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([RootPathSchema])
    }));

    /**
     * Get code quality analysis
     */
    ipcMain.handle('code:getQualityAnalysis', createValidatedIpcHandler('code:getQualityAnalysis', async (_, rootPath: string) => {
        return await codeIntelligenceService.analyzeCodeQuality(rootPath);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([RootPathSchema])
    }));
}
