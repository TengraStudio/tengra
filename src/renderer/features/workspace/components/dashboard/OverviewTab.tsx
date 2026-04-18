/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { Language } from '@/i18n';
import { Workspace, WorkspaceAnalysis, WorkspaceStats } from '@/types';

import { WorkspaceOverviewHeader, WorkspaceStatsCards } from './WorkspaceOverview';

interface OverviewTabProps {
    workspace: Workspace;
    workspaceRoot: string;
    analysis: WorkspaceAnalysis;
    stats: WorkspaceStats | null;
    loading: boolean;
    t: (key: string) => string;
    language: Language;
    isEditingName: boolean;
    isEditingDesc: boolean;
    editName: string;
    editDesc: string;
    setIsEditingName: (v: boolean) => void;
    setIsEditingDesc: (v: boolean) => void;
    setEditName: (v: string) => void;
    setEditDesc: (v: string) => void;
    handleSaveName: () => void | Promise<void>;
    handleSaveDesc: () => void | Promise<void>;
    analyzeWorkspace: () => void | Promise<void>;
    onOpenLogoGenerator?: () => void;
    formatBytes: (bytes: number) => string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
    workspace,
    workspaceRoot,
    analysis,
    stats,
    loading,
    t,
    isEditingName,
    isEditingDesc,
    editName,
    editDesc,
    setIsEditingName,
    setIsEditingDesc,
    setEditName,
    setEditDesc,
    handleSaveName,
    handleSaveDesc,
    analyzeWorkspace,
    onOpenLogoGenerator,
    formatBytes
}) => {
    return (
        <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
            <WorkspaceOverviewHeader
                workspace={workspace}
                workspaceRoot={workspaceRoot}
                analysis={analysis}
                loading={loading}
                isEditingName={isEditingName}
                isEditingDesc={isEditingDesc}
                editName={editName}
                editDesc={editDesc}
                onEditName={setIsEditingName}
                onEditDesc={setIsEditingDesc}
                onSetName={setEditName}
                onSetDesc={setEditDesc}
                onSaveName={() => { void handleSaveName(); }}
                onSaveDesc={() => { void handleSaveDesc(); }}
                onAnalyze={() => { void analyzeWorkspace(); }}
                onOpenLogoGenerator={onOpenLogoGenerator}
                t={t}
            />

            <WorkspaceStatsCards
                stats={stats}
                analysis={analysis}
                t={t}
                formatBytes={formatBytes}
            />
        </div>
    );
};
