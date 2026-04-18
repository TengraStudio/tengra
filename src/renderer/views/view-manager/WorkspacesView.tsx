/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { lazy, Suspense } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';
import { Language } from '@/i18n';
import { TerminalTab, Workspace } from '@/types';

const WorkspacesPage = lazy(() => import('@/features/workspace/WorkspacePage').then(m => ({ default: m.WorkspacesPage })));

interface WorkspaceViewProps {
    workspaces: Workspace[]
    selectedWorkspace: Workspace | null
    onSelectWorkspace: (p: Workspace | null) => void
    language: Language
    terminalTabs: TerminalTab[]
    activeTerminalId: string | null
    setTerminalTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabId: (id: string | null) => void
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
    workspaces,
    selectedWorkspace,
    onSelectWorkspace,
    language,
    terminalTabs,
    activeTerminalId,
    setTerminalTabs,
    setActiveTabId,
}) => {
    return (
        <Suspense fallback={<LoadingState size="md" />}>
            <WorkspacesPage
                workspaces={workspaces}
                selectedWorkspace={selectedWorkspace}
                onSelectWorkspace={onSelectWorkspace}
                language={language}
                tabs={terminalTabs}
                activeTabId={activeTerminalId}
                setTabs={setTerminalTabs}
                setActiveTabId={setActiveTabId}
            />
        </Suspense>
    );
};

WorkspaceView.displayName = 'WorkspaceView';
