/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createSessionBridge } from '@main/preload/domains/session.preload';
import { SESSION_CONVERSATION_CHANNELS } from '@shared/constants/ipc-channels';
import { describe, expect, it, vi } from 'vitest';

interface IpcListenerMap {
    [channel: string]: ((...args: unknown[]) => void) | undefined;
}

function createIpcRendererMock() {
    const listeners: IpcListenerMap = {};

    return {
        invoke: vi.fn(),
        send: vi.fn(),
        on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
            listeners[channel] = listener;
        }),
        removeListener: vi.fn((channel: string) => {
            delete listeners[channel];
        }),
        emit(channel: string, payload: unknown) {
            listeners[channel]?.({}, payload);
        },
    };
}

describe('Session preload bridge', () => {
    it('decodes binary stream chunks for session conversation listeners', () => {
        const ipc = createIpcRendererMock();
        const bridge = createSessionBridge(ipc as never);
        const listener = vi.fn();
        const unsubscribe = bridge.conversation.onStreamChunk(listener);
        const encoded = new TextEncoder().encode(JSON.stringify({
            chatId: 'chat-1',
            content: 'large-payload',
        }));

        ipc.emit(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK_BINARY, encoded);

        expect(listener).toHaveBeenCalledWith({
            chatId: 'chat-1',
            content: 'large-payload',
        });

        unsubscribe();

        expect(ipc.removeListener).toHaveBeenCalledWith(
            SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK,
            expect.any(Function)
        );
        expect(ipc.removeListener).toHaveBeenCalledWith(
            SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK_BINARY,
            expect.any(Function)
        );
    });
});

