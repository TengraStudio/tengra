/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

export type SenderValidator = (event: IpcMainEvent | IpcMainInvokeEvent) => void;

export function createMainWindowSenderValidator(
    getMainWindow: () => BrowserWindow | null,
    operationName: string
): SenderValidator {
    return (event) => {
        const win = getMainWindow();
        if (event.sender.id !== win?.webContents.id) {
            appLogger.warn(
                'Security',
                `Unauthorized ${operationName} attempt from sender ${event.sender.id}`
            );
            throw new Error(`Unauthorized ${operationName}`);
        }
    };
}

