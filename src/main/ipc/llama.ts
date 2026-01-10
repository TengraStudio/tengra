import { ipcMain } from 'electron'
import { LlamaService } from '../services/llm/llama.service'
import { IpcValue } from '../../shared/types/common'
import { getErrorMessage } from '../../shared/utils/error.util'

export function registerLlamaIpc(llamaService: LlamaService) {
    ipcMain.handle('llama:loadModel', async (_event, modelPath: string, config: Record<string, IpcValue>) => {
        return await llamaService.loadModel(modelPath, config)
    })

    ipcMain.handle('llama:unloadModel', async () => {
        await llamaService.stopServer()
        return { success: true }
    })

    ipcMain.handle('llama:chat', async (_event, message: string, systemPrompt?: string) => {
        try {
            const response = await llamaService.chat(message, systemPrompt)
            return { success: true, response }
        } catch (error) {
            const message = getErrorMessage(error as Error)
            return { success: false, error: message }
        }
    })

    ipcMain.handle('llama:resetSession', async () => {
        llamaService.resetSession()
        return { success: true }
    })

    ipcMain.handle('llama:getModels', async () => {
        return await llamaService.getModels()
    })

    ipcMain.handle('llama:downloadModel', async (_event, url: string, filename: string) => {
        return await llamaService.downloadModel(url, filename)
    })

    ipcMain.handle('llama:deleteModel', async (_event, modelPath: string) => {
        return await llamaService.deleteModel(modelPath)
    })

    ipcMain.handle('llama:getConfig', async () => {
        return llamaService.getConfig()
    })

    ipcMain.handle('llama:setConfig', async (_event, config: Record<string, IpcValue>) => {
        llamaService.setConfig(config)
        return { success: true }
    })

    ipcMain.handle('llama:getGpuInfo', async () => {
        return await llamaService.getGpuInfo()
    })

    ipcMain.handle('llama:getModelsDir', async () => {
        return llamaService.getModelsDir()
    })
}
