/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.unmock('@main/utils/ipc-wrapper.util');

describe('createValidatedIpcHandler', () => {
    it('accepts a single object payload for object args schemas', async () => {
        const handler = createValidatedIpcHandler(
            'test:object-args',
            async (_event, payload: { value: number }) => payload.value * 2,
            {
                argsSchema: z.object({ value: z.number().int().positive() }),
                schemaVersion: 1
            }
        );

        await expect(handler({} as never, { value: 2 })).resolves.toBe(4);
    });

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
            async () => ({ ok: 'yes' } as never as { ok: boolean }),
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

