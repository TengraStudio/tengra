/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconChevronRight, IconFileCode, IconHash, IconInfoCircle, IconLoader2 } from '@tabler/icons-react';
import React, { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';

import { GitDiffLine } from './GitDiffLine';
import { GitCommitInfo } from './types';

interface CommitDiffViewProps {
    selectedCommit: GitCommitInfo | null;
    loadingDiff: boolean;
    commitDiff: string | null;
    t: (key: string) => string;
}

interface DiffFile {
    header: string[];
    lines: string[];
    fileName: string;
}

export const GitCommitDiffView: React.FC<CommitDiffViewProps> = ({
    selectedCommit,
    loadingDiff,
    commitDiff,
    t
}) => {
    const parsedDiff = useMemo(() => {
        if (!commitDiff) { return { files: [], info: [] }; }

        const lines = commitDiff.split('\n');
        const infoLines: string[] = [];
        const files: DiffFile[] = [];
        let currentFile: DiffFile | null = null;
        let diffStarted = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('diff --git')) {
                diffStarted = true;
                const fileNameMatch = line.match(/b\/(.+)$/);
                const fileName = fileNameMatch ? fileNameMatch[1] : 'Unknown File';

                currentFile = {
                    header: [line],
                    lines: [],
                    fileName: fileName
                };
                files.push(currentFile);
                continue;
            }

            if (!diffStarted) {
                // Collect commit metadata lines
                if (line.trim().length > 0) {
                    infoLines.push(line);
                }
                continue;
            }

            if (currentFile) {
                if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('index') || line.startsWith('new file') || line.startsWith('deleted file')) {
                    currentFile.header.push(line);
                } else {
                    currentFile.lines.push(line);
                }
            }
        }

        return { files, info: infoLines };
    }, [commitDiff]);

    if (loadingDiff) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-muted/5 rounded-3xl border border-dashed border-border/10">
                <IconLoader2 className="w-8 h-8 animate-spin text-primary/40 mb-4" />
                <span className="typo-overline font-bold uppercase text-muted-foreground/30">Streaming Delta stream...</span>
            </div>
        );
    }

    if (!selectedCommit || !commitDiff || parsedDiff.files.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-16 bg-muted/5 rounded-3xl border border-dashed border-border/10 opacity-30 grayscale">
                <IconAlertCircle className="w-10 h-10 mb-6 text-muted-foreground/40" />
                <span className="typo-overline font-bold uppercase ">Detailed Analytics Unavailable</span>
                <p className="typo-overline mt-2 max-w-200 text-center leading-relaxed">The changeset for this specific commit could not be resolved or is empty.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Meta Info Card */}
            <div className="rounded-2xl border border-border/40 bg-card/40 p-4 overflow-hidden relative shadow-lg">
                <div className="absolute top-0 right-0 p-8 transform translate-x-1/4 -translate-y-1/4 opacity-03 rotate-12">
                    <IconInfoCircle className="w-32 h-32" />
                </div>

                <div className="flex flex-col gap-3 relative z-10">
                    <div className="flex items-center gap-2 text-primary/60">
                        <IconInfoCircle className="w-3.5 h-3.5" />
                        <span className="typo-overline font-bold uppercase ">Commit Manifest</span>
                    </div>
                    <div className="space-y-1 bg-muted/10 p-3 rounded-xl border border-border/10 font-mono typo-overline text-muted-foreground/80 leading-relaxed shadow-inner">
                        {parsedDiff.info.map((line, idx) => (
                            <div key={idx} className="break-words">
                                <span className="opacity-30 mr-2">{(idx + 1).toString().padStart(2, '0')}</span>
                                {line}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Files Loop */}
            <div className="flex flex-col gap-8">
                {parsedDiff.files.map((file, fileIdx) => (
                    <div key={fileIdx} className="rounded-2xl border border-border/40 bg-git-gh-bg overflow-hidden shadow-2xl flex flex-col group">
                        {/* File Name Header */}
                        <div className="bg-git-gh-header px-5 py-3.5 border-b border-border/10 flex items-center justify-between group-hover:bg-git-gh-hover transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary shadow-sm border border-primary/5">
                                    <IconFileCode className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="typo-overline font-bold text-foreground/90 ">{file.fileName}</span>
                                    <div className="flex items-center gap-2 typo-overline font-bold text-muted-foreground/30 uppercase mt-0.5">
                                        <IconChevronRight className="w-2.5 h-2.5" />
                                        <span>Full Path Resolution</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="h-5 px-1.5 border-border/10 bg-muted/10 text-muted-foreground/40 rounded font-mono typo-overline uppercase">
                                    {file.lines.length} Lines
                                </Badge>
                            </div>
                        </div>

                        {/* Summary Header Section (git index, ---, +++) */}
                        <div className="bg-git-gh-header/50 px-5 py-2.5 border-b border-border/5 flex flex-col gap-1">
                            {file.header.map((hLine, hIdx) => (
                                <div key={hIdx} className="font-mono typo-overline text-muted-foreground/40 ">
                                    {hLine}
                                </div>
                            ))}
                        </div>

                        {/* Diff Body */}
                        <div className="overflow-x-auto custom-scrollbar">
                            <div className="min-w-full font-mono py-2 bg-git-gh-bg">
                                {file.lines.map((line: string, idx: number) => (
                                    <GitDiffLine key={idx} line={line} idx={idx} />
                                ))}
                            </div>
                        </div>

                        {/* File Footer */}
                        <div className="bg-git-gh-header px-5 py-2.5 border-t border-border/10 flex items-center justify-between opacity-60">
                            <div className="flex items-center gap-2 typo-overline font-bold text-muted-foreground/20 uppercase ">
                                <IconHash className="w-3 h-3" />
                                <span>{t('frontend.git.commitDiff.endOfChangeset')}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                                    <span className="typo-overline font-bold text-muted-foreground/40 uppercase">{t('frontend.git.commitDiff.additions')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500/40" />
                                    <span className="typo-overline font-bold text-muted-foreground/40 uppercase">{t('frontend.git.commitDiff.deletions')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
