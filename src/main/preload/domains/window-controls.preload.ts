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

export interface WindowControlsBridge {
    minimize: () => void;
    maximize: () => void;
    fullscreen: () => void;
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
        fullscreen: () => ipc.send('window:toggle-fullscreen'),
        close: () => ipc.send('window:close'),
        toggleCompact: enabled => ipc.send('window:toggle-compact', enabled),
        resizeWindow: resolution => ipc.send('window:resize', resolution),
        getZoomFactor: () => ipc.invoke('window:get-zoom-factor'),
        setZoomFactor: zoomFactor => ipc.invoke('window:set-zoom-factor', zoomFactor),
        stepZoomFactor: direction => ipc.invoke('window:step-zoom-factor', direction),
        resetZoomFactor: () => ipc.invoke('window:reset-zoom-factor'),
    };
}
