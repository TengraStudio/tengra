import { IpcRenderer } from 'electron';

export interface LazyServicesBridge {
    getStatus: () => Promise<{
        registered: string[];
        loaded: string[];
        loading: string[];
        totals: {
            registered: number;
            loaded: number;
            loading: number;
        };
    }>;
}

export function createLazyServicesBridge(ipc: IpcRenderer): LazyServicesBridge {
    return {
        getStatus: () => ipc.invoke('lazy:get-status'),
    };
}
