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

import { AdvancedSemanticFragment, MemoryCategory, MemoryVersion, PendingMemory } from '@shared/types/advanced-memory';
import { BarChart3 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { appLogger } from '../../../utils/renderer-logger';

import { LoadingState } from '@/components/ui/LoadingState';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';

import { useAddModal, useEditModal, useMemory } from '../hooks/useMemory';

import { AddMemoryModal } from './AddMemoryModal';
import { ConfirmedMemoriesList } from './ConfirmedMemoriesList';
import { EditMemoryModal } from './EditMemoryModal';
import { ErrorDisplay, MemoryHeader, StatsOverview } from './MemoryHeaderAndStats';
import { MemorySearchFilter } from './MemorySearchFilter';
import { PendingMemoriesList } from './PendingMemoriesList';
import { MemoryHistoryPanel } from './MemoryHistoryPanel';
import { StatsPanel } from './StatsPanelComponent';
import { TabNavigation } from './TabNavigation';
import { MemoryVisualization } from '../visualization/MemoryVisualization';

type TabType = 'pending' | 'confirmed' | 'archived' | 'stats' | 'visualization';

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
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
    onShowHistory: (id: string) => void,
    onShare: (id: string) => void
}> = ({ activeTab, memoryData, filteredPending, filteredConfirmed, selectedIds, toggleSelect, selectAll, clearSelection, editModal, setSelectedIds, onShowHistory, onShare }) => {
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
                onShowHistory={onShowHistory}
                onShare={onShare}
            />
        );
    }

    if (activeTab === 'visualization') {
        return <MemoryVisualization />;
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
                expiresAt={editModal.editExpiresAt}
                onContentChange={editModal.setEditContent}
                onCategoryChange={editModal.setEditCategory}
                onTagsChange={editModal.setEditTags}
                onImportanceChange={editModal.setEditImportance}
                onExpiresAtChange={editModal.setEditExpiresAt}
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
    const { t } = useTranslation();
    const memoryData = useMemory(searchQuery, activeTab);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [inspectingHistoryId, setInspectingHistoryId] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<MemoryVersion[]>([]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setSelectedIds(new Set());
        });
        return () => cancelAnimationFrame(frame);
    }, [activeTab]);

    const handleShowHistory = useCallback(async (id: string) => {
        try {
            const history = await memoryData.getHistory(id);
            setHistoryData(history);
            setInspectingHistoryId(id);
        } catch (error) {
            appLogger.error('MemoryInspector', 'Failed to load history', error as Error);
        }
    }, [memoryData]);

    const handleRollback = useCallback(async (versionIndex: number) => {
        if (!inspectingHistoryId) { return; }
        try {
            await memoryData.handleRollback(inspectingHistoryId, versionIndex);
            setInspectingHistoryId(null);
            void memoryData.loadData();
        } catch (error) {
            appLogger.error('MemoryInspector', 'Failed to rollback', error as Error);
        }
    }, [inspectingHistoryId, memoryData]);

    const handleShare = useCallback(async (id: string) => {
        try {
            const allProjects = await window.electron.db.getProjects();
            const activeProjects = allProjects.filter(p => p.status === 'active');

            if (activeProjects.length <= 1) {
                appLogger.info('MemoryInspector', 'No other projects to share with.');
                return;
            }

            const targetProject = activeProjects.find(p => p.id !== 'current'); // Mock logic
            if (targetProject) {
                // SAFETY: Using native confirm for critical action until custom UI modal is ready, 
                // but following project rules to minimize hardcoded strings.
                const confirmed = window.confirm(t('memory.share.confirm', { project: targetProject.title }) || `Share this memory with project "${targetProject.title}"?`);
                if (confirmed) {
                    await memoryData.handleShare(id, targetProject.id);
                    appLogger.info('MemoryInspector', 'Memory shared successfully');
                }
            }
        } catch (error) {
            appLogger.error('MemoryInspector', 'Failed to share', error as Error);
        }
    }, [memoryData, t]);

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
        handleSearch,
        inspectingHistoryId,
        setInspectingHistoryId,
        historyData,
        handleShowHistory,
        handleRollback,
        handleShare
    };
}

export const MemoryInspector: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');
    const [replaceOnImport, setReplaceOnImport] = useState(false);
    const [showReplaceImport, setShowReplaceImport] = useState(false);

    const {
        memoryData,
        selectedIds,
        setSelectedIds,
        filteredConfirmed,
        filteredPending,
        toggleSelect,
        selectAll,
        clearSelection,
        handleSearch,
        inspectingHistoryId,
        setInspectingHistoryId,
        historyData,
        handleShowHistory,
        handleRollback,
        handleShare
    } = useMemoryInspectorLogic(searchQuery, activeTab, categoryFilter);

    const editModal = useEditModal();
    const addModal = useAddModal();

    const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                void memoryData.handleImport(reader.result, replaceOnImport);
                setShowReplaceImport(false);
                setReplaceOnImport(false);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, [memoryData, replaceOnImport]);

    if (memoryData.isLoading && memoryData.pendingMemories.length === 0 && memoryData.confirmedMemories.length === 0) {
        return <div className="flex-1 flex items-center justify-center bg-background/50 backdrop-blur-xl"><LoadingState size="lg" /></div>;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background/50 backdrop-blur-xl overflow-hidden p-6 gap-6">
            <MemoryHeader
                isLoading={memoryData.isLoading}
                onRefresh={() => void memoryData.loadData()}
                onRunDecay={() => void memoryData.handleRunDecay()}
                onRecategorize={() => void memoryData.handleRecategorize()}
                onAddMemory={() => addModal.setShowAddMemory(true)}
                onExport={() => void memoryData.handleExport()}
                onImport={() => {
                    setShowReplaceImport(true);
                    const input = document.getElementById('memory-import-file') as HTMLInputElement | null;
                    input?.click();
                }}
            />
            <input
                id="memory-import-file"
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleFileImport}
            />

            {memoryData.error && <ErrorDisplay error={memoryData.error} />}
            {memoryData.stats && <StatsOverview stats={memoryData.stats} />}
            <Card className="p-4 bg-muted/20 border-white/5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        <span>{t('memory.contextUsage')}</span>
                    </div>
                    {showReplaceImport && (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={replaceOnImport}
                                onChange={(event) => setReplaceOnImport(event.target.checked)}
                            />
                            {t('memory.replaceOnImport')}
                        </label>
                    )}
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-md bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('memory.contextPreviewCount')}</p>
                        <p className="text-lg font-bold">{memoryData.contextPreview.length}</p>
                    </div>
                    <div className="rounded-md bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('memory.totalSearchQueries')}</p>
                        <p className="text-lg font-bold">{memoryData.searchAnalytics?.totalQueries ?? 0}</p>
                    </div>
                    <div className="rounded-md bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('memory.hybridSearchQueries')}</p>
                        <p className="text-lg font-bold">{memoryData.searchAnalytics?.hybridQueries ?? 0}</p>
                    </div>
                    <div className="rounded-md bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('memory.avgSearchResults')}</p>
                        <p className="text-lg font-bold">{(memoryData.searchAnalytics?.averageResults ?? 0).toFixed(1)}</p>
                    </div>
                </div>
            </Card>

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

                <div className="flex-1 min-h-0 flex gap-4">
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
                            onShowHistory={(id) => void handleShowHistory(id)}
                            onShare={(id) => void handleShare(id)}
                        />
                    </div>

                    {inspectingHistoryId && (
                        <MemoryHistoryPanel
                            history={historyData}
                            onRollback={(idx) => void handleRollback(idx)}
                            onClose={() => setInspectingHistoryId(null)}
                        />
                    )}
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
