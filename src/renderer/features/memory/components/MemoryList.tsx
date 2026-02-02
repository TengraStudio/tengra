import { AdvancedSemanticFragment, MemoryStatistics, PendingMemory } from '@shared/types/advanced-memory';
import { Archive, CheckCircle, Clock } from 'lucide-react';
import React from 'react';

import { TabType } from '../hooks/useMemoryLogic';

import { ConfirmedMemoryCard, EmptyState, PendingMemoryCard } from './MemorySubComponents';
import { StatsPanel } from './StatsPanel';

interface MemoryListProps {
    activeTab: TabType;
    filteredPending: PendingMemory[];
    filteredConfirmed: AdvancedSemanticFragment[];
    stats: MemoryStatistics | null;
    selectedIds: Set<string>;
    onConfirm: (id: string) => void;
    onReject: (id: string) => void;
    onToggleSelect: (id: string) => void;
    onEdit: (memory: AdvancedSemanticFragment) => void;
    onDelete: (id: string) => void;
    onArchive: (id: string) => void;
    onRestore: (id: string) => void;
}

export const MemoryList = ({
    activeTab, filteredPending, filteredConfirmed, stats, selectedIds,
    onConfirm, onReject, onToggleSelect, onEdit, onDelete, onArchive, onRestore
}: MemoryListProps) => {
    if (activeTab === 'pending') {
        if (filteredPending.length === 0) {
            return <EmptyState icon={Clock} title="No Pending Memories" description="Extracted facts will appear here." />;
        }
        return (
            <>
                {filteredPending.map(m => (
                    <PendingMemoryCard key={m.id} memory={m} onConfirm={() => onConfirm(m.id)} onReject={() => onReject(m.id)} />
                ))}
            </>
        );
    }

    if (activeTab === 'stats') {
        return stats ? <StatsPanel stats={stats} /> : null;
    }

    if (filteredConfirmed.length === 0) {
        return <EmptyState icon={activeTab === 'archived' ? Archive : CheckCircle} title="Empty" description="Nothing here yet." />;
    }

    return (
        <>
            {filteredConfirmed.map(m => (
                <ConfirmedMemoryCard
                    key={m.id}
                    memory={m}
                    isSelected={selectedIds.has(m.id)}
                    onToggleSelect={() => onToggleSelect(m.id)}
                    onEdit={() => onEdit(m)}
                    onDelete={() => onDelete(m.id)}
                    onArchive={() => onArchive(m.id)}
                    onRestore={() => onRestore(m.id)}
                />
            ))}
        </>
    );
};
