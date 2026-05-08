/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconAlertTriangle, IconCircleCheck, IconFileCode, IconSearch, IconTerminal, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownContent } from '@/features/chat/components/message/MarkdownContent';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { CodeAnnotation, WorkspaceDiagnosticsStatus, WorkspaceIssue } from '@/types';
import { appLogger } from '@/utils/renderer-logger';
import { useWorkspaceDiagnostics } from '@/store/diagnostics.store';

/* Batch-02: Extracted Long Classes */
const C_TERMINALWORKSPACEISSUESTAB_1 = "px-1.5 py-0.5 bg-muted/30 rounded text-sm font-bold text-muted-foreground/60 border border-border/30 ml-auto flex items-center gap-1";


interface TerminalWorkspaceIssuesTabProps {
    workspacePath?: string;
    workspaceId?: string;
    activeFilePath?: string;
    activeFileContent?: string;
    activeFileType?: 'code' | 'image' | 'diff';
    onOpenFile?: (path: string, line?: number) => void;
}

const WORKSPACE_ISSUES_REFRESH_INTERVAL_MS = 60_000;
const WORKSPACE_ISSUES_REQUEST_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            reject(new Error('WORKSPACE_ISSUES_REQUEST_TIMEOUT'));
        }, timeoutMs);
        void promise.then(
            value => {
                window.clearTimeout(timeoutId);
                resolve(value);
            },
            error => {
                window.clearTimeout(timeoutId);
                reject(error);
            }
        );
    });
}

function dedupeWorkspaceIssues(issues: WorkspaceIssue[]): WorkspaceIssue[] {
    const seen = new Set<string>();
    const merged: WorkspaceIssue[] = [];
    for (const issue of issues) {
        const key = [
            issue.file,
            issue.line,
            issue.column ?? 0,
            issue.severity,
            issue.source ?? '',
            issue.code ?? '',
            issue.message,
        ].join('|');
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        merged.push(issue);
    }
    return merged;
}

function resolveIssuePath(workspacePath: string, file: string): string {
    if (/^[A-Za-z]:[\\/]/.test(file) || file.startsWith('\\\\')) {
        return file;
    }
    const separator = workspacePath.includes('\\') ? '\\' : '/';
    return `${workspacePath}${workspacePath.endsWith(separator) ? '' : separator}${file}`;
}

export function TerminalWorkspaceIssuesTab({
    workspacePath,
    workspaceId,
    activeFilePath,
    activeFileContent,
    activeFileType,
    onOpenFile,
}: TerminalWorkspaceIssuesTabProps) {
    const { t } = useTranslation();
    const [analysis, setAnalysis] = useState<{
        issues: WorkspaceIssue[];
        annotations: CodeAnnotation[];
        lspDiagnostics: WorkspaceIssue[];
        diagnosticsStatus?: WorkspaceDiagnosticsStatus;
    }>({ issues: [], annotations: [], lspDiagnostics: [], diagnosticsStatus: undefined });
    const [isLoading, setIsLoading] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [followCursor, setFollowCursor] = useState(true);
    const [activeCursor, setActiveCursor] = useState<{ filePath: string; line: number } | null>(null);
    const requestIdRef = useRef(0);

    const loadIssues = useCallback(async () => {
        if (!workspacePath) {
            setAnalysis({ issues: [], annotations: [], lspDiagnostics: [], diagnosticsStatus: undefined });
            return;
        }

        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        try {
            const activeFileEligible = Boolean(
                activeFileType === 'code'
                && typeof activeFilePath === 'string'
                && activeFilePath.length > 0
                && typeof activeFileContent === 'string'
            );

            const [workspaceResults, activeFileDiagnostics] = await Promise.allSettled([
                withTimeout(
                    window.electron.workspace.analyze(workspacePath, workspaceId ?? workspacePath),
                    WORKSPACE_ISSUES_REQUEST_TIMEOUT_MS
                ),
                activeFileEligible
                    ? withTimeout(
                        window.electron.workspace.getFileDiagnostics(
                            workspacePath,
                            activeFilePath as string,
                            activeFileContent as string
                        ),
                        WORKSPACE_ISSUES_REQUEST_TIMEOUT_MS
                    )
                    : Promise.resolve([] as WorkspaceIssue[]),
            ]);

            if (requestId !== requestIdRef.current) {
                return;
            }

            const workspaceAnalysis = workspaceResults.status === 'fulfilled'
                ? workspaceResults.value
                : null;
            const activeDiagnostics = activeFileDiagnostics.status === 'fulfilled'
                ? activeFileDiagnostics.value
                : [];

            if (!workspaceAnalysis && activeDiagnostics.length === 0) {
                throw new Error('WORKSPACE_ISSUES_ANALYSIS_UNAVAILABLE');
            }

            const workspaceDiagnostics = workspaceAnalysis?.lspDiagnostics ?? [];
            const mergedDiagnostics = dedupeWorkspaceIssues([
                ...workspaceDiagnostics,
                ...activeDiagnostics,
            ]);

            setAnalysis({
                issues: workspaceAnalysis?.issues ?? [],
                annotations: workspaceAnalysis?.annotations ?? [],
                lspDiagnostics: mergedDiagnostics,
                diagnosticsStatus: workspaceAnalysis?.diagnosticsStatus,
            });
        } catch (error) {
            if (requestId !== requestIdRef.current) {
                return;
            }
            appLogger.error(
                'TerminalWorkspaceIssuesTab',
                `Failed to analyze workspace issues for ${workspacePath}`,
                error as Error
            );
        } finally {
            if (requestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [workspaceId, workspacePath, activeFilePath, activeFileContent, activeFileType]);

    useEffect(() => {
        void loadIssues();
    }, [loadIssues]);

    const workspaceDiagnostics = useWorkspaceDiagnostics(workspaceId);

    const lspIssues = (() => {
        if (!workspaceDiagnostics) return [];
        const issues: WorkspaceIssue[] = [];
        for (const [uri, fileDiag] of workspaceDiagnostics.entries()) {
            const isWin = /win/i.test(navigator.platform);
            const fileName = decodeURIComponent(uri.replace(/^file:\/\/\//, '')).replace(/\//g, isWin ? '\\' : '/');
            const relativePath = workspacePath ? fileName.replace(workspacePath, '').replace(/^[\\/]/, '') : fileName;

            for (const d of fileDiag.diagnostics) {
                issues.push({
                    severity: d.severity === 1 ? 'error' : 'warning',
                    message: d.message,
                    file: relativePath,
                    line: (d.range?.start?.line ?? 0) + 1,
                    column: (d.range?.start?.character ?? 0) + 1,
                    source: d.source || 'lsp',
                    code: d.code as string
                });
            }
        }
        return issues;
    })();

    useEffect(() => {
        const handler = (e: Event) => {
            if (!followCursor) return;
            const detail = (e as CustomEvent).detail;
            if (detail?.filePath && typeof detail?.line === 'number') {
                setActiveCursor({ filePath: detail.filePath, line: detail.line });
            }
        };
        window.addEventListener('tengra:cursor-moved', handler);
        return () => window.removeEventListener('tengra:cursor-moved', handler);
    }, [followCursor]);

    useEffect(() => {
        if (!workspacePath) {
            return;
        }
        const timer = window.setInterval(() => void loadIssues(), WORKSPACE_ISSUES_REFRESH_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [loadIssues, workspacePath]);

    const filterIssues = <T extends WorkspaceIssue | CodeAnnotation>(issues: T[]) => {
        if (!filterText.trim()) return issues;
        const search = filterText.toLowerCase();
        return issues.filter(issue => 
            issue.file.toLowerCase().includes(search) || 
            issue.message.toLowerCase().includes(search)
        );
    };

    const filteredLspIssues = filterIssues(lspIssues);
    const filteredTerminalIssues = filterIssues(analysis.issues);
    const filteredAnnotations = filterIssues(analysis.annotations);
    const filteredTotalCount = filteredLspIssues.length + filteredTerminalIssues.length + filteredAnnotations.length;

    const totalCount = analysis.issues.length + analysis.annotations.length + lspIssues.length;
    const hasPartialDiagnostics = analysis.diagnosticsStatus?.partial === true;
    const failedSources = (analysis.diagnosticsStatus?.sources ?? [])
        .filter(source => source.status === 'failed')
        .map(source => source.source);

    const renderIssue = (issue: WorkspaceIssue | CodeAnnotation, key: string) => {
        const severity = 'severity' in issue ? issue.severity : 'warning';
        const isError = severity === 'error'
            || ('type' in issue && (issue.type === 'error' || issue.type === 'fixme'));
        const filePath = issue.file;
        const line = issue.line;
        const message = issue.message;

        const isHighlighted = activeCursor && 
            filePath === activeCursor.filePath && 
            line === activeCursor.line;

        return (
            <div
                key={key}
                className={cn(
                    "w-full rounded-xl border border-border/40 bg-card/30 p-4 transition-all hover:bg-accent/10 group relative overflow-hidden cursor-pointer",
                    isHighlighted && "ring-2 ring-primary/40 border-primary/50 bg-primary/5"
                )}
                onClick={() => onOpenFile?.(filePath, line)}
                ref={el => {
                    if (isHighlighted && el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }}
            >
                {/* Visual indicator for severity */}
                <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    isError ? "bg-destructive/50" : "bg-warning/50"
                )} />

                <div className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0">
                        {isError ? (
                            <IconAlertCircle className="w-5 h-5 text-destructive" />
                        ) : (
                            <IconAlertTriangle className="w-5 h-5 text-warning" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                    isError ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-warning/10 text-warning border border-warning/20"
                                )}>
                                    {isError ? t('frontend.terminal.workspaceIssuesError') : t('frontend.terminal.workspaceIssuesWarning')}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono truncate opacity-60">
                                    {filePath}:{line}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {'source' in issue && (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[9px] opacity-40 font-mono border-border/40">
                                        {(issue as WorkspaceIssue).source}
                                    </Badge>
                                )}
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider rounded-md hover:bg-primary/10 text-primary transition-colors"
                                    onClick={() => workspacePath && onOpenFile?.(resolveIssuePath(workspacePath, filePath), line)}
                                >
                                    Go to File
                                </Button>
                            </div>
                        </div>

                        <div className="text-sm text-foreground/80 leading-relaxed font-medium markdown-issue">
                            <MarkdownContent content={message} t={t as any} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-background/40">
            {workspacePath && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-card/20">
                    <div className="relative flex-1 group">
                        <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 group-focus-within:text-primary/70 transition-colors" />
                        <Input
                            placeholder={t('frontend.terminal.workspaceIssuesFilterPlaceholder')}
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                            className="h-8 pl-8 pr-8 bg-background/40 border-border/20 focus-visible:ring-1 focus-visible:ring-primary/30 text-xs"
                        />
                        {filterText && (
                            <button 
                                onClick={() => setFilterText('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-sm text-muted-foreground/50 hover:text-foreground transition-colors"
                            >
                                <IconX className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/20 border border-border/10 text-[10px] font-bold text-muted-foreground/60 whitespace-nowrap">
                        {filteredTotalCount} {t('frontend.terminal.workspaceIssuesResults')}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8", followCursor && "text-primary bg-primary/10")}
                        onClick={() => setFollowCursor(!followCursor)}
                        title={t('frontend.terminal.workspaceIssuesFollowCursor')}
                    >
                        <IconTerminal className="w-3.5 h-3.5" />
                    </Button>
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {!workspacePath ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        {t('frontend.terminal.workspaceIssuesNoWorkspace')}
                    </div>
                ) : isLoading && totalCount === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        {t('frontend.terminal.workspaceIssuesLoading')}
                    </div>
                ) : totalCount === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
                        <IconCircleCheck className="w-8 h-8 text-success" />
                        <div className="text-sm font-bold">{t('frontend.terminal.workspaceIssuesNoIssues')}</div>
                        {hasPartialDiagnostics && (
                            <div className="text-sm text-warning/90">
                                {t('frontend.terminal.workspaceIssuesPartialResults', {
                                    sources: failedSources.join(', ')})}
                            </div>
                        )}
                    </div>
                ) : filteredTotalCount === 0 && filterText ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
                        <IconSearch className="w-6 h-6 opacity-20" />
                        <div className="text-sm">{t('frontend.terminal.workspaceIssuesNoResults')}</div>
                        <Button variant="link" size="sm" onClick={() => setFilterText('')} className="text-primary/60 hover:text-primary text-xs">
                            Clear filter
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {hasPartialDiagnostics && (
                            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning/90">
                                {t('frontend.terminal.workspaceIssuesPartialResults', {
                                    sources: failedSources.join(', ')})}
                            </div>
                        )}
                        {filteredLspIssues.length > 0 && (
                            <section className="space-y-2">
                                <div className="text-sm font-bold text-primary/80 flex items-center gap-2">
                                    <IconFileCode className="w-3 h-3" />
                                    {t('frontend.terminal.workspaceIssuesLanguageServer')} ({filteredLspIssues.length})
                                </div>
                                {filteredLspIssues.map((issue, i) => renderIssue(issue, `lsp-${i}`))}
                            </section>
                        )}
                        {filteredTerminalIssues.length > 0 && (
                            <section className="space-y-2">
                                <div className="text-sm font-bold text-destructive/80 flex items-center gap-2">
                                    <IconTerminal className="w-3 h-3" />
                                    {t('frontend.terminal.workspaceIssuesTerminal')} ({filteredTerminalIssues.length})
                                </div>
                                {filteredTerminalIssues.map((issue, i) => renderIssue(issue, `term-${i}`))}
                            </section>
                        )}
                        {filteredAnnotations.length > 0 && (
                            <section className="space-y-2">
                                <div className="text-sm font-bold text-warning/80 flex items-center gap-2">
                                    <IconFileCode className="w-3 h-3" />
                                    {t('frontend.terminal.workspaceIssuesAnnotations')} ({filteredAnnotations.length})
                                </div>
                                {filteredAnnotations.map((issue, i) => renderIssue(issue, `ann-${i}`))}
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

