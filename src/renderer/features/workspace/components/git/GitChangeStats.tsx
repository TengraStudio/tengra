/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconActivity, IconChevronDown, IconChevronRight, IconFileMinus, IconFilePlus, IconFileText, IconLoader2, IconMinus, IconPlus,IconSquareCheck } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DiffViewer } from '@/components/ui/DiffViewer';
import { cn } from '@/lib/utils';

import { DiffStats, GitData, GitFile } from './types';

interface ChangeStatsProps {
    diffStats: DiffStats;
    gitData: GitData;
    handleStageFile: (path: string) => Promise<void>;
    handleUnstageFile: (path: string) => Promise<void>;
    getStatusIcon: (status: string) => React.ReactNode;
    handleGitFileSelect?: (file: GitFile | null) => void;
    selectedFile?: GitFile | null;
    fileDiff?: { original: string; modified: string } | null;
    loadingDiff?: boolean;
    t: (key: string) => string;
}

const FileRow = ({
    file,
    type,
    onAction,
    onSelect,
    isSelected,
    fileDiff,
    loadingDiff
}: {
    file: GitFile;
    type: 'staged' | 'unstaged';
    onAction: (path: string) => void | Promise<void>;
    onSelect?: (file: GitFile | null) => void;
    isSelected: boolean;
    fileDiff?: { original: string; modified: string } | null;
    loadingDiff?: boolean;
}) => {
    const isStaged = type === 'staged';

    const getStatusInfo = (status: string) => {
        const s = status.toUpperCase();
        if (s.includes('A') || s.includes('??')) {
            return { icon: IconFilePlus, color: 'text-emerald-500' };
        }
        if (s.includes('D')) {
            return { icon: IconFileMinus, color: 'text-rose-500' };
        }
        if (s.includes('M')) {
            return { icon: IconActivity, color: 'text-amber-500' };
        }
        return { icon: IconFileText, color: 'text-muted-foreground/60' };
    };

    const info = getStatusInfo(file.status);

    return (
        <div className="flex flex-col border-b border-border/10 last:border-b-0">
            <div
                onClick={() => onSelect?.(isSelected ? null : file)}
                className={cn(
                    "group flex items-center gap-3 py-2 px-3 cursor-pointer transition-colors",
                    isSelected ? "bg-muted/40" : "hover:bg-muted/30"
                )}
            >
                {isSelected ? <IconChevronDown className="w-3.5 h-3.5 text-primary" /> : <IconChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60" />}

                <div className={cn("p-1.5 rounded bg-background/50 border border-border/5", info.color)}>
                    <info.icon className="w-3 h-3" />
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <span className={cn(
                        "typo-overline font-medium",
                        isSelected ? "text-primary" : "text-foreground/80"
                    )}>
                        {file.path.split('/').pop()}
                    </span>
                    <span className="typo-overline text-muted-foreground/40 truncate font-mono">{file.path}</span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            void onAction(file.path);
                        }}
                        className="h-6 w-6 p-0 hover:bg-muted/50"
                    >
                        {isStaged ? <IconMinus className="w-3.5 h-3.5" /> : <IconPlus className="w-3.5 h-3.5" />}
                    </Button>
                </div>
            </div>

            {/* Inline Diff Viewer */}
            {isSelected && (
                <div className="px-6 pb-6 pt-2 h-450 animate-in fade-in slide-in-from-top-1 duration-200">
                    {loadingDiff ? (
                        <div className="h-full flex flex-col items-center justify-center bg-muted/5 rounded-lg border border-dashed border-border/20">
                            <IconLoader2 className="w-5 h-5 animate-spin text-primary/40 mb-2" />
                            <span className="typo-overline font-bold uppercase text-muted-foreground/40 ">Diff Generation...</span>
                        </div>
                    ) : fileDiff ? (
                        <DiffViewer
                            original={fileDiff.original}
                            modified={fileDiff.modified}
                            language="plaintext"
                            className="h-full shadow-lg border-border/20"
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center bg-muted/5 rounded-lg text-sm text-muted-foreground/40">
                            Computing delta...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const GitChangeStats: React.FC<ChangeStatsProps> = ({
    gitData,
    handleStageFile,
    handleUnstageFile,
    handleGitFileSelect,
    selectedFile,
    fileDiff,
    loadingDiff
}) => {
    return (
        <div className="space-y-6">
            {/* Staged Files */}
            {gitData.stagedFiles.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="typo-overline font-bold text-muted-foreground/40 uppercase ">Staged Changes</span>
                        <Badge variant="outline" className="h-4 px-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-500 typo-overline font-bold">
                            {gitData.stagedFiles.length}
                        </Badge>
                    </div>
                    <div className="border border-border/40 rounded-xl overflow-hidden bg-card/60">
                        {gitData.stagedFiles.map((file, i) => (
                            <FileRow
                                key={`staged-${file.path}-${i}`}
                                file={{ ...file, staged: true }}
                                type="staged"
                                onAction={handleUnstageFile}
                                onSelect={handleGitFileSelect}
                                isSelected={selectedFile?.path === file.path && selectedFile?.staged}
                                fileDiff={fileDiff}
                                loadingDiff={loadingDiff}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Unstaged Files */}
            {gitData.unstagedFiles.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="typo-overline font-bold text-muted-foreground/40 uppercase ">Untracked Changes</span>
                        <Badge variant="outline" className="h-4 px-1.5 border-amber-500/20 bg-amber-500/10 text-amber-500 typo-overline font-bold">
                            {gitData.unstagedFiles.length}
                        </Badge>
                    </div>
                    <div className="border border-border/40 rounded-xl overflow-hidden bg-card/60">
                        {gitData.unstagedFiles.map((file, i) => (
                            <FileRow
                                key={`unstaged-${file.path}-${i}`}
                                file={{ ...file, staged: false }}
                                type="unstaged"
                                onAction={handleStageFile}
                                onSelect={handleGitFileSelect}
                                isSelected={selectedFile?.path === file.path && !selectedFile?.staged}
                                fileDiff={fileDiff}
                                loadingDiff={loadingDiff}
                            />
                        ))}
                    </div>
                </div>
            )}

            {gitData.changedFiles.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                    <IconSquareCheck className="w-10 h-10 mb-4 text-emerald-500/40" />
                    <p className="text-sm font-semibold text-foreground/80">Everything is committed</p>
                    <p className="typo-overline uppercase font-bold text-muted-foreground mt-1">Workspace Clean</p>
                </div>
            )}
        </div>
    );
};

