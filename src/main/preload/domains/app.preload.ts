import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface AppBridge {
    runCommand: (
        command: string,
        args: string[],
        cwd?: string
    ) => Promise<{ stdout: string; stderr: string; code: number }>;

    onQuotaInterrupt: (callback: (payload: Record<string, unknown>) => void) => () => void;
}

export function createAppBridge(ipc: IpcRenderer): AppBridge {
    return {
        runCommand: (command, args, cwd) => ipc.invoke('app:run-command', { command, args, cwd }),

        onQuotaInterrupt: callback => {
            const listener = (_event: IpcRendererEvent, payload: Record<string, unknown>) => callback(payload);
            ipc.on('agent:quota-interrupt', listener);
            return () => ipc.removeListener('agent:quota-interrupt', listener);
        },
    };
}
