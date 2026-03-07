import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { WorkspaceIssue } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface TerminalWorkspaceIssuesTabProps {
    workspacePath?: string;
    workspaceId?: string;
    onOpenFile?: (path: string, line?: number) => void;
}

const WORKSPACE_ISSUES_REFRESH_INTERVAL_MS = 90_000;

function resolveIssuePath(workspacePath: string, issue: WorkspaceIssue): string {
    if (/^[A-Za-z]:[\\/]/.test(issue.file) || issue.file.startsWith('\\\\')) {
        return issue.file;
    }
    const separator = workspacePath.includes('\\') ? '\\' : '/';
    return `${workspacePath}${workspacePath.endsWith(separator) ? '' : separator}${issue.file}`;
}

export function TerminalWorkspaceIssuesTab({
    workspacePath,
    workspaceId,
    onOpenFile,
}: TerminalWorkspaceIssuesTabProps) {
    const { t } = useTranslation();
    const [issues, setIssues] = useState<WorkspaceIssue[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadIssues = useCallback(async () => {
        if (!workspacePath) {
            setIssues([]);
            setErrorMessage(null);
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        try {
            const analysis = await window.electron.project.analyze(workspacePath, workspaceId ?? workspacePath);
            setIssues(analysis.issues ?? []);
        } catch (error) {
            appLogger.error(
                'TerminalWorkspaceIssuesTab',
                `Failed to analyze workspace issues for ${workspacePath}`,
                error as Error
            );
            setIssues([]);
            setErrorMessage(t('terminal.projectIssuesLoadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, workspacePath, t]);

    useEffect(() => {
        void loadIssues();
    }, [loadIssues]);

    useEffect(() => {
        if (!workspacePath) {
            return;
        }
        const timer = window.setInterval(() => {
            void loadIssues();
        }, WORKSPACE_ISSUES_REFRESH_INTERVAL_MS);
        return () => {
            window.clearInterval(timer);
        };
    }, [loadIssues, workspacePath]);

    const sortedIssues = useMemo(
        () =>
            [...issues].sort((left, right) => {
                if (left.type !== right.type) {
                    return left.type === 'error' ? -1 : 1;
                }
                return left.file.localeCompare(right.file) || left.line - right.line;
            }),
        [issues]
    );

    return (
        <div className="h-full flex flex-col bg-background/40">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('terminal.projectIssuesTitle')}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {t('terminal.projectIssuesDescription')}
                    </p>
                </div>
                <button
                    onClick={() => {
                        void loadIssues();
                    }}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/70 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    {t('common.refresh')}
                </button>
            </div>

            {!workspacePath ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
                    {t('terminal.projectIssuesNoProject')}
                </div>
            ) : isLoading ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    {t('terminal.projectIssuesLoading')}
                </div>
            ) : errorMessage ? (
                <div className="flex-1 flex items-center justify-center text-sm text-destructive px-4 text-center">
                    {errorMessage}
                </div>
            ) : sortedIssues.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="text-sm text-foreground">{t('terminal.projectIssuesNoIssues')}</p>
                </div>
            ) : (
                <div className="flex-1 overflow-auto p-3 space-y-2">
                    {sortedIssues.map(issue => {
                        const issuePath = resolveIssuePath(workspacePath, issue);
                        return (
                            <button
                                key={`${issue.file}:${issue.line}:${issue.message}`}
                                className="w-full text-left rounded-lg border border-border/60 bg-card/50 px-3 py-2 hover:bg-accent/35 transition-colors"
                                onClick={() => {
                                    onOpenFile?.(issuePath, issue.line);
                                }}
                            >
                                <div className="flex items-start gap-2">
                                    <AlertTriangle
                                        className={
                                            issue.type === 'error'
                                                ? 'w-4 h-4 mt-0.5 text-destructive'
                                                : 'w-4 h-4 mt-0.5 text-yellow-500'
                                        }
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-semibold text-foreground break-words">
                                            {issue.message}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground font-mono mt-1 truncate">
                                            {issue.file}:{issue.line}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
