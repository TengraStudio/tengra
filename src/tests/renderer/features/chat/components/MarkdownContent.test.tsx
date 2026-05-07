/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/chat/components/MonacoBlock', () => ({
    MonacoBlock: ({
        code,
        className,
    }: {
        code: string;
        className?: string;
    }) => (
        <div data-testid="monaco-block" data-classname={className ?? ''}>
            {code}
        </div>
    ),
}));

import { MarkdownContent } from '@/features/chat/components/message/MarkdownContent';

describe('MarkdownContent', () => {
    it('renders fenced code blocks with MonacoBlock', async () => {
        render(
            <MarkdownContent
                content={`Kod:\n\n\`\`\`ts\nconst x = 1;\n\`\`\``}
                t={(key: string) => key}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('monaco-block')).toBeInTheDocument();
        });

        expect(screen.getByTestId('monaco-block').textContent).toContain('const x = 1;');
    });

    it('keeps inline code as inline code element', async () => {
        const { container } = render(
            <MarkdownContent
                content={'Inline `x = 1` sample'}
                t={(key: string) => key}
            />
        );

        await waitFor(() => {
            expect(container.querySelector('code')).toBeTruthy();
        });

        expect(screen.queryByTestId('monaco-block')).not.toBeInTheDocument();
    });
});

