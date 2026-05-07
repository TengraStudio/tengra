/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SHELL_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface AppBridge {
    runCommand: (
        command: string,
        args: string[],
        cwd?: string
    ) => Promise<{ stdout: string; stderr: string; code: number }>;
}

export function createAppBridge(ipc: IpcRenderer): AppBridge {
    return {
        runCommand: (command, args, cwd) => ipc.invoke(SHELL_CHANNELS.RUN_COMMAND, command, args, cwd),
    };
}

