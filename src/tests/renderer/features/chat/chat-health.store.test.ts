/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
    __resetChatHealthForTests,
    getChatHealthSnapshot,
    recordChatHealthEvent,
} from '@/features/chat/store/chat-health.store';

describe('chat-health.store', () => {
    beforeEach(() => {
        __resetChatHealthForTests();
    });

    it('records successful chat send metrics', () => {
        recordChatHealthEvent({
            channel: 'chat.send',
            status: 'success',
            durationMs: 220,
        });

        const snapshot = getChatHealthSnapshot();
        expect(snapshot.metrics.totalCalls).toBe(1);
        expect(snapshot.metrics.totalFailures).toBe(0);
        expect(snapshot.metrics.channels['chat.send'].calls).toBe(1);
        expect(snapshot.status).toBe('healthy');
    });

    it('tracks validation failures and degrades health', () => {
        recordChatHealthEvent({
            channel: 'chat.input',
            status: 'validation-failure',
            errorCode: 'CHAT_INPUT_VALIDATION_ERROR',
        });

        const snapshot = getChatHealthSnapshot();
        expect(snapshot.metrics.totalFailures).toBe(1);
        expect(snapshot.metrics.validationFailures).toBe(1);
        expect(snapshot.metrics.lastErrorCode).toBe('CHAT_INPUT_VALIDATION_ERROR');
        expect(snapshot.status).toBe('degraded');
    });

    it('flags budget overruns', () => {
        recordChatHealthEvent({
            channel: 'chat.enhance',
            status: 'success',
            durationMs: 1500,
        });

        const snapshot = getChatHealthSnapshot();
        expect(snapshot.metrics.budgetExceeded).toBe(1);
        expect(snapshot.metrics.channels['chat.enhance'].budgetExceeded).toBe(1);
        expect(snapshot.status).toBe('degraded');
    });
});
