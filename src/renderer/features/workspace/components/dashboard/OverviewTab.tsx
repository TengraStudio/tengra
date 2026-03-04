import React from 'react';

import { Language } from '@/i18n';
import { Project, ProjectAnalysis, ProjectStats } from '@/types';

import { ProjectOverviewHeader, ProjectStatsCards } from './WorkspaceOverview';

interface OverviewTabProps {
    project: Project;
    projectRoot: string;
    analysis: ProjectAnalysis;
    stats: ProjectStats | null;
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
    analyzeProject: () => void | Promise<void>;
    onOpenLogoGenerator?: () => void;
    formatBytes: (bytes: number) => string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
    project,
    projectRoot,
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
    analyzeProject,
    onOpenLogoGenerator,
    formatBytes
}) => {
    return (
        <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
            <ProjectOverviewHeader
                project={project}
                projectRoot={projectRoot}
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
                onAnalyze={() => { void analyzeProject(); }}
                onOpenLogoGenerator={onOpenLogoGenerator}
                t={t}
            />

            <ProjectStatsCards
                stats={stats}
                analysis={analysis}
                t={t}
                formatBytes={formatBytes}
            />
        </div>
    );
};
