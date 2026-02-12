import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
    ConfirmedMemoryCard,
    PendingMemoryCard,
} from '@/features/memory/components/MemorySubComponents';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('MemorySubComponents', () => {
    it('fires confirm/reject actions for pending memory card', () => {
        const onConfirm = vi.fn();
        const onReject = vi.fn();

        render(
            <PendingMemoryCard
                memory={{
                    id: 'pending-1',
                    content: 'Use dark mode',
                    embedding: [0.1],
                    source: 'user_implicit',
                    sourceId: 'msg-1',
                    sourceContext: 'user message',
                    extractedAt: Date.now(),
                    suggestedCategory: 'preference',
                    suggestedTags: ['ui'],
                    extractionConfidence: 0.9,
                    relevanceScore: 0.9,
                    noveltyScore: 0.8,
                    requiresUserValidation: true,
                    potentialContradictions: [],
                    similarMemories: [],
                }}
                onConfirm={onConfirm}
                onReject={onReject}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'memory.confirm' }));
        fireEvent.click(screen.getByRole('button', { name: 'memory.reject' }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onReject).toHaveBeenCalledTimes(1);
    });

    it('fires edit/archive/delete actions for confirmed memory card', () => {
        const onEdit = vi.fn();
        const onDelete = vi.fn();
        const onArchive = vi.fn();
        const onRestore = vi.fn();
        const onToggleSelect = vi.fn();

        render(
            <ConfirmedMemoryCard
                memory={{
                    id: 'mem-1',
                    content: 'Always use concise answers',
                    embedding: [0.2],
                    source: 'conversation',
                    sourceId: 'chat-1',
                    category: 'instruction',
                    tags: [],
                    confidence: 0.9,
                    importance: 0.8,
                    initialImportance: 0.8,
                    status: 'confirmed',
                    accessCount: 0,
                    lastAccessedAt: Date.now(),
                    relatedMemoryIds: [],
                    contradictsIds: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                }}
                isSelected={false}
                onToggleSelect={onToggleSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onArchive={onArchive}
                onRestore={onRestore}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'memory.select' }));
        fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));
        fireEvent.click(screen.getByRole('button', { name: 'memory.archive' }));
        fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));

        expect(onToggleSelect).toHaveBeenCalledTimes(1);
        expect(onEdit).toHaveBeenCalledTimes(1);
        expect(onArchive).toHaveBeenCalledTimes(1);
        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onRestore).toHaveBeenCalledTimes(0);
    });
});
