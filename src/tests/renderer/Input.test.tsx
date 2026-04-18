/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
