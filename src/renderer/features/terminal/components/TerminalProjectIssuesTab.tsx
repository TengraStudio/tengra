import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { ProjectIssue } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface TerminalProjectIssuesTabProps {
    projectPath?: string;
    projectId?: string;
    onOpenFile?: (path: string, line?: number) => void;
}

const PROJECT_ISSUES_REFRESH_INTERVAL_MS = 90_000;

function resolveIssuePath(projectPath: string, issue: ProjectIssue): string {
    if (/^[A-Za-z]:[\\/]/.test(issue.file) || issue.file.startsWith('\\\\')) {
        return issue.file;
    }
    const separator = projectPath.includes('\\') ? '\\' : '/';
    return `${projectPath}${projectPath.endsWith(separator) ? '' : separator}${issue.file}`;
}

export function TerminalProjectIssuesTab({
    projectPath,
    projectId,
    onOpenFile,
}: TerminalProjectIssuesTabProps) {
    const { t } = useTranslation();
    const [issues, setIssues] = useState<ProjectIssue[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadIssues = useCallback(async () => {
        if (!projectPath) {
            setIssues([]);
            setErrorMessage(null);
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        try {
            const analysis = await window.electron.project.analyze(projectPath, projectId ?? projectPath);
            setIssues(analysis.issues ?? []);
        } catch (error) {
            appLogger.error(
                'TerminalProjectIssuesTab',
                `Failed to analyze project issues for ${projectPath}`,
                error as Error
            );
            setIssues([]);
            setErrorMessage(t('terminal.projectIssuesLoadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [projectId, projectPath, t]);

    useEffect(() => {
        void loadIssues();
    }, [loadIssues]);

    useEffect(() => {
        if (!projectPath) {
            return;
        }
        const timer = window.setInterval(() => {
            void loadIssues();
        }, PROJECT_ISSUES_REFRESH_INTERVAL_MS);
        return () => {
            window.clearInterval(timer);
        };
    }, [loadIssues, projectPath]);

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

            {!projectPath ? (
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
                        const issuePath = resolveIssuePath(projectPath, issue);
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
