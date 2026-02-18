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
