import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, clipboard, ipcMain } from 'electron';

export function registerClipboardIpc(getMainWindow: () => BrowserWindow | null): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'clipboard operation');

    ipcMain.handle('clipboard:writeText', createIpcHandler('clipboard:writeText', async (event, text: string) => {
        validateSender(event);
        clipboard.writeText(text);
    }));

    ipcMain.handle('clipboard:readText', createIpcHandler('clipboard:readText', async (event) => {
        validateSender(event);
        return clipboard.readText();
    }));
}
