import { DatabaseService } from '@main/services/data/database.service'
import { LogoService } from '@main/services/external/logo.service'
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service'
import { ProjectService } from '@main/services/project/project.service'
import { JobSchedulerService } from '@main/services/system/job-scheduler.service'
import { createIpcHandler } from '@main/utils/ipc-wrapper.util'
import { dialog, ipcMain } from 'electron'

export const registerProjectIpc = (getWindow: () => Electron.BrowserWindow | null, projectService: ProjectService, logoService: LogoService, codeIntelligenceService: CodeIntelligenceService, jobSchedulerService: JobSchedulerService, databaseService: DatabaseService) => {
    ipcMain.handle('project:analyze', createIpcHandler('project:analyze', async (_event, rootPath: string, projectId: string) => {
        console.log(`[ProjectIPC] Analyze requested for ${rootPath} (ID: ${projectId})`)
        const results = await projectService.analyzeProject(rootPath)
        console.log(`[ProjectIPC] Analysis returned ${results?.files?.length || 0} files`)
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
        await projectService.watchProject(rootPath, async (event, filePath) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('project:file-change', { event, path: filePath, rootPath })
            }

            // Proactive RAG Indexing
            if (event === 'change' || event === 'rename') {
                jobSchedulerService.schedule(`index:${filePath}`, async () => {
                    try {
                        const projects = await databaseService.getProjects();
                        // Ideally matches rootPath.
                        const exactProject = projects.find(p => p.path === rootPath);
                        if (exactProject) {
                            await codeIntelligenceService.updateFileIndex(exactProject.id, filePath);
                        }
                    } catch (e) {
                        console.error('[ProjectIPC] Auto-index failed:', e)
                    }
                }, 5000)
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

    ipcMain.handle('project:improveLogoPrompt', createIpcHandler('project:improveLogoPrompt', async (_event, prompt: string) => {
        return await logoService.improveLogoPrompt(prompt)
    }))

    ipcMain.handle('project:uploadLogo', createIpcHandler('project:uploadLogo', async (_event, projectPath: string) => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'svg'] }
            ]
        })

        if (result.canceled || result.filePaths.length === 0) {
            return null
        }

        return await logoService.applyLogo(projectPath, result.filePaths[0]!)
    }))
}
