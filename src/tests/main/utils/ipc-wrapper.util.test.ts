import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.unmock('@main/utils/ipc-wrapper.util');

describe('createValidatedIpcHandler', () => {
    it('rejects invalid args payload', async () => {
        const handler = createValidatedIpcHandler(
            'test:invalid-args',
            async (_event, value: number) => value * 2,
            {
                argsSchema: z.tuple([z.number().int().min(1)]),
                schemaVersion: 1
            }
        );

        await expect(handler({} as never, 0)).rejects.toThrow();
    });

    it('rejects invalid response payload', async () => {
        const handler = createValidatedIpcHandler<{ ok: boolean }, []>(
            'test:invalid-response',
            async () => ({ ok: 'yes' } as unknown as { ok: boolean }),
            {
                responseSchema: z.object({ ok: z.boolean() }),
                schemaVersion: 2
            }
        );

        await expect(handler({} as never)).rejects.toThrow();
    });

    it('calls validation failure callback', async () => {
        const onValidationFailed = vi.fn();
        const handler = createValidatedIpcHandler(
            'test:callback',
            async (_event, value: number) => value,
            {
                argsSchema: z.tuple([z.number().int().positive()]),
                onValidationFailed,
                schemaVersion: 3
            }
        );

        await expect(handler({} as never, -5)).rejects.toThrow();
        expect(onValidationFailed).toHaveBeenCalledTimes(1);
    });
});
