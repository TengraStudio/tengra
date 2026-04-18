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

import { MemoryVisualization } from '@/features/memory/visualization/MemoryVisualization';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/features/memory/visualization/MemoryGraphView', () => ({
    MemoryGraphView: () => <div>graph-view</div>,
}));

vi.mock('@/features/memory/visualization/EntityRelationshipDiagram', () => ({
    EntityRelationshipDiagram: () => <div>entity-view</div>,
}));

vi.mock('@/features/memory/visualization/MemoryTimelineView', () => ({
    MemoryTimelineView: () => <div>timeline-view</div>,
}));

describe('MemoryVisualization', () => {
    it('switches between visualization tabs', () => {
        render(<MemoryVisualization />);

        expect(screen.getByText('graph-view')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'memory.entities' }));
        expect(screen.getByText('entity-view')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'memory.timeline' }));
        expect(screen.getByText('timeline-view')).toBeInTheDocument();
    });
});
