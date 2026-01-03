import { ipcMain } from 'electron'
import { HuggingFaceService } from '../services/huggingface.service'

export function registerHFModelIpc(huggingfaceService: HuggingFaceService) {
    ipcMain.handle('hf:search-models', async (_event, query: string, limit: number, page: number) => {
        return await huggingfaceService.searchModels(query, limit, page)
    })
}
