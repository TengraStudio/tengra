import { ipcMain } from 'electron'
import { CodeIntelligenceService } from '../services/code-intelligence.service'

export const registerCodeIntelligenceIpc = (codeIntelligenceService: CodeIntelligenceService) => {
    ipcMain.handle('code:scan-todos', (_, rootPath: string) => {
        return codeIntelligenceService.scanTodos(rootPath)
    })

    ipcMain.handle('code:find-symbols', (_, rootPath: string, query: string) => {
        return codeIntelligenceService.findSymbols(rootPath, query)
    })

    ipcMain.handle('code:search-files', (_, rootPath: string, query: string, isRegex: boolean) => {
        return codeIntelligenceService.searchFiles(rootPath, query, isRegex)
    })
}
