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

// Mock the custom i18n hook
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en' },
    }),
}));

import { TypingIndicator } from '@/features/chat/components/TypingIndicator';

describe('TypingIndicator', () => {
    it('renders without crashing', () => {
        const { container } = render(<TypingIndicator />);
        expect(container.firstChild).toBeTruthy();
    });

    it('displays the thinking translation key', () => {
        render(<TypingIndicator />);
        expect(screen.getByText('messageBubble.thinking')).toBeInTheDocument();
    });

    it('renders three bounce dots', () => {
        const { container } = render(<TypingIndicator />);
        const dots = container.querySelectorAll('.animate-bounce');
        expect(dots).toHaveLength(3);
    });
});
