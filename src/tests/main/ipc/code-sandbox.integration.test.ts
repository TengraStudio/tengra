/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerCodeSandboxIpc } from '@main/ipc/code-sandbox';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type IpcHandler = (...args: TestValue[]) => TestValue | Promise<TestValue>;
const ipcMainHandlers = new Map<string, IpcHandler>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: IpcHandler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));


describe('Code Sandbox IPC Handlers', () => {
    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
        registerCodeSandboxIpc(() => null);
    });

    const getRequiredHandler = (channel: string): IpcHandler => {
        const handler = ipcMainHandlers.get(channel);
        if (!handler) {
            throw new Error(`Missing IPC handler: ${channel}`);
        }
        return handler;
    };

    it('lists supported sandbox languages', async () => {
        const handler = getRequiredHandler('code-sandbox:languages');
        const result = await handler({}) as {
            success: boolean;
            data?: {
                languages: string[];
                uiState: string;
            };
        };
        expect(result).toMatchObject({
            success: true,
            data: {
                languages: ['javascript', 'typescript', 'python', 'shell'],
                uiState: 'ready'
            }
        });
    });

    it('executes safe javascript code', async () => {
        const handler = getRequiredHandler('code-sandbox:execute');
        const result = await handler({}, {
            language: 'javascript',
            code: 'const x = 2 + 2; console.log(x); x;',
            timeoutMs: 1000
        }) as {
            success: boolean;
            data: {
                success: boolean;
                stdout: string;
                result?: string;
                uiState: string;
            };
        };
        expect(result.success).toBe(true);
        expect(result.data.success).toBe(true);
        expect(result.data.stdout).toContain('4');
        expect(result.data.result).toBe('4');
        expect(result.data.uiState).toBe('ready');
    });

    it('blocks javascript process access attempts', async () => {
        const handler = getRequiredHandler('code-sandbox:execute');
        const result = await handler({}, {
            language: 'javascript',
            code: 'process.env.PATH',
            timeoutMs: 1000
        }) as {
            success: boolean;
            data: {
                success: boolean;
                stderr: string;
                errorCode?: string;
                uiState?: string;
            };
        };
        expect(result.success).toBe(true);
        expect(result.data.success).toBe(false);
        expect(result.data.stderr).toContain('Blocked by sandbox security policy');
        expect(result.data.errorCode).toBe('CODE_SANDBOX_POLICY_BLOCKED');
        expect(result.data.uiState).toBe('failure');
    });

    it('exposes code sandbox health metrics endpoint', async () => {
        const handler = getRequiredHandler('code-sandbox:health');
        const result = await handler({}) as {
            success: boolean;
            data?: {
                success: boolean;
                data?: {
                    status: string;
                    budgets: { fastMs: number; executeMs: number };
                    metrics: { totalCalls: number; totalFailures: number; totalRetries: number };
                };
            };
        };
        expect(result).toMatchObject({
            success: true,
            data: {
                success: true,
                data: {
                    status: expect.any(String),
                    budgets: {
                        fastMs: 30,
                        executeMs: 260
                    },
                    metrics: {
                        totalCalls: expect.any(Number),
                        totalFailures: expect.any(Number),
                        totalRetries: expect.any(Number)
                    }
                }
            }
        });
    });
});
