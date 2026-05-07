/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CODE_SANDBOX_CHANNELS } from '@shared/constants/ipc-channels';
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
            metrics: Record<string, RuntimeValue>;
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
        languages: () => ipc.invoke(CODE_SANDBOX_CHANNELS.LANGUAGES),
        execute: payload => ipc.invoke(CODE_SANDBOX_CHANNELS.EXECUTE, payload),
        health: () => ipc.invoke(CODE_SANDBOX_CHANNELS.HEALTH),
    };
}

