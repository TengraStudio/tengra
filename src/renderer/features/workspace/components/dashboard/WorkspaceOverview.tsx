/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Camera, Check, Pencil, RefreshCw, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Workspace, WorkspaceAnalysis, WorkspaceStats } from '@/types';
import { toSafeFileUrl } from '@/utils/safe-file-url.util';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEOVERVIEW_1 = "w-32 h-32 rounded-2xl bg-muted/40 border-2 border-dashed border-border flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/50 shadow-inner";
const C_WORKSPACEOVERVIEW_2 = "absolute inset-0 bg-primary/60 backdrop-blur-2 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 text-primary-foreground sm:flex-row";
const C_WORKSPACEOVERVIEW_3 = "text-sm text-muted-foreground leading-relaxed cursor-pointer hover:text-foreground transition-colors max-w-2xl flex items-start gap-2";
const C_WORKSPACEOVERVIEW_4 = "p-2 rounded-lg bg-muted/20 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all flex items-center gap-2 typo-caption";


interface WorkspaceOverviewHeaderProps {
    workspace: Workspace
    workspaceRoot: string
    analysis: WorkspaceAnalysis
    loading: boolean
    isEditingName: boolean
    isEditingDesc: boolean
    editName: string
    editDesc: string
    onEditName: (editing: boolean) => void
    onEditDesc: (editing: boolean) => void
    onSetName: (name: string) => void
    onSetDesc: (desc: string) => void
    onSaveName: () => void
    onSaveDesc: () => void
    onAnalyze: () => void
    onOpenLogoGenerator?: () => void
    t: (key: string) => string
}

export function WorkspaceOverviewHeader({
    workspace,
    workspaceRoot,
    analysis,
    loading,
    isEditingName,
    isEditingDesc,
    editName,
    editDesc,
    onEditName,
    onEditDesc,
    onSetName,
    onSetDesc,
    onSaveName,
    onSaveDesc,
    onAnalyze,
    onOpenLogoGenerator,
    t
}: WorkspaceOverviewHeaderProps) {
    const baseLogoUrl = toSafeFileUrl(workspace.logo);
    const workspaceLogoUrl = baseLogoUrl && baseLogoUrl.startsWith('data:') ? baseLogoUrl : (baseLogoUrl ? `${baseLogoUrl}?t=${workspace.updatedAt}` : null);

    return (
        <div className="flex flex-col md:flex-row gap-8 items-start bg-card/40 p-6 rounded-3xl border border-border backdrop-blur-sm">
            {/* Logo Area */}
            <div className="relative group shrink-0">
                <div className={C_WORKSPACEOVERVIEW_1}>
                    {workspaceLogoUrl ? (
                        <img src={workspaceLogoUrl} alt={t('workspaces.logoAlt')} className="w-full h-full object-cover" />
                    ) : (
                        <Sparkles className="w-10 h-10 text-muted-foreground/20" />
                    )}

                    <button
                        onClick={onOpenLogoGenerator}
                        className={C_WORKSPACEOVERVIEW_2}
                    >
                        <Camera className="w-6 h-6" />
                        <span className="text-xxs font-bold">{t('workspaces.changeLogo')}</span>
                    </button>
                </div>
            </div>

            {/* Name & Description Area */}
            <div className="flex-1 space-y-4 w-full">
                <div className="space-y-1 group">
                    {isEditingName ? (
                        <div className="flex items-center gap-2">
                            <input
                                autoFocus
                                value={editName}
                                onChange={e => onSetName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') { onSaveName(); }
                                    if (e.key === 'Escape') { onEditName(false); }
                                }}
                                onBlur={() => onSaveName()}
                                className="text-3xl font-bold bg-transparent border border-primary/50 rounded-lg px-2 py-1 outline-none w-full text-foreground"
                            />
                            <button onClick={onSaveName} className="p-2 bg-primary text-primary-foreground rounded-lg">
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <h1
                            onClick={() => onEditName(true)}
                            className="text-4xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-3"
                        >
                            {workspace.title}
                            <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </h1>
                    )}
                </div>

                <div className="group">
                    {isEditingDesc ? (
                        <div className="space-y-2">
                            <textarea
                                autoFocus
                                value={editDesc}
                                onChange={e => onSetDesc(e.target.value)}
                                onBlur={() => onSaveDesc()}
                                className="w-full bg-muted/40 border border-primary/30 rounded-xl p-3 text-sm text-foreground outline-none min-h-80 resize-none"
                                placeholder={t('workspaces.workspaceDescPlaceholder')}
                            />
                        </div>
                    ) : (
                        <p
                            onClick={() => onEditDesc(true)}
                            className={C_WORKSPACEOVERVIEW_3}
                        >
                            {workspace.description}
                            <Pencil className="w-3 h-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        <span className="text-xxs font-bold text-success">{analysis.type}</span>
                    </div>
                    <div className="text-xxs font-medium text-muted-foreground font-mono bg-accent/50 px-2 py-1 rounded border border-border">
                        {workspaceRoot}
                    </div>
                    <button
                        onClick={onAnalyze}
                        disabled={loading}
                        className={C_WORKSPACEOVERVIEW_4}
                        title={t('common.refresh')}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                        {loading ? t('common.loading') : t('common.refresh')}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface WorkspaceStatsCardsProps {
    stats: WorkspaceStats | null
    analysis: WorkspaceAnalysis
    t: (key: string) => string
    formatBytes: (bytes: number) => string
}

export function WorkspaceStatsCards({ stats, analysis, t, formatBytes }: WorkspaceStatsCardsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="text-xxs font-bold text-muted-foreground mb-1">{t('workspaceDashboard.fileCount')}</div>
                <div className="text-2xl font-bold text-foreground">{stats?.fileCount ?? 0}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="text-xxs font-bold text-muted-foreground mb-1">{t('workspaceDashboard.loc')}</div>
                <div className="text-2xl font-bold text-foreground">~{stats?.loc ?? 0}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="text-xxs font-bold text-muted-foreground mb-1">{t('workspaceDashboard.totalSize')}</div>
                <div className="text-2xl font-bold text-foreground">{stats ? formatBytes(stats.totalSize) : '0 B'}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="typo-body font-bold text-muted-foreground mb-1">{t('workspaceDashboard.modules')}</div>
                <div className="text-2xl font-bold text-foreground">{analysis.monorepo?.packages.length ?? Object.keys(analysis.dependencies).length}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="text-xxs font-bold text-muted-foreground mb-1">{t('workspaceDashboard.type')}</div>
                <div className="text-2xl font-bold text-primary capitalize">{analysis.type}</div>
            </div>
        </div>
    );
}

export const WorkspaceOverviewStatsCards = WorkspaceStatsCards;
