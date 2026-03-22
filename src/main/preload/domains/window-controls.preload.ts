import { IpcRenderer } from 'electron';

export interface WindowControlsBridge {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    toggleCompact: (enabled: boolean) => void;
    resizeWindow: (resolution: string) => void;
    getZoomFactor: () => Promise<{ zoomFactor: number }>;
    setZoomFactor: (zoomFactor: number) => Promise<{ zoomFactor: number }>;
    stepZoomFactor: (direction: -1 | 1) => Promise<{ zoomFactor: number }>;
    resetZoomFactor: () => Promise<{ zoomFactor: number }>;
}

export function createWindowControlsBridge(ipc: IpcRenderer): WindowControlsBridge {
    return {
        minimize: () => ipc.send('window:minimize'),
        maximize: () => ipc.send('window:maximize'),
        close: () => ipc.send('window:close'),
        toggleCompact: enabled => ipc.send('window:toggle-compact', enabled),
        resizeWindow: resolution => ipc.send('window:resize', resolution),
        getZoomFactor: () => ipc.invoke('window:get-zoom-factor'),
        setZoomFactor: zoomFactor => ipc.invoke('window:set-zoom-factor', zoomFactor),
        stepZoomFactor: direction => ipc.invoke('window:step-zoom-factor', direction),
        resetZoomFactor: () => ipc.invoke('window:reset-zoom-factor'),
    };
}
