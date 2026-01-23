import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service'
import { getErrorMessage } from '@shared/utils/error.util'
import { ipcMain } from 'electron'

export const registerCodeIntelligenceIpc = (codeIntelligenceService: CodeIntelligenceService) => {
    ipcMain.handle('code:scanTodos', async (_, rootPath: string) => {
        try { return await codeIntelligenceService.scanTodos(rootPath) }
        catch (e) { console.error('[IPC] code:scanTodos failed:', getErrorMessage(e as Error)); return [] }
    })

    ipcMain.handle('code:findSymbols', async (_, rootPath: string, query: string) => {
        try { return await codeIntelligenceService.findSymbols(rootPath, query) }
        catch (e) { console.error('[IPC] code:findSymbols failed:', getErrorMessage(e as Error)); return [] }
    })

    ipcMain.handle('code:searchFiles', async (_, rootPath: string, query: string, projectId: string, isRegex: boolean = false) => {
        try { return await codeIntelligenceService.searchFiles(rootPath, query, projectId, isRegex) }
        catch (e) { console.error('[IPC] code:searchFiles failed:', getErrorMessage(e as Error)); return [] }
    })

    ipcMain.handle('code:indexProject', async (_, rootPath: string, projectId: string, force = false) => {
        try { return await codeIntelligenceService.indexProject(rootPath, projectId, force) }
        catch (e) { console.error('[IPC] code:indexProject failed:', getErrorMessage(e as Error)) }
    })

    ipcMain.handle('code:queryIndexedSymbols', async (_, query: string) => {
        try { return await codeIntelligenceService.queryIndexedSymbols(query) }
        catch (e) { console.error('[IPC] code:queryIndexedSymbols failed:', getErrorMessage(e as Error)); return [] }
    })
}
