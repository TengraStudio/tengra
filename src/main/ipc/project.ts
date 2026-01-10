import { ipcMain } from 'electron'
import { ProjectService } from '../services/project.service'
import { LogoService } from '../services/logo.service'
import { CodeIntelligenceService } from '../services/code-intelligence.service'
import { createIpcHandler } from '../utils/ipc-wrapper.util'

export const registerProjectIpc = (getWindow: () => Electron.BrowserWindow | null, projectService: ProjectService, logoService: LogoService, codeIntelligenceService: CodeIntelligenceService) => {
    ipcMain.handle('project:analyze', createIpcHandler('project:analyze', async (_event, rootPath: string, projectId: string) => {
        const results = await projectService.analyzeProject(rootPath)
        // Trigger background indexing
        if (projectId) {
            codeIntelligenceService.indexProject(rootPath, projectId).catch(err => {
                console.error('Failed to auto-index project:', err)
            })
        }
        return results
    }))

    ipcMain.handle('project:watch', createIpcHandler('project:watch', async (_event, rootPath: string) => {
        const win = getWindow()
        await projectService.watchProject(rootPath, (event, filePath) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('project:file-change', { event, path: filePath, rootPath })
            }
        })
        return { success: true }
    }))

    ipcMain.handle('project:unwatch', createIpcHandler('project:unwatch', async (_event, rootPath: string) => {
        await projectService.stopWatch(rootPath)
        return { success: true }
    }))

    ipcMain.handle('project:generateLogo', createIpcHandler('project:generateLogo', async (_event, projectPath: string, prompt: string, style: string) => {
        return await logoService.generateLogo(projectPath, prompt, style)
    }))

    ipcMain.handle('project:analyzeIdentity', createIpcHandler('project:analyzeIdentity', async (_event, projectPath: string) => {
        return await logoService.analyzeProjectIdentity(projectPath)
    }))

    ipcMain.handle('project:analyzeDirectory', createIpcHandler('project:analyzeDirectory', async (_event, dirPath: string) => {
        return await projectService.analyzeDirectory(dirPath)
    }))

    ipcMain.handle('project:applyLogo', createIpcHandler('project:applyLogo', async (_event, projectPath: string, tempLogoPath: string) => {
        return await logoService.applyLogo(projectPath, tempLogoPath)
    }))

    ipcMain.handle('project:getCompletion', createIpcHandler('project:getCompletion', async (_event, text: string) => {
        return await logoService.getCompletion(text)
    }))
}
