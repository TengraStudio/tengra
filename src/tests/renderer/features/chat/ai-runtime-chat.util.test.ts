import { describe, expect, it } from 'vitest';

import { buildStoredToolResults } from '@/features/chat/hooks/ai-runtime-chat.util';
import type { Message } from '@/types';

describe('buildStoredToolResults', () => {
    it('returns only completed tool results during in-flight execution', () => {
        const toolCalls: NonNullable<Message['toolCalls']> = [
            {
                id: 'tool-1',
                type: 'function',
                function: {
                    name: 'resolve_path',
                    arguments: '{"path":"C:/Users/agnes/Desktop"}',
                },
            },
            {
                id: 'tool-2',
                type: 'function',
                function: {
                    name: 'list_directory',
                    arguments: '{"path":"C:/Users/agnes/Desktop"}',
                },
            },
        ];
        const toolMessages: Message[] = [
            {
                id: 'result-1',
                role: 'tool',
                content: JSON.stringify({ success: true, path: 'C:/Users/agnes/Desktop' }),
                toolCallId: 'tool-1',
                timestamp: new Date('2026-04-10T10:00:00.000Z'),
            },
        ];

        const results = buildStoredToolResults(toolCalls, toolMessages);

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            toolCallId: 'tool-1',
            name: 'resolve_path',
            success: true,
            result: { success: true, path: 'C:/Users/agnes/Desktop' },
        });
    });
});
