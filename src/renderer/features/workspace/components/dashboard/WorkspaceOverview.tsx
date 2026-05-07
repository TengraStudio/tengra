/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCamera, IconCheck, IconPencil, IconRefresh, IconSparkles } from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import { Workspace, WorkspaceAnalysis, WorkspaceStats } from '@/types';
import { toSafeFileUrl } from '@/utils/safe-file-url.util';

interface WorkspaceOverviewHeaderProps {
    workspace: Workspace;
    workspaceRoot: string;
    analysis: WorkspaceAnalysis;
    loading: boolean;
    isEditingName: boolean;
    isEditingDesc: boolean;
    editName: string;
    editDesc: string;
    onEditName: (editing: boolean) => void;
    onEditDesc: (editing: boolean) => void;
    onSetName: (name: string) => void;
    onSetDesc: (desc: string) => void;
    onSaveName: () => void;
    onSaveDesc: () => void;
    onAnalyze: () => void;
    onOpenLogoGenerator?: () => void;
    t: (key: string) => string;
}

function InfoRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-b-0">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
            </span>
            <span className="text-sm text-foreground text-right break-all">
                {value}
            </span>
        </div>
    );
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
    t,
}: WorkspaceOverviewHeaderProps) {
    const baseLogoUrl = toSafeFileUrl(workspace.logo);
    const workspaceLogoUrl = baseLogoUrl?.startsWith('data:')
        ? baseLogoUrl
        : (baseLogoUrl ? `${baseLogoUrl}?t=${workspace.updatedAt}` : null);

    return (
        <div className="rounded-2xl border border-border bg-background/80 p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-xl border border-border/70 bg-muted/40 overflow-hidden flex items-center justify-center">
                            {workspaceLogoUrl ? (
                                <img
                                    src={workspaceLogoUrl}
                                    alt={t('frontend.workspaces.logoAlt')}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <IconSparkles className="w-7 h-7 text-muted-foreground/50" />
                            )}
                        </div>
                        {onOpenLogoGenerator && (
                            <button
                                type="button"
                                onClick={onOpenLogoGenerator}
                                className="absolute -right-1 -bottom-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground hover:bg-accent"
                                title={t('frontend.workspaces.changeLogo')}
                            >
                                <IconCamera className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
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
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-lg font-medium text-foreground outline-none focus:border-primary"
                                />
                                <button
                                    type="button"
                                    onClick={onSaveName}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-accent"
                                >
                                    <IconCheck className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onEditName(true)}
                                className="group flex items-center gap-2 text-left"
                            >
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                                    {workspace.title}
                                </h1>
                                <IconPencil className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                        )}

                        <div className="mt-2 text-sm text-muted-foreground">
                            {workspace.description?.trim()
                                ? (
                                    isEditingDesc ? (
                                        <textarea
                                            autoFocus
                                            value={editDesc}
                                            onChange={e => onSetDesc(e.target.value)}
                                            onBlur={() => onSaveDesc()}
                                            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-y"
                                            placeholder={t('frontend.workspaces.workspaceDescPlaceholder')}
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onEditDesc(true)}
                                            className="group text-left leading-6 text-muted-foreground hover:text-foreground"
                                        >
                                            <span>{workspace.description}</span>
                                            <IconPencil className="ml-2 inline h-3.5 w-3.5 align-baseline opacity-0 transition-opacity group-hover:opacity-100" />
                                        </button>
                                    )
                                )
                                : (
                                    <button
                                        type="button"
                                        onClick={() => onEditDesc(true)}
                                        className="text-left text-muted-foreground hover:text-foreground"
                                    >
                                        {t('frontend.workspaces.workspaceDescPlaceholder')}
                                    </button>
                                )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t('frontend.workspaceDashboard.type')}
                        </div>
                        <div className="text-sm font-medium text-foreground capitalize">
                            {analysis.type}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onAnalyze}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-60"
                        title={t('common.refresh')}
                    >
                        <IconRefresh className={cn('h-4 w-4', loading && 'animate-spin')} />
                        <span>{loading ? t('common.loading') : t('common.refresh')}</span>
                    </button>
                </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoRow
                    label={t('frontend.workspaceDashboard.fileCount')}
                    value={String(analysis.stats.fileCount)}
                />
                <InfoRow
                    label={t('frontend.workspaceDashboard.loc')}
                    value={`~${analysis.stats.loc}`}
                />
                <InfoRow
                    label={t('frontend.workspaces.placeholders.rootPath')}
                    value={workspaceRoot}
                />
                <InfoRow
                    label={t('frontend.workspaceDashboard.modules')}
                    value={String(analysis.monorepo?.packages.length ?? Object.keys(analysis.dependencies).length)}
                />
            </div>
        </div>
    );
}

interface WorkspaceStatsCardsProps {
    stats: WorkspaceStats | null;
    analysis: WorkspaceAnalysis;
    t: (key: string) => string;
    formatBytes: (bytes: number) => string;
}

function SimpleStatCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
            </div>
            <div className="mt-2 text-xl font-semibold text-foreground">
                {value}
            </div>
        </div>
    );
}

export function WorkspaceStatsCards({ stats, analysis, t, formatBytes }: WorkspaceStatsCardsProps) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SimpleStatCard
                label={t('frontend.workspaceDashboard.fileCount')}
                value={String(stats?.fileCount ?? 0)}
            />
            <SimpleStatCard
                label={t('frontend.workspaceDashboard.loc')}
                value={`~${stats?.loc ?? 0}`}
            />
            <SimpleStatCard
                label={t('frontend.workspaceDashboard.totalSize')}
                value={stats ? formatBytes(stats.totalSize) : '0 B'}
            />
            <SimpleStatCard
                label={t('frontend.workspaceDashboard.modules')}
                value={String(analysis.monorepo?.packages.length ?? Object.keys(analysis.dependencies).length)}
            />
        </div>
    );
}

export const WorkspaceOverviewStatsCards = WorkspaceStatsCards;
