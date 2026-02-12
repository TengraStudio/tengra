import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatInput } from '@/features/chat/components/ChatInput';

let ctrl: any;

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
            sendMessage: vi.fn(async () => {}),
            processFile: vi.fn(async () => {}),
            removeAttachment: vi.fn(),
            t: (key: string) => key,
            isDragging: false,
            setIsDragging: vi.fn(),
            onDrop: vi.fn(),
            isListening: false,
            stopListening: vi.fn(),
            startListening: vi.fn(),
            isEnhancing: false,
            handleEnhancePrompt: vi.fn(async () => {}),
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
        };

        class RO {
            observe() {}
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', RO);
    });

    it('renders chat input group and disabled send button when empty', () => {
        render(<ChatInput />);

        expect(screen.getByRole('group', { name: 'Chat input' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'input.placeholder.default' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'common.send' })).toBeDisabled();
    });

    it('sends message when content exists and send button is clicked', () => {
        ctrl.input = 'hello';
        render(<ChatInput />);

        fireEvent.click(screen.getByRole('button', { name: 'common.send' }));
        expect(ctrl.sendMessage).toHaveBeenCalledTimes(1);
    });
});
