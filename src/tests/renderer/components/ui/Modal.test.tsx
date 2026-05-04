/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '@/components/ui/modal';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { title?: string }) => {
            if (key === 'aria.closeModal') {
                return 'Close modal';
            }
            if (key === 'modal.contentForTitle') {
                return options?.title ? `Modal content for ${options.title}` : 'Modal content';
            }
            return key;
        },
    }),
}));

describe('Modal', () => {
    it('renders dialog with title and content when open', () => {
        render(
            <Modal isOpen={true} onClose={vi.fn()} title="Settings">
                Modal content
            </Modal>
        );

        expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
        expect(screen.getByText('Modal content')).toBeInTheDocument();
        expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
        expect(screen.getByText('Modal content for Settings')).toBeInTheDocument();
    });

    it('calls onClose when backdrop is clicked', () => {
        const onClose = vi.fn();
        render(
            <Modal isOpen={true} onClose={onClose} title="Settings">
                Modal content
            </Modal>
        );

        fireEvent.click(screen.getByRole('dialog'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when escape is pressed', () => {
        const onClose = vi.fn();
        render(
            <Modal isOpen={true} onClose={onClose} title="Settings">
                Modal content
            </Modal>
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close from escape when preventClose is enabled', () => {
        const onClose = vi.fn();
        render(
            <Modal isOpen={true} onClose={onClose} title="Settings" preventClose={true}>
                Modal content
            </Modal>
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });
});
