/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconChevronRight, IconFileCode, IconFileDescription, IconLoader2 } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { CodeEditor } from '@/components/ui/CodeEditor';
import { cn } from '@/lib/utils';

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
    const [expandedFiles, setExpandedFiles] = React.useState<Record<string, boolean>>({});
    const [parsedDiff, setParsedDiff] = React.useState<{ files: DiffFile[], info: string[] }>({ files: [], info: [] });
    const [isParsing, setIsParsing] = React.useState(false);

    React.useEffect(() => {
        if (!commitDiff) {
            setParsedDiff({ files: [], info: [] });
            return;
        }

        setIsParsing(true);

        const timer = setTimeout(() => {
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
                    const fileName = fileNameMatch ? fileNameMatch[1] : t('frontend.workspaceDashboard.git.unknownFile');

                    currentFile = {
                        header: [line],
                        lines: [],
                        fileName: fileName
                    };
                    files.push(currentFile);
                    continue;
                }

                if (!diffStarted) {
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

            setParsedDiff({ files, info: infoLines });
            setIsParsing(false);
        }, 10);

        return () => clearTimeout(timer);
    }, [commitDiff]);

    if (loadingDiff || isParsing) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-muted/5 rounded-xl border border-dashed border-border/20">
                <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground mb-4" />
                <span className="text-sm text-muted-foreground">{t('frontend.workspaceDashboard.git.parsingDiff')}</span>
            </div>
        );
    }

    if (!selectedCommit || !commitDiff || parsedDiff.files.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-16 bg-muted/5 rounded-xl border border-dashed border-border/20">
                <IconAlertCircle className="w-8 h-8 mb-4 text-muted-foreground/40" />
                <span className="text-sm font-medium text-foreground/80">{t('frontend.workspaceDashboard.git.noChangesDetected')}</span>
                <p className="text-xs text-muted-foreground mt-1 text-center">{t('frontend.workspaceDashboard.git.noDiffOutput')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Meta Info Card */}
            {parsedDiff.info.length > 0 && (
                <div className="rounded-lg border border-border/40 bg-muted/10 p-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-foreground/80">
                            <IconFileDescription className="w-4 h-4" />
                            <span className="text-sm font-medium">{t('frontend.workspaceDashboard.git.commitDetails')}</span>
                        </div>
                        <div className="bg-background rounded border border-border/30 p-3 font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {parsedDiff.info.join('\n')}
                        </div>
                    </div>
                </div>
            )}

            {/* Files List */}
            <div className="flex flex-col rounded-lg border border-border/40 bg-background overflow-hidden divide-y divide-border/20">
                {parsedDiff.files.map((file, fileIdx) => {
                    const isExpanded = !!expandedFiles[file.fileName];
                    const additions = file.lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
                    const deletions = file.lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

                    const originalLines: string[] = [];
                    const modifiedLines: string[] = [];

                    for (const line of file.lines) {
                        if (line.startsWith('+') && !line.startsWith('+++')) {
                            modifiedLines.push(line.substring(1));
                        } else if (line.startsWith('-') && !line.startsWith('---')) {
                            originalLines.push(line.substring(1));
                        } else if (line.startsWith(' ') || line === '') {
                            const content = line.length > 0 ? line.substring(1) : '';
                            originalLines.push(content);
                            modifiedLines.push(content);
                        } else if (line.startsWith('@@')) {
                            originalLines.push(`/* ${line} */`);
                            modifiedLines.push(`/* ${line} */`);
                        } else if (!line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++')) {
                            // Ignore unified diff meta headers here, we just want the code
                        }
                    }

                    return (
                        <div key={fileIdx} className="flex flex-col">
                            {/* VSCode-style Header */}
                            <div
                                onClick={() => setExpandedFiles(prev => ({ ...prev, [file.fileName]: !prev[file.fileName] }))}
                                className={cn(
                                    "px-3 py-2 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer select-none",
                                    isExpanded && "bg-muted/20"
                                )}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <IconChevronRight className={cn("w-4 h-4 text-muted-foreground/70 transition-transform shrink-0", isExpanded && "rotate-90")} />
                                    <IconFileCode className="w-4 h-4 text-primary/70 shrink-0" />
                                    <span className="text-sm text-foreground/90 truncate font-mono">{file.fileName}</span>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 ml-4">
                                    <div className="flex items-center gap-2 text-xs font-mono">
                                        {additions > 0 && <span className="text-emerald-500/80">+{additions}</span>}
                                        {deletions > 0 && <span className="text-rose-500/80">-{deletions}</span>}
                                    </div>
                                    <Badge variant="secondary" className="h-5 px-1.5 bg-muted/50 text-muted-foreground font-mono text-[10px] rounded uppercase">
                                        {t('frontend.workspaceDashboard.git.diff')}
                                    </Badge>
                                </div>
                            </div>

                            {/* Diff Body with Monaco Editor */}
                            {isExpanded && (
                                <div className="h-[400px] w-full border-t border-border/20 bg-background flex flex-col">
                                    <CodeEditor
                                        value={modifiedLines.join('\n')}
                                        diffMode={true}
                                        diff={{
                                            oldValue: originalLines.join('\n'),
                                            newValue: modifiedLines.join('\n')
                                        }}
                                        renderSideBySide={false}
                                        language="typescript" // DiffEditor auto-detects based on content, but fallback to ts
                                        readOnly={true}
                                        showMinimap={false}
                                        enableCodeLens={false}
                                        enableInlayHints={false}
                                        lineNumbers="off"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

