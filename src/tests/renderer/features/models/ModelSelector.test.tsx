/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useDebounce', () => ({
    useDebounce: (value: string) => value
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@/features/models/hooks/useModelSelectorLogic', () => ({
    useModelSelectorLogic: () => ({
        isModelDisabled: () => false
    })
}));

vi.mock('@/features/models/hooks/useModelCategories', () => ({
    useModelCategories: () => ([
        {
            id: 'openai',
            name: 'OpenAI',
            icon: () => null,
            color: 'text-foreground',
            bg: 'bg-muted',
            models: [
                {
                    id: 'gpt-4o',
                    label: 'GPT-4o',
                    provider: 'openai'
                }
            ]
        }
    ])
}));

vi.mock('@/features/models/components/ModelSelectorTrigger', () => ({
    ModelSelectorTrigger: ({
        isOpen,
        setIsOpen
    }: {
        isOpen: boolean;
        setIsOpen: (value: boolean) => void;
    }) => (
        <button
            type="button"
            data-testid="model-selector-trigger"
            onClick={() => setIsOpen(!isOpen)}
        >
            toggle
        </button>
    )
}));

vi.mock('@/features/models/components/ModelSelectorPopover', () => ({
    ModelSelectorPopover: ({ isOpen }: { isOpen: boolean }) => (
        <div data-testid="model-selector-popover">{isOpen ? 'open' : 'closed'}</div>
    )
}));

import { ModelSelector } from '@/features/models/components/ModelSelector';

describe('ModelSelector', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not notify parent again when only onOpenChange identity changes', () => {
        const firstHandler = vi.fn();
        const { rerender } = render(
            <ModelSelector
                selectedProvider="openai"
                selectedModel="gpt-4o"
                onSelect={vi.fn()}
                onOpenChange={firstHandler}
            />
        );

        expect(firstHandler).not.toHaveBeenCalled();

        const secondHandler = vi.fn();
        rerender(
            <ModelSelector
                selectedProvider="openai"
                selectedModel="gpt-4o"
                onSelect={vi.fn()}
                onOpenChange={secondHandler}
            />
        );

        expect(firstHandler).not.toHaveBeenCalled();
        expect(secondHandler).not.toHaveBeenCalled();
    });

    it('notifies parent only when the open state changes', () => {
        const onOpenChange = vi.fn();
        const { getByTestId } = render(
            <ModelSelector
                selectedProvider="openai"
                selectedModel="gpt-4o"
                onSelect={vi.fn()}
                onOpenChange={onOpenChange}
            />
        );

        fireEvent.click(getByTestId('model-selector-trigger'));
        fireEvent.click(getByTestId('model-selector-trigger'));

        expect(onOpenChange).toHaveBeenCalledTimes(2);
        expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
        expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
    });
});

