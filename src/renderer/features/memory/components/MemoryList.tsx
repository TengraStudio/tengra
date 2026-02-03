import { AdvancedSemanticFragment, MemoryStatistics, PendingMemory } from '@shared/types/advanced-memory';
import { Archive, CheckCircle, Clock } from 'lucide-react';
import { CSSProperties, useCallback, useMemo } from 'react';
import { List, RowComponentProps } from 'react-window';

import { TabType } from '../hooks/useMemoryLogic';

import { ConfirmedMemoryCard, EmptyState, PendingMemoryCard } from './MemorySubComponents';
import { StatsPanel } from './StatsPanel';

// PERF-001-1: Virtualization threshold - use virtualization when list exceeds this
const VIRTUALIZATION_THRESHOLD = 50;
const ITEM_HEIGHT = 120; // Approximate height of memory cards in pixels
const LIST_HEIGHT = 600; // Default list container height

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
    /** Optional: height of the list container for virtualization */
    listHeight?: number;
}

interface PendingRowProps {
    items: PendingMemory[];
    onConfirm: (id: string) => void;
    onReject: (id: string) => void;
}

interface ConfirmedRowProps {
    items: AdvancedSemanticFragment[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onEdit: (memory: AdvancedSemanticFragment) => void;
    onDelete: (id: string) => void;
    onArchive: (id: string) => void;
    onRestore: (id: string) => void;
}

/**
 * PERF-001-1: Virtualized row renderer for pending memories
 */
const PendingRow = ({ index, style, items, onConfirm, onReject }: RowComponentProps<PendingRowProps> & { index: number; style: CSSProperties }) => {
    const memory = items[index];

    return (
        <div style={style}>
            <PendingMemoryCard
                memory={memory}
                onConfirm={() => onConfirm(memory.id)}
                onReject={() => onReject(memory.id)}
            />
        </div>
    );
};

/**
 * PERF-001-1: Virtualized row renderer for confirmed memories
 */
const ConfirmedRow = ({ index, style, items, selectedIds, onToggleSelect, onEdit, onDelete, onArchive, onRestore }: RowComponentProps<ConfirmedRowProps> & { index: number; style: CSSProperties }) => {
    const memory = items[index];

    return (
        <div style={style}>
            <ConfirmedMemoryCard
                memory={memory}
                isSelected={selectedIds.has(memory.id)}
                onToggleSelect={() => onToggleSelect(memory.id)}
                onEdit={() => onEdit(memory)}
                onDelete={() => onDelete(memory.id)}
                onArchive={() => onArchive(memory.id)}
                onRestore={() => onRestore(memory.id)}
            />
        </div>
    );
};

export const MemoryList = ({
    activeTab, filteredPending, filteredConfirmed, stats, selectedIds,
    onConfirm, onReject, onToggleSelect, onEdit, onDelete, onArchive, onRestore,
    listHeight = LIST_HEIGHT
}: MemoryListProps) => {
    // Memoize row props to prevent unnecessary re-renders
    const pendingRowProps = useMemo<PendingRowProps>(() => ({
        items: filteredPending,
        onConfirm,
        onReject
    }), [filteredPending, onConfirm, onReject]);

    const confirmedRowProps = useMemo<ConfirmedRowProps>(() => ({
        items: filteredConfirmed,
        selectedIds,
        onToggleSelect,
        onEdit,
        onDelete,
        onArchive,
        onRestore
    }), [filteredConfirmed, selectedIds, onToggleSelect, onEdit, onDelete, onArchive, onRestore]);

    // PERF-001-1: Use virtualization for large lists
    const shouldVirtualizePending = filteredPending.length > VIRTUALIZATION_THRESHOLD;
    const shouldVirtualizeConfirmed = filteredConfirmed.length > VIRTUALIZATION_THRESHOLD;

    // Memoized row component creators
    const PendingRowComponent = useCallback(
        (props: RowComponentProps<PendingRowProps>) => <PendingRow {...props} {...pendingRowProps} />,
        [pendingRowProps]
    );

    const ConfirmedRowComponent = useCallback(
        (props: RowComponentProps<ConfirmedRowProps>) => <ConfirmedRow {...props} {...confirmedRowProps} />,
        [confirmedRowProps]
    );

    if (activeTab === 'pending') {
        if (filteredPending.length === 0) {
            return <EmptyState icon={Clock} title="No Pending Memories" description="Extracted facts will appear here." />;
        }

        // PERF-001-1: Use virtualized list for large datasets
        if (shouldVirtualizePending) {
            return (
                <List
                    style={{ height: listHeight }}
                    rowCount={filteredPending.length}
                    rowHeight={ITEM_HEIGHT}
                    rowComponent={PendingRowComponent}
                    rowProps={pendingRowProps}
                    overscanCount={5}
                />
            );
        }

        // Regular rendering for small lists
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

    // PERF-001-1: Use virtualized list for large datasets
    if (shouldVirtualizeConfirmed) {
        return (
            <List
                style={{ height: listHeight }}
                rowCount={filteredConfirmed.length}
                rowHeight={ITEM_HEIGHT}
                rowComponent={ConfirmedRowComponent}
                rowProps={confirmedRowProps}
                overscanCount={5}
            />
        );
    }

    // Regular rendering for small lists
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
