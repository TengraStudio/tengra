/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
import { appLogger } from '@system/utils/renderer-logger';
import { IconAlertTriangle, IconBrain, IconChartBar, IconDatabase, IconListCheck, IconSearch } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/card';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LoadingState } from '@/components/ui/LoadingState';
import {
    SettingsTabHeader,
    SettingsTabLayout,
} from '@/features/settings/components/SettingsPrimitives';
import { useTranslation } from '@/i18n';
import { useMemoryInspectorHealthStore } from '@/store/memory-inspector-health.store';

import { useAddModal, useEditModal, useMemory } from '../hooks/useMemory';
import { MemoryVisualization } from '../visualization/MemoryVisualization';

import { AddMemoryModal } from './AddMemoryModal';
import { ConfirmedMemoriesList } from './ConfirmedMemoriesList';
import { EditMemoryModal } from './EditMemoryModal';
import { ErrorDisplay, MemoryHeader, StatsOverview } from './MemoryHeaderAndStats';
import { MemoryHistoryPanel } from './MemoryHistoryPanel';
import { MemorySearchFilter } from './MemorySearchFilter';
import { PendingMemoriesList } from './PendingMemoriesList';
import { StatsPanel } from './StatsPanelComponent';
import { TabNavigation } from './TabNavigation';

type TabType = 'pending' | 'confirmed' | 'archived' | 'stats' | 'visualization';

function buildFallbackStats(
    pendingMemories: PendingMemory[],
    confirmedMemories: AdvancedSemanticFragment[]
) {
    const allMemories = confirmedMemories;
    const byStatus = {
        pending: pendingMemories.length,
        confirmed: confirmedMemories.filter(memory => memory.status === 'confirmed').length,
        archived: confirmedMemories.filter(memory => memory.status === 'archived').length,
        contradicted: confirmedMemories.filter(memory => memory.status === 'contradicted').length,
        merged: confirmedMemories.filter(memory => memory.status === 'merged').length,
    };

    const byCategory = {
        preference: 0,
        personal: 0,
        workspace: 0,
        technical: 0,
        workflow: 0,
        relationship: 0,
        fact: 0,
        instruction: 0,
    };
    const bySource = {
        user_explicit: 0,
        user_implicit: 0,
        system: 0,
        conversation: 0,
        tool_result: 0,
    };

    for (const memory of allMemories) {
        byCategory[memory.category] += 1;
        bySource[memory.source] += 1;
    }

    const averageConfidence = allMemories.length > 0
        ? allMemories.reduce((sum, memory) => sum + memory.confidence, 0) / allMemories.length
        : 0;
    const averageImportance = allMemories.length > 0
        ? allMemories.reduce((sum, memory) => sum + memory.importance, 0) / allMemories.length
        : 0;

    return {
        total: allMemories.length + pendingMemories.length,
        byStatus,
        byCategory,
        bySource,
        averageConfidence,
        averageImportance,
        pendingValidation: pendingMemories.length,
        contradictions: allMemories.reduce((sum, memory) => sum + memory.contradictsIds.length, 0),
        recentlyAccessed: allMemories.filter(memory => Date.now() - memory.lastAccessedAt < 86_400_000).length,
        recentlyCreated: allMemories.filter(memory => Date.now() - memory.createdAt < 86_400_000).length,
        totalEmbeddingSize: allMemories.reduce((sum, memory) => sum + memory.embedding.length, 0),
    };
}

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
    effectiveStats: ReturnType<typeof buildFallbackStats>,
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
}> = ({ activeTab, memoryData, effectiveStats, filteredPending, filteredConfirmed, selectedIds, toggleSelect, selectAll, clearSelection, editModal, setSelectedIds, onShowHistory, onShare }) => {
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

    if (activeTab === 'stats') {
        return <div className="flex-1 min-h-0 overflow-auto"><StatsPanel stats={effectiveStats} health={memoryData.memoryHealth} /></div>;
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
    const memoryData = useMemory(searchQuery, activeTab);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [inspectingHistoryId, setInspectingHistoryId] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<MemoryVersion[]>([]);
    const [pendingShare, setPendingShare] = useState<{
        memoryId: string;
        workspaceId: string;
        workspaceTitle: string;
    } | null>(null);

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
            const allWorkspaces = await window.electron.db.getWorkspaces();
            const activeWorkspaces = allWorkspaces.filter(p => p.status === 'active');

            if (activeWorkspaces.length <= 1) {
                appLogger.info('MemoryInspector', 'No other workspaces to share with.');
                return;
            }

            const targetWorkspace = activeWorkspaces.find(p => p.id !== 'current'); // Mock logic
            if (targetWorkspace) {
                setPendingShare({
                    memoryId: id,
                    workspaceId: targetWorkspace.id,
                    workspaceTitle: targetWorkspace.title,
                });
            }
        } catch (error) {
            appLogger.error('MemoryInspector', 'Failed to share', error as Error);
        }
    }, []);

    const confirmShare = useCallback(async () => {
        if (!pendingShare) {
            return;
        }

        try {
            await memoryData.handleShare(pendingShare.memoryId, pendingShare.workspaceId);
            appLogger.info('MemoryInspector', 'Memory shared successfully');
        } catch (error) {
            appLogger.error('MemoryInspector', 'Failed to share', error as Error);
        } finally {
            setPendingShare(null);
        }
    }, [memoryData, pendingShare]);

    const cancelShare = useCallback(() => {
        setPendingShare(null);
    }, []);

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
        handleShare,
        pendingShare,
        confirmShare,
        cancelShare
    };
}

export const MemoryInspector: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');
    const [replaceOnImport, setReplaceOnImport] = useState(false);
    const [showReplaceImport, setShowReplaceImport] = useState(false);
    const memoryHealthStatus = useMemoryInspectorHealthStore(state => state.status);
    const memoryRuntime = useMemoryInspectorHealthStore(state => state.runtime);

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
        handleShare,
        pendingShare,
        confirmShare,
        cancelShare
    } = useMemoryInspectorLogic(searchQuery, activeTab, categoryFilter);

    const editModal = useEditModal();
    const addModal = useAddModal();
    const effectiveStats = useMemo(
        () => memoryData.stats ?? buildFallbackStats(memoryData.pendingMemories, memoryData.confirmedMemories),
        [memoryData.confirmedMemories, memoryData.pendingMemories, memoryData.stats]
    );
    const quickGuide = useMemo(() => ([
        {
            icon: IconListCheck,
            title: 'Review queue',
            description: 'New memories appear here first. Confirm the useful ones and reject the noisy ones.',
        },
        {
            icon: IconDatabase,
            title: 'Saved memory',
            description: 'Confirmed memories are what Tengra can bring back later during chats and tasks.',
        },
        {
            icon: IconSearch,
            title: 'Search and inspect',
            description: 'Use search to check what is already stored before deciding whether memory is working correctly.',
        },
    ]), []);

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
        <SettingsTabLayout className="bg-[radial-gradient(circle_at_top_left,rgba(var(--primary-rgb),0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
            <SettingsTabHeader
                title={t('frontend.settings.tabs.memory')}
                description="Review pending memories, inspect saved knowledge, and check whether memory retrieval is healthy."
                icon={IconBrain}
            />
            <MemoryHeader
                isLoading={memoryData.isLoading}
                healthStatus={memoryHealthStatus}
                runtime={memoryRuntime}
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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-4">
                    <StatsOverview stats={effectiveStats} />
                    <Card className="border-border/40 bg-background/70 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <IconBrain className="w-4 h-4 text-primary" />
                            <span>How this page works</span>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {quickGuide.map(item => (
                                <div key={item.title} className="rounded-xl border border-border/30 bg-muted/20 p-4">
                                    <item.icon className="h-5 w-5 text-primary" />
                                    <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
                <Card className="border-border/40 bg-background/70 p-5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <IconChartBar className="w-4 h-4 text-primary" />
                            <span>{t('frontend.memory.contextUsage')}</span>
                        </div>
                        {showReplaceImport && (
                            <label className="flex items-center gap-2 typo-caption text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={replaceOnImport}
                                    onChange={(event) => setReplaceOnImport(event.target.checked)}
                                    className="h-4 w-4 rounded border-border/40"
                                />
                                {t('frontend.memory.replaceOnImport')}
                            </label>
                        )}
                    </div>
                    <div className="mt-4 space-y-3">
                        <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('frontend.memory.contextPreviewCount')}</p>
                            <p className="mt-1 text-2xl font-semibold">{memoryData.contextPreview.length}</p>
                            <p className="mt-1 text-sm text-muted-foreground">Memories currently ready to be inserted into chat context.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('frontend.memory.totalSearchQueries')}</p>
                                <p className="mt-1 text-xl font-semibold">{memoryData.searchAnalytics?.totalQueries ?? 0}</p>
                            </div>
                            <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('frontend.memory.hybridSearchQueries')}</p>
                                <p className="mt-1 text-xl font-semibold">{memoryData.searchAnalytics?.hybridQueries ?? 0}</p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('frontend.memory.avgSearchResults')}</p>
                            <p className="mt-1 text-2xl font-semibold">{(memoryData.searchAnalytics?.averageResults ?? 0).toFixed(1)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">Average number of memories returned when Tengra searches past knowledge.</p>
                        </div>
                        {memoryHealthStatus === 'degraded' && (
                            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                                <div className="flex items-center gap-2 font-semibold">
                                    <IconAlertTriangle className="h-4 w-4" />
                                    <span>Memory needs attention</span>
                                </div>
                                <p className="mt-2 text-warning/90">
                                    Some memory requests failed or returned partial data. You can still review stored items below, but diagnostics may be incomplete until the service recovers.
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

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
                        confirmedCount={effectiveStats.byStatus.confirmed}
                        archivedCount={effectiveStats.byStatus.archived}
                    />
                </div>

                <div className="flex-1 min-h-0 flex gap-4">
                    <div className="flex-1 min-h-0">
                        <TabContent
                            activeTab={activeTab}
                            memoryData={memoryData}
                            effectiveStats={effectiveStats}
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
            <ConfirmationModal
                isOpen={pendingShare !== null}
                onClose={cancelShare}
                onConfirm={() => { void confirmShare(); }}
                title={t('common.confirm')}
                message={pendingShare?.workspaceTitle ?? ''}
                confirmLabel={t('common.confirm')}
                cancelText={t('common.cancel')}
                variant="info"
            />
        </SettingsTabLayout>
    );
};

