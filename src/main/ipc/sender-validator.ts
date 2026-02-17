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
