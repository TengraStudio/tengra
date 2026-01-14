import { HuggingFaceService } from '@main/services/llm/huggingface.service'
import { LLMService } from '@main/services/llm/llm.service'
import { ipcMain } from 'electron'

export function registerHFModelIpc(llmService: LLMService, hfService: HuggingFaceService) {
    ipcMain.handle('hf:search-models', async (_event, query: string, limit: number, page: number, sort: string) => {
        return await llmService.searchHFModels(query, limit, page, sort)
    })

    ipcMain.handle('hf:get-files', async (_event, modelId: string) => {
        return await hfService.getModelFiles(modelId)
    })

    ipcMain.handle('hf:download-file', async (event, url: string, outputPath: string, expectedSize: number, expectedSha256: string) => {
        return await hfService.downloadFile(url, outputPath, expectedSize, expectedSha256, (received: number, total: number) => {
            event.sender.send('hf:download-progress', { filename: outputPath, received, total })
        })
    })

    ipcMain.handle('hf:cancel-download', () => {
        // Implement cancellation logic if we store the controller/stream
        // For now, placeholder
    })
}
