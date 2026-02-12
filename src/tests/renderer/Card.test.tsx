import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

describe('Card', () => {
    it('uses region role when an accessible name is provided', () => {
        render(<Card aria-label="Project summary">Body</Card>);

        expect(screen.getByRole('region', { name: 'Project summary' })).toBeInTheDocument();
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
