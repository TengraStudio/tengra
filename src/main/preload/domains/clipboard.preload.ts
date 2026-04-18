/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IpcRenderer } from 'electron';

export interface ClipboardBridge {
    writeText: (text: string) => Promise<void>;
    readText: () => Promise<string>;
}

export function createClipboardBridge(ipc: IpcRenderer): ClipboardBridge {
    return {
        writeText: text => ipc.invoke('clipboard:writeText', text),
        readText: () => ipc.invoke('clipboard:readText'),
    };
}
