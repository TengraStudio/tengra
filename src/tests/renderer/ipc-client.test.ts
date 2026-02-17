import { invokeIpc, invokeTypedIpc, type IpcContractMap } from '@renderer/lib/ipc-client';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

describe('ipc-client', () => {
    it('validates response and returns typed data', async () => {
        const invoke = vi.fn().mockResolvedValue([{ id: 't1', name: 'theme-1', version: '1.0.0', author: 'test' }]);
        Object.defineProperty(window, 'electron', {
            value: { ipcRenderer: { invoke } },
            configurable: true
        });

        const result = await invokeIpc('theme:runtime:getAll', [], {
            responseSchema: z.array(z.object({ id: z.string(), name: z.string(), version: z.string(), author: z.string() }))
        });

        expect(result).toHaveLength(1);
        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('retries retryable failures', async () => {
        const invoke = vi.fn()
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockResolvedValueOnce(undefined);

        Object.defineProperty(window, 'electron', {
            value: { ipcRenderer: { invoke } },
            configurable: true
        });

        await invokeIpc('theme:runtime:openDirectory', [], {
            responseSchema: z.void(),
            maxAttempts: 2,
            baseDelayMs: 1
        });

        expect(invoke).toHaveBeenCalledTimes(2);
    });

    it('does not retry validation errors', async () => {
        const invoke = vi.fn().mockRejectedValue(new Error('Validation failed'));

        Object.defineProperty(window, 'electron', {
            value: { ipcRenderer: { invoke } },
            configurable: true
        });

        await expect(
            invokeIpc('theme:runtime:install', ['bad-path'], {
                argsSchema: z.tuple([z.string()]),
                responseSchema: z.void(),
                maxAttempts: 3,
                baseDelayMs: 1
            })
        ).rejects.toThrow('IPC theme:runtime:install failed after 3 attempt(s): Validation failed');

        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('supports contract-based typed invocation', async () => {
        const invoke = vi.fn().mockResolvedValue({ success: true });
        Object.defineProperty(window, 'electron', {
            value: { ipcRenderer: { invoke } },
            configurable: true
        });

        type Contract = IpcContractMap & {
            'mcp:marketplace:install': {
                args: [string];
                response: { success: boolean };
            };
        };

        const result = await invokeTypedIpc<Contract, 'mcp:marketplace:install'>(
            'mcp:marketplace:install',
            ['server-id'],
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: z.object({ success: z.boolean() })
            }
        );

        expect(result.success).toBe(true);
        expect(invoke).toHaveBeenCalledWith('mcp:marketplace:install', 'server-id');
    });
});
