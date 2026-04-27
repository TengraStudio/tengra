/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { lazy, memo, useState } from 'react';

import { Language } from '@/i18n';
import { TerminalTab, Workspace } from '@/types';
import { performanceMonitor } from '@/utils/performance';


const WorkspaceDetails = lazy(() =>
    import('@/features/workspace/workspace-layout/WorkspaceDetails').then(m => ({
        default: m.WorkspaceDetails,
    }))
);
const WorkspaceListPage = lazy(() =>
    import('@/features/workspace/workspace-layout/WorkspaceListPage').then(m => ({
        default: m.WorkspaceListPage,
    }))
);
const WorkspaceModals = lazy(() =>
    import('@/features/workspace/workspace-layout/WorkspaceModals').then(m => ({
        default: m.WorkspaceModals,
    }))
);

interface WorkspacesPageProps {
    workspaces: Workspace[]
    selectedWorkspace?: Workspace | null
    onSelectWorkspace?: (workspace: Workspace | null) => void
    language: Language
    tabs: TerminalTab[]
    activeTabId: string | null
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabId: (id: string | null) => void
}

export const WorkspacesPage: React.FC<WorkspacesPageProps> = ({
    workspaces, selectedWorkspace, onSelectWorkspace, language, tabs, activeTabId, setTabs, setActiveTabId,
}) => {
    const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);

    const handleSelectWorkspace = (w: Workspace | null) => {
        if (w) {
            performanceMonitor.clear('workspace:');
            performanceMonitor.mark('workspace:open:start');
        }
        onSelectWorkspace?.(w);
    };

    if (selectedWorkspace) {
        return (
            <>
                <WorkspaceDetails
                    key={selectedWorkspace.id}
                    workspace={selectedWorkspace}
                    onBack={() => handleSelectWorkspace(null)}
                    onDeleteWorkspace={() => setDeletingWorkspace(selectedWorkspace)}
                    language={language}
                    tabs={tabs}
                    activeTabId={activeTabId}
                    setTabs={setTabs}
                    setActiveTabId={setActiveTabId}
                />
                {deletingWorkspace && (
                    <WorkspaceModals
                        editingWorkspace={null}
                        setEditingWorkspace={() => { }}
                        deletingWorkspace={deletingWorkspace}
                        setDeletingWorkspace={setDeletingWorkspace}
                        isArchiving={null}
                        setIsArchiving={() => { }}
                        isBulkDeleting={false}
                        setIsBulkDeleting={() => { }}
                        isBulkArchiving={false}
                        setIsBulkArchiving={() => { }}
                        selectedCount={0}
                        editForm={{ title: '', description: '' }}
                        setEditForm={() => { }}
                        handleUpdateWorkspace={async () => false}
                        handleDeleteWorkspace={async (deleteFiles) => {
                            if (!deletingWorkspace) {return;}
                            await window.electron.db.deleteWorkspace(deletingWorkspace.id, deleteFiles);
                            setDeletingWorkspace(null);
                            handleSelectWorkspace(null);
                        }}
                        handleArchiveWorkspace={async () => { }}
                        handleBulkDelete={async () => { }}
                        handleBulkArchive={async () => { }}
                        t={(key) => key}
                    />
                )}
            </>
        );
    }

    return (
        <WorkspaceListPage
            workspaces={workspaces}
            onSelectWorkspace={handleSelectWorkspace}
            language={language}
        />
    );
};

export const MemoizedWorkspacesPage = memo(WorkspacesPage);

