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
};
