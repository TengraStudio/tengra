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
