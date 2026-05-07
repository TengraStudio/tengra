/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertTriangle, IconCircleCheck, IconFileCode, IconTerminal } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { CodeAnnotation, WorkspaceDiagnosticsStatus, WorkspaceIssue } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

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

    useEffect(() => {
        if (!workspacePath) {
            return;
        }
        const timer = window.setInterval(() => void loadIssues(), WORKSPACE_ISSUES_REFRESH_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [loadIssues, workspacePath]);

    const totalCount = analysis.issues.length + analysis.annotations.length + analysis.lspDiagnostics.length;
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

        return (
            <button
                key={key}
                className="w-full text-left rounded-lg border border-border/60 bg-card/50 px-3 py-2 hover:bg-accent/35 transition-all group"
                onClick={() => workspacePath && onOpenFile?.(resolveIssuePath(workspacePath, filePath), line)}
            >
                <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">
                        <IconAlertTriangle className={cn('w-4 h-4', isError ? 'text-destructive' : 'text-warning')} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={cn('text-sm font-bold', isError ? 'text-destructive/80' : 'text-warning/80')}>
                                {isError ? t('frontend.terminal.workspaceIssuesError') : t('frontend.terminal.workspaceIssuesWarning')}
                            </span>
                            <span className="text-sm text-muted-foreground font-mono truncate opacity-60 group-hover:opacity-100 transition-opacity">
                                {filePath}:{line}
                            </span>
                            {'source' in issue && (
                                <span className={C_TERMINALWORKSPACEISSUESTAB_1}>
                                    {(issue as WorkspaceIssue).source}
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-foreground/90 break-words leading-snug font-medium">
                            {message}
                        </div>
                    </div>
                </div>
            </button>
        );
    };

    return (
        <div className="h-full flex flex-col bg-background/40">
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
                ) : (
                    <div className="space-y-4">
                        {hasPartialDiagnostics && (
                            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning/90">
                                {t('frontend.terminal.workspaceIssuesPartialResults', {
                                    sources: failedSources.join(', ')})}
                            </div>
                        )}
                        {analysis.lspDiagnostics.length > 0 && (
                            <section className="space-y-2">
                                <div className="text-sm font-bold text-primary/80 flex items-center gap-2">
                                    <IconFileCode className="w-3 h-3" />
                                    {t('frontend.terminal.workspaceIssuesLanguageServer')} ({analysis.lspDiagnostics.length})
                                </div>
                                {analysis.lspDiagnostics.map((issue, i) => renderIssue(issue, `lsp-${i}`))}
                            </section>
                        )}
                        {analysis.issues.length > 0 && (
                            <section className="space-y-2">
                                <div className="text-sm font-bold text-destructive/80 flex items-center gap-2">
                                    <IconTerminal className="w-3 h-3" />
                                    {t('frontend.terminal.workspaceIssuesTerminal')} ({analysis.issues.length})
                                </div>
                                {analysis.issues.map((issue, i) => renderIssue(issue, `term-${i}`))}
                            </section>
                        )}
                        {analysis.annotations.length > 0 && (
                            <section className="space-y-2">
                                <div className="text-sm font-bold text-warning/80 flex items-center gap-2">
                                    <IconFileCode className="w-3 h-3" />
                                    {t('frontend.terminal.workspaceIssuesAnnotations')} ({analysis.annotations.length})
                                </div>
                                {analysis.annotations.map((issue, i) => renderIssue(issue, `ann-${i}`))}
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

