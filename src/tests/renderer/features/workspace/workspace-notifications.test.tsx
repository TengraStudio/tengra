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

import { WorkspaceNotifications } from '@/features/workspace/workspace-layout/WorkspaceNotifications';

describe('WorkspaceNotifications', () => {
    it('shows operation summary and grouped duplicate count', () => {
        render(
            <WorkspaceNotifications
                notifications={[
                    { id: '1', type: 'error', message: 'Failed to delete.' },
                    { id: '2', type: 'success', message: 'File created.' },
                    { id: '3', type: 'success', message: 'File created.' },
                ]}
            />
        );

        expect(screen.getByText(/3 operations/i)).toBeInTheDocument();
        expect(screen.getByText(/File created\.\s*\(2x\)/i)).toBeInTheDocument();
    });
});
