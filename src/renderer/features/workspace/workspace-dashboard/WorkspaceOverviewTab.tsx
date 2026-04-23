/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WorkspaceDashboardHeader } from '@renderer/features/workspace/components/WorkspaceDashboardHeader';
import { WorkspaceStatsCards } from '@renderer/features/workspace/components/WorkspaceStatsCards';

import type { Workspace, WorkspaceAnalysis, WorkspaceStats } from '@/types';

function formatLanguagePercentage(count: number, totalLanguageWeight: number): string {
    if (totalLanguageWeight <= 0) {
        return '0%';
    }

    const rawPercentage = (count / totalLanguageWeight) * 100;
    if (rawPercentage >= 1) {
        return `${rawPercentage.toFixed(1)}%`;
    }
    return `${rawPercentage}%`;
}

interface WorkspaceOverviewTabProps {
    workspace: Workspace;
    workspaceRoot: string;
    analysis: WorkspaceAnalysis | null;
    stats: WorkspaceStats | null;
    loading: boolean;
    isEditingName: boolean;
    setIsEditingName: (v: boolean) => void;
    editName: string;
    setEditName: (v: string) => void;
    handleSaveName: () => Promise<void>;
    isEditingDesc: boolean;
    setIsEditingDesc: (v: boolean) => void;
    editDesc: string;
    setEditDesc: (v: string) => void;
    handleSaveDesc: () => Promise<void>;
    onUploadLogo?: () => void;
    analyzeWorkspace: () => Promise<void>;
    onDelete?: () => void;
    t: (key: string) => string;
}

export const WorkspaceOverviewTab = ({
    workspace,
    workspaceRoot,
    analysis,
    stats,
    loading,
    isEditingName,
    setIsEditingName,
    editName,
    setEditName,
    handleSaveName,
    isEditingDesc,
    setIsEditingDesc,
    editDesc,
    setEditDesc,
    handleSaveDesc,
    onUploadLogo,
    analyzeWorkspace,
    t
}: WorkspaceOverviewTabProps) => {
    if (!analysis) {
        return null;
    }

    const totalLanguageWeight = Object.values(analysis.languages).reduce(
        (sum, value) => sum + (typeof value === 'number' ? value : 0),
        0
    );

    return (
        <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
            <WorkspaceDashboardHeader
                workspace={workspace}
                workspaceRoot={workspaceRoot}
                type={analysis.type}
                loading={loading}
                isEditingName={isEditingName}
                setIsEditingName={setIsEditingName}
                editName={editName}
                setEditName={setEditName}
                handleSaveName={handleSaveName}
                isEditingDesc={isEditingDesc}
                setIsEditingDesc={setIsEditingDesc}
                editDesc={editDesc}
                setEditDesc={setEditDesc}
                handleSaveDesc={handleSaveDesc}
                onUploadLogo={onUploadLogo}
                analyzeWorkspace={analyzeWorkspace}
            />

            <WorkspaceStatsCards
                stats={stats}
                type={analysis.type}
                moduleCount={analysis.monorepo?.packages.length ?? Object.keys(analysis.dependencies).length}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {t('workspaceDashboard.techStack')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full border border-primary/20 bg-primary/5 typo-overline font-semibold text-primary">
                            {analysis.type}
                        </span>
                        {analysis.monorepo && (
                            <span className="px-3 py-1 rounded-full border border-border/60 bg-muted/20 typo-overline font-semibold text-foreground/80">
                                {analysis.monorepo.type}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {analysis.frameworks.map((fw: string) => (
                            <span key={fw} className="px-3 py-1 bg-muted/30 border border-border rounded-full typo-caption text-primary font-medium">
                                {fw}
                            </span>
                        ))}
                        {analysis.frameworks.length === 0 && <span className="typo-caption text-muted-foreground">{t('workspaceDashboard.noFrameworks')}</span>}
                    </div>
                </div>

                <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        {t('workspaceDashboard.langDist')}
                    </h3>
                    <div className="space-y-3 max-h-250 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                        {Object.entries(analysis.languages)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .slice(0, 15)
                            .map(([lang, count]) => {
                                const percentage =
                                    totalLanguageWeight > 0
                                        ? ((count as number) / totalLanguageWeight) * 100
                                        : 0;
                                return (
                                    <div key={lang} className="space-y-1">
                                        <div className="flex justify-between text-xxs font-bold">
                                            <span className="text-foreground/80">{lang}</span>
                                            <span className="text-muted-foreground">{formatLanguagePercentage(count as number, totalLanguageWeight)}</span>
                                        </div>
                                        <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-success/50 rounded-full" style={{ width: `${percentage}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            {analysis.todos.length > 0 && (
                <div className="bg-card/40 rounded-2xl border border-border/50 p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                        {t('workspaceDashboard.todoList')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {analysis.todos.map((todo: string, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-muted/10 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors">
                                <div className="w-4 h-4 rounded border border-border/50 mt-0.5 flex-shrink-0" />
                                <span className="typo-caption text-foreground/80 line-clamp-2">{todo}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
