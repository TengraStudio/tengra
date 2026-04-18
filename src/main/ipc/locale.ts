/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LocaleService } from '@main/services/system/locale.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

export function registerLocaleIpc(localeService: LocaleService): void {
    ipcMain.handle('locale:runtime:getAll', createSafeIpcHandler('locale:runtime:getAll', async () => {
        return localeService.getAllLocalePacks();
    }, []));
}
