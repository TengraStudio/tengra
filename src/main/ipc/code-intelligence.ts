import { ipcMain } from 'electron'
import { CodeIntelligenceService } from '../services/code-intelligence.service'

export const registerCodeIntelligenceIpc = (codeIntelligenceService: CodeIntelligenceService) => {
    ipcMain.handle('code:scanTodos', (_, rootPath: string) => {
        return codeIntelligenceService.scanTodos(rootPath)
    })

    ipcMain.handle('code:findSymbols', (_, rootPath: string, query: string) => {
        return codeIntelligenceService.findSymbols(rootPath, query)
    })

    ipcMain.handle('code:searchFiles', (_, rootPath: string, query: string, isRegex: boolean) => {
        return codeIntelligenceService.searchFiles(rootPath, query, isRegex)
    })

    ipcMain.handle('code:indexProject', (_, rootPath: string, projectId: string) => {
        return codeIntelligenceService.indexProject(rootPath, projectId)
    })

    ipcMain.handle('code:queryIndexedSymbols', (_, query: string) => {
        return codeIntelligenceService.queryIndexedSymbols(query)
    })
}
