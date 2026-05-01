/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useState } from 'react';

import {
    loadWorkspaceListPreferences,
    saveWorkspaceListPreferences,
    useWorkspaceListStateMachine
} from '@/features/workspace/hooks/useWorkspaceListStateMachine';
import { WorkspaceSetupModal as WorkspaceSetupModal } from '@/features/workspace/workspace-setup/WorkspaceSetupModal';
import { Language, useTranslation } from '@/i18n';
import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceListContent } from './WorkspaceListContent';
import { WorkspaceModals } from './WorkspaceModals';

interface WorkspaceListPageProps {
    workspaces: Workspace[]
    onSelectWorkspace: (workspace: Workspace | null) => void
    language: Language
}

export const WorkspaceListPage: React.FC<WorkspaceListPageProps> = ({
    workspaces, onSelectWorkspace, language
}) => {
    const { t } = useTranslation(language);
    const LIST_SETTINGS_STORAGE_KEY = 'workspaces.listView.settings.v1';
    
    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [showWizard, setShowWizard] = useState(false);
    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'title' | 'updatedAt' | 'createdAt'>('updatedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [listPreset, setListPreset] = useState<'recent' | 'oldest' | 'name-az' | 'name-za'>('recent');

    // Preflight State

    // Preferences sync
    React.useEffect(() => {
        const saved = loadWorkspaceListPreferences(LIST_SETTINGS_STORAGE_KEY, { viewMode: 'grid', sortBy: 'updatedAt', sortDirection: 'desc', listPreset: 'recent' });
        setViewMode(saved.viewMode); setSortBy(saved.sortBy); setSortDirection(saved.sortDirection); setListPreset(saved.listPreset);
    }, []);

    React.useEffect(() => {
        saveWorkspaceListPreferences(LIST_SETTINGS_STORAGE_KEY, { viewMode, sortBy, sortDirection, listPreset });
    }, [viewMode, sortBy, sortDirection, listPreset]);

    // Filtering & Sorting
    const filteredWorkspaces = React.useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let list = [...workspaces];
        if (query) {list = list.filter(w => `${w.title} ${w.description}`.toLowerCase().includes(query));}
        const direction = sortDirection === 'asc' ? 1 : -1;
        return list.sort((a, b) => sortBy === 'title' ? a.title.localeCompare(b.title) * direction : (a[sortBy] - b[sortBy]) * direction);
    }, [workspaces, searchQuery, sortBy, sortDirection]);

    const sm = useWorkspaceListStateMachine({
        filteredWorkspaces,
        onError: (err: string) => appLogger.error('WorkspaceListPage', 'Operation failed', new Error(err))
    });

    const exportWorkspacesList = () => {
        const lines = [['title', 'path', 'updatedAt'].join(','), ...filteredWorkspaces.map(w => [w.title, w.path, w.updatedAt].join(','))];
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `workspaces.csv`; anchor.click(); URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col bg-background p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full space-y-8">
                <WorkspaceHeader
                    title={t('frontend.sidebar.workspaces')}
                    subtitle={t('frontend.workspaces.subtitle')}
                    newWorkspaceLabel={t('frontend.workspaces.createNew')}
                    searchPlaceholder={t('frontend.workspaces.searchPlaceholder')}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onNewWorkspace={() => setShowWizard(true)}
                    selectedCount={sm.state.selectedWorkspaceIds.size}
                    totalCount={filteredWorkspaces.length}
                    onToggleSelectAll={sm.toggleSelectAll}
                    onBulkDelete={sm.startBulkDelete}
                    onBulkArchive={sm.startBulkArchive}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    listPreset={listPreset}
                    onListPresetChange={(v) => setListPreset(v as 'recent' | 'oldest' | 'name-az' | 'name-za')}
                    onExportList={exportWorkspacesList}
                    t={t}
                    language={language}
                />

                <WorkspaceListContent
                    viewMode={viewMode}
                    workspaces={filteredWorkspaces}
                    onSelectWorkspace={onSelectWorkspace}
                    showWorkspaceMenu={showWorkspaceMenu}
                    setShowWorkspaceMenu={setShowWorkspaceMenu}
                    workspaceStateMachine={sm}
                    toggleSort={(s) => setSortBy(s)}
                    t={t}
                />


                <WorkspaceModals
                    editingWorkspace={sm.state.status === 'editing' ? sm.state.targetWorkspace : null}
                    setEditingWorkspace={(w) => w ? sm.startEdit(w) : sm.cancelEdit()}
                    deletingWorkspace={sm.state.status === 'deleting' ? sm.state.targetWorkspace : null}
                    setDeletingWorkspace={(w) => w ? sm.startDelete(w) : sm.cancelDelete()}
                    isArchiving={sm.state.status === 'archiving' ? sm.state.targetWorkspace : null}
                    setIsArchiving={(w) => w ? sm.startArchive(w) : sm.cancelArchive()}
                    isBulkDeleting={sm.state.status === 'bulk_deleting'}
                    setIsBulkDeleting={(v) => v ? sm.startBulkDelete() : sm.cancelBulkDelete()}
                    isBulkArchiving={sm.state.status === 'bulk_archiving'}
                    setIsBulkArchiving={(v) => v ? sm.startBulkArchive() : sm.cancelBulkArchive()}
                    selectedCount={sm.state.selectedWorkspaceIds.size}
                    editForm={sm.state.editForm}
                    setEditForm={sm.updateEditForm}
                    handleUpdateWorkspace={sm.executeUpdate}
                    handleDeleteWorkspace={sm.executeDelete}
                    handleArchiveWorkspace={sm.executeArchive}
                    handleBulkDelete={sm.executeBulkDelete}
                    handleBulkArchive={sm.executeBulkArchive}
                    t={t}
                />

                <WorkspaceSetupModal
                    isOpen={showWizard}
                    onClose={() => setShowWizard(false)}
                    onWorkspaceCreated={async (...a) => {
                        const s = await sm.executeCreate(...a);
                        if (s) {setShowWizard(false);}
                        return s;
                    }}
                    language={language}
                />
            </div>
        </div>
    );
};
