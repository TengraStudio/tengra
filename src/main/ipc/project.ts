import { ipcMain } from 'electron'
import { ProjectService } from '../services/project.service'

export const registerProjectIpc = (projectService: ProjectService) => {
    ipcMain.handle('project:analyze', async (_, rootPath: string) => {
        try {
            return await projectService.analyzeProject(rootPath)
        } catch (error) {
            console.error('Failed to analyze project:', error)
            throw error
        }
    })
}
