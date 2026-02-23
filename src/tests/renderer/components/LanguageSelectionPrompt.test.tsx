import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LanguageSelectionPrompt } from '@/components/shared/LanguageSelectionPrompt';

const setLanguage = vi.fn().mockResolvedValue(undefined);

vi.mock('@renderer/i18n', () => ({
    useLanguage: () => ({
        language: 'en',
        setLanguage,
        t: (key: string) => key,
    }),
}));

describe('LanguageSelectionPrompt', () => {
    it('renders available language options', () => {
        render(<LanguageSelectionPrompt onClose={vi.fn()} />);
        expect(screen.getByText('English')).toBeInTheDocument();
        expect(screen.getByText('Türkçe')).toBeInTheDocument();
        expect(screen.getByText('العربية')).toBeInTheDocument();
    });

    it('saves language and closes prompt', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<LanguageSelectionPrompt onClose={onClose} />);

        await user.click(screen.getByText('Deutsch'));
        expect(setLanguage).toHaveBeenCalledWith('de');
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
