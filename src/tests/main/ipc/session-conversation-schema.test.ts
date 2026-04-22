/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { sessionConversationMessageSchema } from '@shared/schemas/session-conversation-ipc.schema';
import { describe, expect,it } from 'vitest';

describe('sessionConversationMessageSchema', () => {
    it('should validate and transform string timestamps', () => {
        const isoString = '2024-03-14T12:00:00Z';
        const result = sessionConversationMessageSchema.parse({
            role: 'user',
            content: 'hello',
            timestamp: isoString
        });
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.timestamp.getTime()).toBe(new Date(isoString).getTime());
    });

    it('should validate and transform numeric timestamps', () => {
        const now = Date.now();
        const result = sessionConversationMessageSchema.parse({
            role: 'user',
            content: 'hello',
            timestamp: now
        });
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.timestamp.getTime()).toBe(now);
    });

    it('should validate and transform Date objects', () => {
        const date = new Date();
        const result = sessionConversationMessageSchema.parse({
            role: 'user',
            content: 'hello',
            timestamp: date
        });
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.timestamp.getTime()).toBe(date.getTime());
    });

    it('should use current date if timestamp is missing', () => {
        const result = sessionConversationMessageSchema.parse({
            role: 'user',
            content: 'hello'
        });
        expect(result.timestamp).toBeInstanceOf(Date);
        // Approximately now
        expect(Math.abs(result.timestamp.getTime() - Date.now())).toBeLessThan(1000);
    });

    it('should preserve renderer assistant tool calls for tool-loop continuation', () => {
        const result = sessionConversationMessageSchema.parse({
            role: 'assistant',
            content: '',
            toolCalls: [{
                id: 'call-1',
                index: 0,
                type: 'function',
                function: {
                    name: 'mcp__terminal__run_command',
                    arguments: '{"command":"pwd"}',
                },
            }],
        });

        expect(result.toolCalls?.[0]?.id).toBe('call-1');
        expect(result.toolCalls?.[0]?.function.name).toBe('mcp__terminal__run_command');
    });

    it('should preserve renderer tool result ids for tool-loop continuation', () => {
        const result = sessionConversationMessageSchema.parse({
            role: 'tool',
            content: '{"stdout":"ok"}',
            toolCallId: 'call-1',
        });

        expect(result.toolCallId).toBe('call-1');
    });
});
