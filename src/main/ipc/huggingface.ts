import { ipcMain } from 'electron'
import { LLMService } from '../services/llm.service'

export function registerHFModelIpc(llmService: LLMService) {
    ipcMain.handle('hf:search-models', async (_event, query: string, limit: number, page: number) => {
        return await llmService.searchHFModels(query, limit, page)
    })
}
