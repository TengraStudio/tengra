import { appLogger } from '@main/logging/logger';
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { ipcMain } from 'electron';

export const registerCodeIntelligenceIpc = (codeIntelligenceService: CodeIntelligenceService) => {
    ipcMain.handle('code:scanTodos', async (_, rootPath: string) => {
        try { return await codeIntelligenceService.scanProjectTodos(rootPath); }
        catch (e) { appLogger.error('CodeIntelligenceIPC', 'code:scanTodos failed', e as Error); return []; }
    });

    ipcMain.handle('code:findSymbols', async (_, rootPath: string, query: string) => {
        try { return await codeIntelligenceService.findSymbols(rootPath, query); }
        catch (e) { appLogger.error('CodeIntelligenceIPC', 'code:findSymbols failed', e as Error); return []; }
    });

    ipcMain.handle('code:searchFiles', async (_, rootPath: string, query: string, projectId: string, isRegex: boolean = false) => {
        try { return await codeIntelligenceService.searchFiles(rootPath, query, projectId, isRegex); }
        catch (e) { appLogger.error('CodeIntelligenceIPC', 'code:searchFiles failed', e as Error); return []; }
    });

    ipcMain.handle('code:indexProject', async (_, rootPath: string, projectId: string, force = false) => {
        try { return await codeIntelligenceService.indexProject(rootPath, projectId, force); }
        catch (e) { appLogger.error('CodeIntelligenceIPC', 'code:indexProject failed', e as Error); }
    });

    ipcMain.handle('code:queryIndexedSymbols', async (_, query: string) => {
        try { return await codeIntelligenceService.queryIndexedSymbols(query); }
        catch (e) { appLogger.error('CodeIntelligenceIPC', 'code:queryIndexedSymbols failed', e as Error); return []; }
    });
};
