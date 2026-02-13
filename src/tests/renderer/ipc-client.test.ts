import { invokeIpc } from '@renderer/lib/ipc-client';
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
});
