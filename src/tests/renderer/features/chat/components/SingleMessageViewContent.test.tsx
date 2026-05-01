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
import { describe, expect, it, vi } from 'vitest';

import type { Message } from '@/types';

vi.mock('@/features/chat/components/message/AssistantLogo', () => ({
    AssistantLogo: () => null,
}));

vi.mock('@/features/chat/components/message/MarkdownContent', () => ({
    MessageBubbleContent: () => null,
    MarkdownContent: () => null,
}));

vi.mock('@/features/chat/components/message/MessageActions', () => ({
    MessageActions: () => null,
}));

vi.mock('@/features/chat/components/message/MessageFooter', () => ({
    MessageFooter: () => null,
}));

vi.mock('@/features/chat/components/message/MessageImages', () => ({
    MessageImages: () => null,
}));

vi.mock('@/features/chat/components/message/MessageSources', () => ({
    MessageSources: () => null,
}));

vi.mock('@/features/chat/components/message/PlanSection', () => ({
    PlanSection: () => null,
}));

vi.mock('@/features/chat/components/message/RawToggle', () => ({
    RawToggle: () => null,
}));

vi.mock('@/features/chat/components/message/ResponseProgress', () => ({
    ResponseProgress: () => null,
}));

vi.mock('@/features/chat/components/message/ToolRecoveryNotice', () => ({
    ToolRecoveryNotice: () => null,
}));

vi.mock('@/features/chat/components/ToolDisplay', () => ({
    ToolDisplay: () => null,
}));

vi.mock('@/features/chat/components/message/ThoughtSection', () => ({
    ThoughtSection: ({
        thought,
        segmentIndex,
    }: {
        thought: string | null;
        segmentIndex?: number;
    }) => (
        <div data-testid="thought-section">
            {`${segmentIndex ?? -1}:${thought ?? ''}`}
        </div>
    ),
}));

import {
    SingleMessageViewContent,
    type SingleMessageViewContentProps,
} from '@/features/chat/components/message/SingleMessageViewContent';

const t = (key: string, options?: Record<string, string | number>): string => {
    if (key === 'workspaceAgent.thoughtStep') {
        return `thought-step-${String(options?.index ?? '')}`;
    }
    return key;
};

function createMessage(reasonings?: string[]): Message {
    return {
        id: 'assistant-message-1',
        role: 'assistant',
        content: 'Final cevap.',
        timestamp: new Date('2026-04-10T10:00:00.000Z'),
        provider: 'antigravity',
        model: 'model-a',
        reasonings,
        reasoning: reasonings?.[reasonings.length - 1],
    };
}

function createProps(overrides?: Partial<SingleMessageViewContentProps>): SingleMessageViewContentProps {
    const message = overrides?.message ?? createMessage(['Ilk dusunce']);
    return {
        message,
        backend: 'antigravity',
        isUser: false,
        isStreaming: true,
        interruptedToolNames: [],
        isThoughtExpanded: false,
        setIsThoughtExpanded: vi.fn(),
        plan: null,
        thought: 'Ilk dusunce genisledi',
        streamingReasoning: 'Ilk dusunce genisledi',
        isLast: true,
        onApprovePlan: vi.fn(),
        displayContent: 'Final cevap.',
        quotaDetails: null,
        contentProps: {
            isUser: false,
            isStreaming: true,
            displayContent: 'Final cevap.',
            quotaDetails: null,
            images: [],
            showRawMarkdown: false,
            attachments: [],
            t,
        },
        actionsContextProps: {
            displayContent: 'Final cevap.',
            message,
            showRawMarkdown: false,
            setShowRawMarkdown: vi.fn(),
            t,
        },
        hasReactions: false,
        onReact: vi.fn(),
        id: 'single-message-view',
        isFocused: false,
        language: 'en',
        streamingSpeed: null,
        t,
        ...overrides,
    };
}

describe('SingleMessageViewContent', () => {
    it('updates the last thought section instead of appending a duplicate when streaming extends it', () => {
        render(
            <SingleMessageViewContent
                {...createProps({
                    message: createMessage(['Ilk dusunce']),
                    thought: 'Ilk dusunce genisledi',
                    streamingReasoning: 'Ilk dusunce genisledi',
                })}
            />
        );

        const thoughtSections = screen.getAllByTestId('thought-section');
        expect(thoughtSections).toHaveLength(1);
        expect(thoughtSections[0]).toHaveTextContent('0:Ilk dusunce genisledi');
    });

    it('renders a second thought section when a new segment starts after the previous one', () => {
        render(
            <SingleMessageViewContent
                {...createProps({
                    message: createMessage(['Ilk dusunce']),
                    thought: 'Ikinci dusunce',
                    streamingReasoning: 'Ikinci dusunce',
                })}
            />
        );

        const thoughtSections = screen.getAllByTestId('thought-section');
        expect(thoughtSections).toHaveLength(2);
        expect(thoughtSections[0]).toHaveTextContent('0:Ilk dusunce');
        expect(thoughtSections[1]).toHaveTextContent('1:Ikinci dusunce');
    });
});
