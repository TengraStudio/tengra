/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FileSearchResult } from '@shared/types/common';
import React from 'react';

import { TerminalComponent } from '@/features/workspace/components/ide/Terminal';
import { WorkspaceEnvironmentTab } from '@/features/workspace/components/WorkspaceEnvironmentTab';
import { WorkspaceGitTab } from '@/features/workspace/components/WorkspaceGitTab';
import { WorkspaceSettingsPanel } from '@/features/workspace/components/WorkspaceSettingsPanel';
import { WorkspaceTodoTab } from '@/features/workspace/components/WorkspaceTodoTab';
import { Language } from '@/i18n';
import { Workspace, WorkspaceAnalysis, WorkspaceDashboardTab, WorkspaceStats } from '@/types';

import { OpenFile } from '../../hooks/useWorkspaceDashboardLogic';

import { AnalysisTab } from './AnalysisTab';
import { FilesTab } from './FilesTab';
import { OverviewTab } from './OverviewTab';
import { DangerZone, SearchResults } from './WorkspaceDashboardSubComponents';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEDASHBOARDTABS_1 = "px-4 py-1.5 bg-primary text-primary-foreground rounded-lg typo-caption font-medium hover:bg-primary/90 disabled:opacity-50";


interface WorkspaceDashboardTabsProps {
    activeTab: WorkspaceDashboardTab
    workspace: Workspace
    workspaceRoot: string
    analysis: WorkspaceAnalysis
    stats: WorkspaceStats | null
    loading: boolean
    t: (key: string) => string
    language: Language
    isEditingName: boolean
    isEditingDesc: boolean
    editName: string
    editDesc: string
    setIsEditingName: (v: boolean) => void
    setIsEditingDesc: (v: boolean) => void
    setEditName: (v: string) => void
    setEditDesc: (v: string) => void
    handleSaveName: () => void | Promise<void>
    handleSaveDesc: () => void | Promise<void>
    analyzeWorkspace: () => void | Promise<void>
    onOpenLogoGenerator?: () => void
    onDelete?: () => void
    searchQuery: string
    setSearchQuery: (v: string) => void
    isSearching: boolean
    handleSearch: () => Promise<void>
    searchResults: FileSearchResult[]
    handleFileSelect: (path: string, line?: number) => Promise<void>
    openFiles: OpenFile[]
    activeFile: string | null
    setActiveFile: (path: string | null) => void
    closeFile: (e: React.MouseEvent, path: string) => void
    setOpenFiles: (files: OpenFile[]) => void
    selectedFolder: string | null
    onUpdate: (updates: Partial<Workspace>) => Promise<void>
    formatBytes: (bytes: number) => string
    CodeCodeIcon: React.ComponentType<{ className?: string }>
}

export const WorkspaceDashboardTabsContent: React.FC<WorkspaceDashboardTabsProps> = (props) => {
    const {
        activeTab,
        workspace,
        workspaceRoot,
        t,
        language,
        onDelete,
        onUpdate,
        searchQuery,
        setSearchQuery,
        isSearching,
        handleSearch,
        searchResults,
        handleFileSelect
    } = props;

    // Use a record for tab content to significantly reduce cyclomatic complexity
    const tabContent: Record<string, React.ReactNode> = {
        overview: <OverviewTab {...props} />,
        files: <FilesTab {...props} />,
        analysis: <AnalysisTab {...props} />,
        todo: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <WorkspaceTodoTab
                    workspace={workspace}
                    onUpdate={onUpdate}
                    t={t}
                />
            </div>
        ),
        search: (
            <div className="space-y-6 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
                <div className="flex gap-2 p-1 bg-muted/10 rounded-xl border border-border/50">
                    <input
                        type="text"
                        placeholder={t('frontend.workspaceDashboard.searchInWorkspace')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { void handleSearch(); } }}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3"
                    />
                    <button
                        onClick={() => { void handleSearch(); }}
                        disabled={isSearching || searchQuery.trim().length < 2}
                        className={C_WORKSPACEDASHBOARDTABS_1}
                    >
                        {isSearching ? t('common.searching') : t('common.search')}
                    </button>
                </div>
                <SearchResults
                    results={searchResults}
                    workspaceRoot={workspaceRoot}
                    searchQuery={searchQuery}
                    onSelect={(path, line) => { void handleFileSelect(path, line); }}
                    t={t}
                />
            </div>
        ),
        terminal: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <TerminalComponent cwd={workspaceRoot} workspaceId={workspace.id} />
            </div>
        ),
        git: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <WorkspaceGitTab workspace={workspace} t={t} activeTab={activeTab} />
            </div>
        ),
        env: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <WorkspaceEnvironmentTab workspacePath={workspaceRoot} language={language} />
            </div>
        ),
        settings: (
            <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
                <WorkspaceSettingsPanel
                    workspace={workspace}
                    onUpdate={onUpdate}
                    language={language}
                    onAddMount={() => { }}
                    onRemoveMount={() => { }}
                />
                <DangerZone onDelete={() => { void onDelete?.(); }} t={t} />
            </div>
        )
    };

    return (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
            {tabContent[activeTab] ?? null}
        </div>
    );
};

export const formatBytes = (bytes: number) => {
    if (bytes === 0) { return '0 B'; }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const CodeCodeIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);
