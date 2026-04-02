import { LocaleService } from '@main/services/system/locale.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

export function registerLocaleIpc(localeService: LocaleService): void {
    ipcMain.handle('locale:runtime:getAll', createSafeIpcHandler('locale:runtime:getAll', async () => {
        return localeService.getAllLocalePacks();
    }, []));
}
