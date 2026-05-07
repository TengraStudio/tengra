/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WINDOW_CHANNELS } from '@shared/constants/ipc-channels';
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
        minimize: () => ipc.send(WINDOW_CHANNELS.MINIMIZE),
        maximize: () => ipc.send(WINDOW_CHANNELS.MAXIMIZE),
        fullscreen: () => ipc.send(WINDOW_CHANNELS.TOGGLE_FULLSCREEN),
        close: () => ipc.send(WINDOW_CHANNELS.CLOSE),
        toggleCompact: enabled => ipc.send(WINDOW_CHANNELS.TOGGLE_COMPACT, enabled),
        resizeWindow: resolution => ipc.send(WINDOW_CHANNELS.RESIZE, resolution),
        getZoomFactor: () => ipc.invoke(WINDOW_CHANNELS.GET_ZOOM_FACTOR),
        setZoomFactor: zoomFactor => ipc.invoke(WINDOW_CHANNELS.SET_ZOOM_FACTOR, zoomFactor),
        stepZoomFactor: direction => ipc.invoke(WINDOW_CHANNELS.STEP_ZOOM_FACTOR, direction),
        resetZoomFactor: () => ipc.invoke(WINDOW_CHANNELS.RESET_ZOOM_FACTOR),
    };
}

