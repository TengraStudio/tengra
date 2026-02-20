import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatInput } from '@/features/chat/components/ChatInput';

type ChatInputControllerMock = {
    input: string;
    setInput: (value: string) => void;
    showCommandMenu: boolean;
    filteredPrompts: Array<{ id: string; title: string; content: string }>;
    handleCommandNavigation: (event: React.KeyboardEvent) => boolean;
    setShowCommandMenu: (show: boolean) => void;
    setCommandQuery: (query: string) => void;
    setSelectedIndex: (index: number) => void;
    isLoading: boolean;
    attachments: Array<{ name: string; size: number; type: string; preview?: string }>;
    sendMessage: () => Promise<void>;
    sendMessageWithTelemetry: () => Promise<void>;
    processFile: (file: File) => Promise<void>;
    removeAttachment: (index: number) => void;
    t: (key: string) => string;
    isDragging: boolean;
    setIsDragging: (isDragging: boolean) => void;
    onDrop: (event: React.DragEvent) => void;
    isListening: boolean;
    stopListening: () => void;
    startListening: () => void;
    isEnhancing: boolean;
    handleEnhancePrompt: () => Promise<void>;
    stopGeneration: () => void;
    selectedProvider: string;
    selectedModel: string;
    selectedModels: string[];
    handleSelectModel: (provider: string, model: string) => void;
    removeSelectedModel: (model: string) => void;
    appSettings: Record<string, string>;
    groupedModels: Record<string, string>;
    quotas: Record<string, string>;
    codexUsage: null;
    claudeQuota: null;
    setIsModelMenuOpen: (isOpen: boolean) => void;
    contextTokens: number;
    language: string;
    toggleFavorite: (modelId: string) => void;
    isFavorite: (modelId: string) => boolean;
    getModelReasoningLevel: () => string;
    setModelReasoningLevel: (modelId: string, level: string) => void;
    lastError: { messageKey: string } | null;
    clearLastError: () => void;
    chatInputMaxLength: number;
};

let ctrl: ChatInputControllerMock;

vi.mock('@/features/chat/hooks/useChatInputController', () => ({
    useChatInputController: () => ctrl,
}));

vi.mock('@/features/models/components/ModelSelector', () => ({
    ModelSelector: () => <div data-testid="model-selector-mock" />,
}));

describe('ChatInput', () => {
    beforeEach(() => {
        ctrl = {
            input: '',
            setInput: vi.fn(),
            showCommandMenu: false,
            filteredPrompts: [],
            handleCommandNavigation: vi.fn(() => false),
            setShowCommandMenu: vi.fn(),
            setCommandQuery: vi.fn(),
            setSelectedIndex: vi.fn(),
            isLoading: false,
            attachments: [],
            sendMessage: vi.fn(async () => { }),
            sendMessageWithTelemetry: vi.fn(async () => { }),
            processFile: vi.fn(async () => { }),
            removeAttachment: vi.fn(),
            t: (key: string) => key,
            isDragging: false,
            setIsDragging: vi.fn(),
            onDrop: vi.fn(),
            isListening: false,
            stopListening: vi.fn(),
            startListening: vi.fn(),
            isEnhancing: false,
            handleEnhancePrompt: vi.fn(async () => { }),
            stopGeneration: vi.fn(),
            selectedProvider: 'openai',
            selectedModel: 'gpt',
            selectedModels: [],
            handleSelectModel: vi.fn(),
            removeSelectedModel: vi.fn(),
            appSettings: {},
            groupedModels: {},
            quotas: {},
            codexUsage: null,
            claudeQuota: null,
            setIsModelMenuOpen: vi.fn(),
            contextTokens: 0,
            language: 'en',
            toggleFavorite: vi.fn(),
            isFavorite: vi.fn(() => false),
            getModelReasoningLevel: vi.fn(() => 'medium'),
            setModelReasoningLevel: vi.fn(),
            lastError: null,
            clearLastError: vi.fn(),
            chatInputMaxLength: 12000,
        };

        class RO {
            observe() { }
            disconnect() { }
        }
        vi.stubGlobal('ResizeObserver', RO);
    });

    it('renders chat input group and disabled send button when empty', () => {
        render(<ChatInput />);

        expect(screen.getByRole('group', { name: 'Chat input' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'input.placeholder.default' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'common.send' })).toBeDisabled();

    });

    it('sends message when content exists and send button is clicked', () => {
        ctrl.input = 'hello';
        render(<ChatInput />);

        fireEvent.click(screen.getByRole('button', { name: 'common.send' }));
        expect(ctrl.sendMessageWithTelemetry).toHaveBeenCalledTimes(1);
    });

    it('sends message on Enter key press when content exists', () => {
        ctrl.input = 'hello from keyboard';
        render(<ChatInput />);

        fireEvent.keyDown(screen.getByTestId('chat-textarea'), { key: 'Enter', shiftKey: false });
        expect(ctrl.sendMessageWithTelemetry).toHaveBeenCalledTimes(1);
    });

    it('renders and clears failure state banner', () => {
        ctrl.lastError = { messageKey: 'chat.errors.sendFailed' };
        render(<ChatInput />);

        expect(screen.getByRole('status')).toHaveTextContent('chat.errors.sendFailed');
        fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
        expect(ctrl.clearLastError).toHaveBeenCalledTimes(1);
    });
});
