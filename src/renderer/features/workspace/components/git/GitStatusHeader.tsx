/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconActivity, IconCircleCheck, IconClock, IconFileMinus, IconFilePlus, IconHash } from '@tabler/icons-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { DiffStats, GitData } from './types';

interface StatusHeaderProps {
    gitData: GitData;
    diffStats: DiffStats;
    t: (key: string) => string;
}

export const GitStatusHeader: React.FC<StatusHeaderProps> = ({ gitData, diffStats, t }) => {
    // Calculate reasons for dirty state
    const addedCount = gitData.changedFiles.filter(f => f.status.includes('A') || f.status.includes('??')).length;
    const modifiedCount = gitData.changedFiles.filter(f => f.status.includes('M')).length;
    const deletedCount = gitData.changedFiles.filter(f => f.status.includes('D')).length;

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <span className="typo-overline font-bold text-muted-foreground/60 uppercase px-1">{t('frontend.workspaceDashboard.gitSectionStatus')}</span>

                <div className="p-4 rounded-xl bg-card border border-border/40 space-y-5">
                    {/* Primary Status */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full shadow-sm",
                                gitData.isClean ? "bg-emerald-500 shadow-emerald-500/20" : "bg-amber-500 shadow-amber-500/20"
                            )} />
                            <span className="text-sm font-bold ">
                                {gitData.isClean ? t('frontend.workspaceDashboard.clean') : t('frontend.workspaceDashboard.dirty')}
                            </span>
                        </div>
                        <span className="typo-overline font-bold text-muted-foreground/40 bg-muted/50 px-2 py-0.5 rounded uppercase ">
                            {gitData.branch}
                        </span>
                    </div>

                    <div className="h-px bg-border/10" />

                    {/* Detailed Reason (Why it's dirty) */}
                    {!gitData.isClean ? (
                        <div className="grid grid-cols-1 gap-3">
                            <div className="typo-overline font-bold text-muted-foreground/30 uppercase mb-1 px-1">{t('frontend.workspaceDashboard.status')}</div>
                            <div className="space-y-2.5">
                                {addedCount > 0 && (
                                    <div className="flex items-center justify-between text-sm px-1">
                                        <div className="flex items-center gap-2 text-emerald-500/80">
                                            <IconFilePlus className="w-3.5 h-3.5" />
                                            <span>{t('frontend.workspaceDashboard.gitStatus.added')}</span>
                                        </div>
                                        <span className="font-bold">{addedCount}</span>
                                    </div>
                                )}
                                {modifiedCount > 0 && (
                                    <div className="flex items-center justify-between text-sm px-1">
                                        <div className="flex items-center gap-2 text-amber-500/80">
                                            <IconActivity className="w-3.5 h-3.5" />
                                            <span>{t('frontend.workspaceDashboard.gitStatus.modified')}</span>
                                        </div>
                                        <span className="font-bold">{modifiedCount}</span>
                                    </div>
                                )}
                                {deletedCount > 0 && (
                                    <div className="flex items-center justify-between text-sm px-1">
                                        <div className="flex items-center gap-2 text-rose-500/80">
                                            <IconFileMinus className="w-3.5 h-3.5" />
                                            <span>{t('frontend.workspaceDashboard.gitStatus.deleted')}</span>
                                        </div>
                                        <span className="font-bold">{deletedCount}</span>
                                    </div>
                                )}
                                {diffStats && (
                                    <div className="pt-2 border-t border-border/5 mt-2 flex items-center gap-4 typo-overline font-medium px-1">
                                        <span className="text-emerald-500/60">+{diffStats.total.added} {t('frontend.workspaceDashboard.linesAdded')}</span>
                                        <span className="text-rose-500/60">-{diffStats.total.deleted} {t('frontend.workspaceDashboard.linesDeleted')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-4 text-center opacity-40 grayscale">
                            <IconCircleCheck className="w-8 h-8 text-emerald-500" />
                            <p className="typo-overline font-bold uppercase ">{t('frontend.workspaceDashboard.clean')}</p>
                        </div>
                    )}

                    <div className="h-px bg-border/10" />

                    {/* Metadata */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-sm px-1">
                            <span className="text-muted-foreground/60 flex items-center gap-2"><IconClock className="w-3.5 h-3.5" /> Updated</span>
                            <span className="font-semibold text-foreground/80">{gitData.lastCommit?.relativeTime ?? 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm px-1">
                            <span className="text-muted-foreground/60 flex items-center gap-2"><IconHash className="w-3.5 h-3.5" /> Identity</span>
                            <span className="font-mono text-indigo-500/60 font-bold">{gitData.lastCommit?.hash.substring(0, 7) ?? 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

