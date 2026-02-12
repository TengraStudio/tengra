import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/input';

describe('Input', () => {
    it('renders as textbox with default type', () => {
        render(<Input id="username" placeholder="Username" />);
        expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    });

    it('sets aria-invalid and fallback aria-describedby for error variant', () => {
        render(<Input id="email" variant="error" />);
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-describedby', 'email-error');
    });
});
