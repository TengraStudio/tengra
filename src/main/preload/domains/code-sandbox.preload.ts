import { IpcRenderer } from 'electron';

export interface CodeSandboxBridge {
    languages: () => Promise<{
        languages: Array<'javascript' | 'typescript' | 'python' | 'shell'>;
        errorCode?: string;
        messageKey?: string;
        retryable?: boolean;
        uiState: 'ready' | 'empty' | 'failure';
        fallbackUsed?: boolean;
    }>;
    execute: (payload: {
        language: 'javascript' | 'typescript' | 'python' | 'shell';
        code: string;
        timeoutMs?: number;
        stdin?: string;
    }) => Promise<{
        success: boolean;
        stdout: string;
        stderr: string;
        result?: string;
        durationMs: number;
        language: 'javascript' | 'typescript' | 'python' | 'shell';
        errorCode?: string;
        messageKey?: string;
        retryable?: boolean;
        uiState: 'ready' | 'empty' | 'failure';
        fallbackUsed?: boolean;
    }>;
    health: () => Promise<{
        success: boolean;
        data?: {
            status: 'healthy' | 'degraded';
            uiState: 'ready' | 'failure';
            budgets: {
                fastMs: number;
                executeMs: number;
            };
            metrics: Record<string, unknown>;
        };
        error?: string;
        errorCode?: string;
        messageKey?: string;
        retryable?: boolean;
        uiState?: 'ready' | 'failure';
        fallbackUsed?: boolean;
    }>;
}

export function createCodeSandboxBridge(ipc: IpcRenderer): CodeSandboxBridge {
    return {
        languages: () => ipc.invoke('code-sandbox:languages'),
        execute: payload => ipc.invoke('code-sandbox:execute', payload),
        health: () => ipc.invoke('code-sandbox:health'),
    };
}
