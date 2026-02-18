import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MemorySearchFilter } from '@/features/memory/components/MemorySearchFilter';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('MemorySearchFilter', () => {
    it('stores and clears search history from UX controls', () => {
        const onSearch = vi.fn();
        const onSearchChange = vi.fn();

        render(
            <MemorySearchFilter
                searchQuery="memory graph"
                categoryFilter="all"
                onSearchChange={onSearchChange}
                onCategoryChange={vi.fn()}
                onSearch={onSearch}
            />
        );

        fireEvent.submit(screen.getByRole('button', { name: 'common.search' }).closest('form') as HTMLFormElement);
        expect(onSearch).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'memory graph' }));
        expect(onSearchChange).toHaveBeenCalledWith('memory graph');

        fireEvent.click(screen.getByRole('button', { name: 'common.clear' }));
        expect(screen.queryByRole('button', { name: 'memory graph' })).not.toBeInTheDocument();
    });
});
