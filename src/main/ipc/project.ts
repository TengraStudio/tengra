import { ipcMain } from 'electron'
import { ProjectService } from '../services/project.service'
import { LogoService } from '../services/logo.service'
import { CodeIntelligenceService } from '../services/code-intelligence.service'

export const registerProjectIpc = (projectService: ProjectService, logoService: LogoService, codeIntelligenceService: CodeIntelligenceService) => {
    ipcMain.handle('project:analyze', async (_: any, rootPath: string, projectId: string) => {
        try {
            const results = await projectService.analyzeProject(rootPath)
            // Trigger background indexing
            if (projectId) {
                codeIntelligenceService.indexProject(rootPath, projectId).catch(err => {
                    console.error('Failed to auto-index project:', err)
                })
            }
            return results
        } catch (error) {
            console.error('Failed to analyze project:', error)
            throw error
        }
    })

    ipcMain.handle('project:generateLogo', async (_: any, projectPath: string, prompt: string, style: string) => {
        try {
            return await logoService.generateLogo(projectPath, prompt, style)
        } catch (error) {
            console.error('Failed to generate logo:', error)
            throw error
        }
    })

    ipcMain.handle('project:analyzeIdentity', async (_: any, projectPath: string) => {
        try {
            return await logoService.analyzeProjectIdentity(projectPath)
        } catch (error) {
            console.error('Failed to analyze project identity:', error)
            throw error
        }
    })

    ipcMain.handle('project:analyzeDirectory', async (_: any, dirPath: string) => {
        try {
            return await projectService.analyzeDirectory(dirPath)
        } catch (error) {
            console.error('Failed to analyze directory:', error)
            throw error
        }
    })

    ipcMain.handle('project:applyLogo', async (_: any, projectPath: string, tempLogoPath: string) => {
        try {
            return await logoService.applyLogo(projectPath, tempLogoPath)
        } catch (error) {
            console.error('Failed to apply logo:', error)
            throw error
        }
    })

    ipcMain.handle('project:getCompletion', async (_: any, text: string) => {
        try {
            // We'll use the LLMService for this.
            // For now, let's assume LogoService or a new service.
            // Actually, LogoService has access to LLM.
            // Let's add it to logoService for now or a generic place.
            return await logoService.getCompletion(text)
        } catch (error) {
            console.error('Failed to get completion:', error)
            throw error
        }
    })
}
