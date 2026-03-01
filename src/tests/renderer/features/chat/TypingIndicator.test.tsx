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
