/**
 * Advanced Memory Inspector
 *
 * A sophisticated UI for the advanced memory system with:
 * - Pending memories (staging buffer) with validation controls
 * - Memory statistics and health metrics
 * - Category filtering and context-aware search
 * - Contradiction and similarity indicators
 * - Delete, edit, and bulk operations
 */

import { AdvancedSemanticFragment, MemoryCategory, PendingMemory } from '@shared/types/advanced-memory';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';

import { useAddModal, useEditModal, useMemory } from '../hooks/useMemory';

import { AddMemoryModal } from './AddMemoryModal';
import { ConfirmedMemoriesList } from './ConfirmedMemoriesList';
import { EditMemoryModal } from './EditMemoryModal';
import { ErrorDisplay, MemoryHeader, StatsOverview } from './MemoryHeaderAndStats';
import { MemorySearchFilter } from './MemorySearchFilter';
import { PendingMemoriesList } from './PendingMemoriesList';
import { StatsPanel } from './StatsPanelComponent';
import { TabNavigation } from './TabNavigation';

type TabType = 'pending' | 'confirmed' | 'archived' | 'stats';

// Filter helpers
function filterConfirmedMemories(
    memories: AdvancedSemanticFragment[],
    categoryFilter: MemoryCategory | 'all',
    activeTab: TabType
): AdvancedSemanticFragment[] {
    return memories.filter(m => {
        if (categoryFilter !== 'all' && m.category !== categoryFilter) { return false; }
        if (activeTab === 'archived' && m.status !== 'archived') { return false; }
        if (activeTab === 'confirmed' && m.status !== 'confirmed') { return false; }
        return true;
    });
}

function filterPendingMemories(
    memories: PendingMemory[],
    categoryFilter: MemoryCategory | 'all'
): PendingMemory[] {
    if (categoryFilter === 'all') { return memories; }
    return memories.filter(m => m.suggestedCategory === categoryFilter);
}

const TabContent: React.FC<{
    activeTab: TabType,
    memoryData: ReturnType<typeof useMemory>,
    filteredPending: PendingMemory[],
    filteredConfirmed: AdvancedSemanticFragment[],
    selectedIds: Set<string>,
    toggleSelect: (id: string) => void,
    selectAll: () => void,
    clearSelection: () => void,
    editModal: ReturnType<typeof useEditModal>,
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
}> = ({ activeTab, memoryData, filteredPending, filteredConfirmed, selectedIds, toggleSelect, selectAll, clearSelection, editModal, setSelectedIds }) => {
    if (activeTab === 'pending') {
        return (
            <PendingMemoriesList
                memories={filteredPending}
                isLoading={memoryData.isLoading}
                onConfirmAll={() => void memoryData.handleConfirmAll()}
                onRejectAll={() => void memoryData.handleRejectAll()}
                onConfirm={(id) => void memoryData.handleConfirm(id)}
                onReject={(id) => void memoryData.handleReject(id)}
            />
        );
    }

    if (activeTab === 'confirmed' || activeTab === 'archived') {
        return (
            <ConfirmedMemoriesList
                memories={filteredConfirmed}
                selectedIds={selectedIds}
                isArchiveTab={activeTab === 'archived'}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                onEdit={editModal.openEditModal}
                onDelete={(id) => void memoryData.handleDelete(id, setSelectedIds)}
                onArchive={(id) => void memoryData.handleArchive(id)}
                onRestore={(id) => void memoryData.handleRestore(id)}
                onArchiveSelected={() => void memoryData.handleArchiveSelected(selectedIds, setSelectedIds)}
                onDeleteSelected={() => void memoryData.handleDeleteSelected(selectedIds, setSelectedIds)}
            />
        );
    }

    if (memoryData.stats) {
        return <div className="flex-1 min-h-0 overflow-auto"><StatsPanel stats={memoryData.stats} /></div>;
    }

    return null;
};

const InspectorModals: React.FC<{
    editModal: ReturnType<typeof useEditModal>,
    addModal: ReturnType<typeof useAddModal>,
    loadData: () => Promise<void>
}> = ({ editModal, addModal, loadData }) => (
    <>
        {editModal.editingMemory && (
            <EditMemoryModal
                content={editModal.editContent}
                category={editModal.editCategory}
                tags={editModal.editTags}
                importance={editModal.editImportance}
                onContentChange={editModal.setEditContent}
                onCategoryChange={editModal.setEditCategory}
                onTagsChange={editModal.setEditTags}
                onImportanceChange={editModal.setEditImportance}
                onSave={() => void editModal.handleSaveEdit(loadData)}
                onCancel={editModal.closeEditModal}
            />
        )}

        {addModal.showAddMemory && (
            <AddMemoryModal
                content={addModal.newMemoryContent}
                category={addModal.newMemoryCategory}
                tags={addModal.newMemoryTags}
                onContentChange={addModal.setNewMemoryContent}
                onCategoryChange={addModal.setNewMemoryCategory}
                onTagsChange={addModal.setNewMemoryTags}
                onAdd={() => void addModal.handleAddMemory(loadData)}
                onCancel={() => addModal.setShowAddMemory(false)}
            />
        )}
    </>
);

function useMemoryInspectorLogic(
    searchQuery: string,
    activeTab: TabType,
    categoryFilter: MemoryCategory | 'all'
) {
    const memoryData = useMemory(searchQuery, activeTab);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setSelectedIds(new Set());
        });
        return () => cancelAnimationFrame(frame);
    }, [activeTab]);

    const filteredConfirmed = useMemo(
        () => filterConfirmedMemories(memoryData.confirmedMemories, categoryFilter, activeTab),
        [memoryData.confirmedMemories, categoryFilter, activeTab]
    );
    const filteredPending = useMemo(
        () => filterPendingMemories(memoryData.pendingMemories, categoryFilter),
        [memoryData.pendingMemories, categoryFilter]
    );

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(new Set(filteredConfirmed.map(m => m.id)));
    }, [filteredConfirmed]);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        void memoryData.loadData();
    }, [memoryData]);

    return {
        memoryData,
        selectedIds,
        setSelectedIds,
        filteredConfirmed,
        filteredPending,
        toggleSelect,
        selectAll,
        clearSelection,
        handleSearch
    };
}

export const MemoryInspector: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');

    const {
        memoryData,
        selectedIds,
        setSelectedIds,
        filteredConfirmed,
        filteredPending,
        toggleSelect,
        selectAll,
        clearSelection,
        handleSearch
    } = useMemoryInspectorLogic(searchQuery, activeTab, categoryFilter);

    const editModal = useEditModal();
    const addModal = useAddModal();

    if (memoryData.isLoading && memoryData.pendingMemories.length === 0 && memoryData.confirmedMemories.length === 0) {
        return <div className="flex-1 flex items-center justify-center bg-background/50 backdrop-blur-xl"><LoadingState size="lg" /></div>;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background/50 backdrop-blur-xl overflow-hidden p-6 gap-6">
            <MemoryHeader
                isLoading={memoryData.isLoading}
                onRefresh={() => void memoryData.loadData()}
                onRunDecay={() => void memoryData.handleRunDecay()}
                onAddMemory={() => addModal.setShowAddMemory(true)}
            />

            {memoryData.error && <ErrorDisplay error={memoryData.error} />}
            {memoryData.stats && <StatsOverview stats={memoryData.stats} />}

            <MemorySearchFilter
                searchQuery={searchQuery}
                categoryFilter={categoryFilter}
                onSearchChange={setSearchQuery}
                onCategoryChange={setCategoryFilter}
                onSearch={handleSearch}
            />

            <div className="flex-1 flex flex-col gap-4 min-h-0">
                <div className="flex items-center justify-between">
                    <TabNavigation
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        pendingCount={memoryData.pendingMemories.length}
                        confirmedCount={memoryData.stats?.byStatus.confirmed ?? 0}
                        archivedCount={memoryData.stats?.byStatus.archived ?? 0}
                    />
                </div>

                <div className="flex-1 min-h-0">
                    <TabContent
                        activeTab={activeTab}
                        memoryData={memoryData}
                        filteredPending={filteredPending}
                        filteredConfirmed={filteredConfirmed}
                        selectedIds={selectedIds}
                        toggleSelect={toggleSelect}
                        selectAll={selectAll}
                        clearSelection={clearSelection}
                        editModal={editModal}
                        setSelectedIds={setSelectedIds}
                    />
                </div>
            </div>

            <InspectorModals
                editModal={editModal}
                addModal={addModal}
                loadData={memoryData.loadData}
            />
        </div>
    );
};
