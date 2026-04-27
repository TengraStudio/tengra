/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CodeLanguageService } from '@main/services/system/code-language.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

export function registerCodeLanguageIpc(codeLanguageService: CodeLanguageService): void {
    ipcMain.handle('code-language:runtime:getAll', createSafeIpcHandler('code-language:runtime:getAll', async () => {
        return codeLanguageService.getAllCodeLanguagePacks();
    }, []));
}
