import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CodeEditor } from '@/components/ui/CodeEditor';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/utils/renderer-logger', () => ({
    appLogger: {
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Workspace CodeEditor integration', () => {
    it('renders loading state before monaco initialization completes', () => {
        render(<CodeEditor value="" language="typescript" />);
        expect(screen.getByText('common.loading')).toBeInTheDocument();
    });
});
