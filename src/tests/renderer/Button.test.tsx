import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';

describe('Button', () => {
    it('renders children text', () => {
        render(<Button>Save</Button>);
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('prefers explicit aria-label over children text', () => {
        render(<Button aria-label="Save settings">Save</Button>);
        expect(screen.getByRole('button', { name: 'Save settings' })).toBeInTheDocument();
    });
});
