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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

describe('Card', () => {
    it('uses region role when an accessible name is provided', () => {
        render(<Card aria-label="Workspace summary">Body</Card>);

        expect(screen.getByRole('region', { name: 'Workspace summary' })).toBeInTheDocument();
    });

    it('respects explicit role instead of implicit region', () => {
        render(<Card role="group" aria-label="Grouped card">Body</Card>);

        expect(screen.getByRole('group', { name: 'Grouped card' })).toBeInTheDocument();
    });

    it('renders composed card parts', () => {
        render(
            <Card>
                <CardHeader>
                    <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent>Details</CardContent>
            </Card>
        );

        expect(screen.getByRole('heading', { level: 3, name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByText('Details')).toBeInTheDocument();
    });
});

