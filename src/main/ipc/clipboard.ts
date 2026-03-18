import { ClipboardService } from '@main/services/ui/clipboard.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

export function registerClipboardIpc(clipboardService: ClipboardService) {
    ipcMain.handle(
        'clipboard:writeText',
        createSafeIpcHandler(
            'clipboard:writeText',
            async (_event, text: RuntimeValue) => {
                if (typeof text !== 'string') {
                    throw new Error('Invalid text');
                }
                return clipboardService.writeText(text);
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'clipboard:readText',
        createSafeIpcHandler(
            'clipboard:readText',
            async () => {
                return clipboardService.readText();
            },
            { success: false, text: '' }
        )
    );
}
