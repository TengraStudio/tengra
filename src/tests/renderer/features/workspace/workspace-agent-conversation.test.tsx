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
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceAgentConversation } from '@/features/workspace/components/workspace/WorkspaceAgentConversation';
import type { Message } from '@/types';

vi.mock('@/features/chat/components/MessageBubble', () => ({
    MessageBubble: ({
        message,
    }: {
        message: Message;
    }) => <div>{typeof message.content === 'string' ? message.content : 'rich-message'}</div>,
}));

vi.mock('react-virtuoso', () => ({
    Virtuoso: ({
        data,
        itemContent,
    }: {
        data: Message[];
        itemContent: (index: number, message: Message) => ReactNode;
    }) => (
        <div>
            {data.map((message, index) => (
                <div key={message.id}>{itemContent(index, message)}</div>
            ))}
        </div>
    ),
}));

function createMessage(overrides?: Partial<Message>): Message {
    return {
        id: overrides?.id ?? 'message-1',
        chatId: overrides?.chatId ?? 'session-1',
        role: overrides?.role ?? 'assistant',
        content: overrides?.content ?? 'Workspace reply',
        timestamp: overrides?.timestamp ?? new Date('2026-03-16T10:00:00.000Z'),
        provider: overrides?.provider ?? 'claude',
        model: overrides?.model ?? 'sonnet',
        metadata: overrides?.metadata ?? {},
    };
}

describe('WorkspaceAgentConversation', () => {
    it('renders workspace messages through the shared message bubble surface', () => {
        render(
            <WorkspaceAgentConversation
                session={null}
                messages={[
                    createMessage({ id: 'user-1', role: 'user', content: 'Need a fix' }),
                    createMessage({ id: 'assistant-1', content: 'Here is the response' }),
                ]}
                language="en"
                isLoading={false}
                chatError={null}
                modes={{ ask: true, plan: false, agent: false, council: false }}
                proposal={[]}
                timeline={[]}
                onRetry={vi.fn()}
                onApprovePlan={vi.fn()}
                selectedProvider="claude"
                selectedModel="sonnet"
                t={(key: string) => key}
            />
        );

        expect(screen.getByText('Need a fix')).toBeInTheDocument();
        expect(screen.getByText('Here is the response')).toBeInTheDocument();
    });
});
