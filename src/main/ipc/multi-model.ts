import { ipcMain } from 'electron';
import { MultiModelComparisonService, ComparisonRequest } from '../services/llm/multi-model-comparison.service';

export function registerMultiModelIpc(comparisonService: MultiModelComparisonService): void {
    ipcMain.handle('llm:compare-models', async (_event, request: ComparisonRequest) => {
        return await comparisonService.compareModels(request);
    });
}
