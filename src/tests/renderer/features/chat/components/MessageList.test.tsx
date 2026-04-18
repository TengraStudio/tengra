/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Message } from '@/types';

vi.mock('react-virtuoso', () => ({
    Virtuoso: ({
        data,
        itemContent,
        followOutput,
    }: {
        data: Array<{ id: string }>;
        itemContent: (index: number, item: { id: string }) => React.ReactNode;
        followOutput?: string;
    }) => (
        <div data-testid="virtuoso" data-follow-output={followOutput ?? ''}>
            {data.map((item, index) => (
                <div key={item.id}>{itemContent(index, item)}</div>
            ))}
        </div>
    ),
}));

vi.mock('@/features/chat/components/MessageBubble', () => ({
    MessageBubble: ({
        message,
        streamingReasoning,
        isStreaming,
    }: {
        message: Message;
        streamingReasoning?: string;
        isStreaming?: boolean;
    }) => (
        <div
            data-testid={`message-bubble-${message.id}`}
            data-streaming={isStreaming ? 'true' : 'false'}
            data-tool-calls={String(message.toolCalls?.length ?? 0)}
            data-tool-results={String(Array.isArray(message.toolResults) ? message.toolResults.length : 0)}
        >
            {streamingReasoning ?? ''}
        </div>
    ),
}));

vi.mock('@/features/chat/components/MessageSkeleton', () => ({
    MessageSkeleton: () => <div data-testid="message-skeleton" />,
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (typeof options?.count === 'number') {
                return `${key}:${String(options.count)}`;
            }
            return key;
        },
    }),
}));

vi.mock('@/utils/renderer-logger', () => ({
    appLogger: {
        info: vi.fn(),
    },
}));

import { MessageList } from '@/features/chat/components/MessageList';

function createAssistantMessage(
    id: string,
    overrides?: Partial<Message>
): Message {
    return {
        id,
        role: 'assistant',
        content: '',
        timestamp: new Date('2026-04-10T10:00:00.000Z'),
        ...overrides,
    };
}

describe('MessageList', () => {
    it('keeps passing live reasoning to the last displayed bubble after assistant collapse', () => {
        const messages: Message[] = [
            {
                id: 'user-1',
                role: 'user',
                content: 'Merhaba',
                timestamp: new Date('2026-04-10T09:59:00.000Z'),
            },
            createAssistantMessage('assistant-1', {
                reasonings: ['Ilk dusunce'],
                reasoning: 'Ilk dusunce',
            }),
            createAssistantMessage('assistant-2', {
                reasonings: ['Ikinci dusunce'],
                reasoning: 'Ikinci dusunce',
                toolCalls: [{
                    id: 'tool-1',
                    type: 'function',
                    function: {
                        name: 'list_directory',
                        arguments: '{"path":"C:/Users/agnes/Desktop"}',
                    },
                }],
            }),
        ];

        render(
            <MessageList
                messages={messages}
                streamingReasoning="Canli dusunce"
                streamingSpeed={null}
                isLoading={true}
                language="en"
                selectedProvider="antigravity"
                selectedModel="model-a"
                onSpeak={() => {}}
                onStopSpeak={() => {}}
                speakingMessageId={null}
            />
        );

        expect(screen.getByTestId('message-bubble-assistant-1')).toHaveTextContent('Canli dusunce');
        expect(screen.queryByTestId('message-bubble-assistant-2')).toBeNull();
    });

    it('compacts duplicate tool calls in the rendered assistant bubble', () => {
        const duplicateToolCalls: NonNullable<Message['toolCalls']> = [
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
                    name: 'resolve_path',
                    arguments: '{"path":"C:/Users/agnes/Desktop"}',
                },
            },
        ];

        render(
            <MessageList
                messages={[createAssistantMessage('assistant-1', { toolCalls: duplicateToolCalls })]}
                streamingReasoning={undefined}
                streamingSpeed={null}
                isLoading={false}
                language="en"
                selectedProvider="antigravity"
                selectedModel="model-a"
                onSpeak={() => {}}
                onStopSpeak={() => {}}
                speakingMessageId={null}
            />
        );

        expect(screen.getByTestId('message-bubble-assistant-1')).toHaveAttribute('data-tool-calls', '1');
    });

    it('merges tool results when assistant entries collapse into one bubble', () => {
        const messages: Message[] = [
            createAssistantMessage('assistant-1', {
                reasonings: ['Ilk dusunce'],
                reasoning: 'Ilk dusunce',
            }),
            createAssistantMessage('assistant-2', {
                reasonings: ['Ikinci dusunce'],
                reasoning: 'Ikinci dusunce',
                toolCalls: [{
                    id: 'tool-1',
                    type: 'function',
                    function: {
                        name: 'resolve_path',
                        arguments: '{"path":"C:/Users/agnes/Desktop"}',
                    },
                }],
                toolResults: [{
                    toolCallId: 'tool-1',
                    name: 'resolve_path',
                    result: { path: 'C:/Users/agnes/Desktop' },
                    success: true,
                }],
            }),
        ];

        render(
            <MessageList
                messages={messages}
                streamingReasoning={undefined}
                streamingSpeed={null}
                isLoading={true}
                language="en"
                selectedProvider="antigravity"
                selectedModel="model-a"
                onSpeak={() => {}}
                onStopSpeak={() => {}}
                speakingMessageId={null}
            />
        );

        expect(screen.getByTestId('message-bubble-assistant-1')).toHaveAttribute('data-tool-results', '1');
        expect(screen.queryByTestId('message-bubble-assistant-2')).toBeNull();
    });

    it('uses auto follow output while streaming to avoid scroll animation backlog', () => {
        render(
            <MessageList
                messages={[createAssistantMessage('assistant-1', { content: 'Streaming...' })]}
                streamingReasoning={undefined}
                streamingSpeed={null}
                isLoading={true}
                language="en"
                selectedProvider="antigravity"
                selectedModel="model-a"
                onSpeak={() => {}}
                onStopSpeak={() => {}}
                speakingMessageId={null}
            />
        );

        expect(screen.getByTestId('virtuoso')).toHaveAttribute('data-follow-output', 'auto');
    });
});
