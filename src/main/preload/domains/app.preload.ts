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
        runCommand: (command, args, cwd) => ipc.invoke('shell:runCommand', command, args, cwd),
    };
}
