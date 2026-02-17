import { IpcRenderer } from 'electron';

export interface WindowControlsBridge {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    toggleCompact: (enabled: boolean) => void;
    resizeWindow: (resolution: string) => void;
}

export function createWindowControlsBridge(ipc: IpcRenderer): WindowControlsBridge {
    return {
        minimize: () => ipc.send('window:minimize'),
        maximize: () => ipc.send('window:maximize'),
        close: () => ipc.send('window:close'),
        toggleCompact: enabled => ipc.send('window:toggle-compact', enabled),
        resizeWindow: resolution => ipc.send('window:resize', resolution),
    };
}
