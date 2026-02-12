import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '@/components/ui/modal';

describe('Modal', () => {
    it('renders dialog with title and content when open', () => {
        render(
            <Modal isOpen={true} onClose={vi.fn()} title="Settings">
                Modal content
            </Modal>
        );

        expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
        expect(screen.getByText('Modal content')).toBeInTheDocument();
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
});
