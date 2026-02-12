import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaCard } from '@/features/ideas/components/IdeaCard';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('IdeaCard', () => {
    const idea = {
        id: 'idea-1',
        sessionId: 'session-1',
        title: 'AI Notes Assistant',
        category: 'website' as const,
        description: 'Summarize and organize notes with AI',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    it('renders article landmark with idea title', () => {
        render(<IdeaCard idea={idea} onClick={vi.fn()} />);
        expect(screen.getByRole('article', { name: 'AI Notes Assistant' })).toBeInTheDocument();
    });

    it('opens back face controls and triggers open callback', () => {
        const onClick = vi.fn();
        render(<IdeaCard idea={idea} onClick={onClick} />);

        fireEvent.click(screen.getByRole('button', { name: 'ideas.idea.viewDetails' }));
        fireEvent.click(screen.getByRole('button', { name: 'ideas.idea.openFullProject' }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
