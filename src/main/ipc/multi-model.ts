import { ComparisonRequest,MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service';
import { ipcMain } from 'electron';

export function registerMultiModelIpc(comparisonService: MultiModelComparisonService): void {
    ipcMain.handle('llm:compare-models', async (_event, request: ComparisonRequest) => {
        return await comparisonService.compareModels(request);
    });
}
