import { AlertTriangle, CheckCircle2, FileCode, Terminal } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { CodeAnnotation,WorkspaceIssue } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface TerminalWorkspaceIssuesTabProps {
    workspacePath?: string;
    workspaceId?: string;
    onOpenFile?: (path: string, line?: number) => void;
}

const WORKSPACE_ISSUES_REFRESH_INTERVAL_MS = 60_000;

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
    onOpenFile,
}: TerminalWorkspaceIssuesTabProps) {
    const { t } = useTranslation();
    const [analysis, setAnalysis] = useState<{
        issues: WorkspaceIssue[];
        annotations: CodeAnnotation[];
        lspDiagnostics: WorkspaceIssue[];
    }>({ issues: [], annotations: [], lspDiagnostics: [] });
    const [isLoading, setIsLoading] = useState(false);

    const loadIssues = useCallback(async () => {
        if (!workspacePath) {
            setAnalysis({ issues: [], annotations: [], lspDiagnostics: [] });
            return;
        }

        setIsLoading(true);
        try {
            const results = await window.electron.workspace.analyze(workspacePath, workspaceId ?? workspacePath);
            setAnalysis({
                issues: results.issues ?? [],
                annotations: results.annotations ?? [],
                lspDiagnostics: results.lspDiagnostics ?? []
            });
        } catch (error) {
            appLogger.error(
                'TerminalWorkspaceIssuesTab',
                `Failed to analyze workspace issues for ${workspacePath}`,
                error as Error
            );
            setAnalysis({ issues: [], annotations: [], lspDiagnostics: [] });
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, workspacePath]);

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
                        <AlertTriangle className={`w-4 h-4 ${isError ? 'text-destructive' : 'text-warning'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xxxs font-black uppercase tracking-wider ${isError ? 'text-destructive/80' : 'text-warning/80'}`}>
                                {isError ? t('terminal.workspaceIssuesError') : t('terminal.workspaceIssuesWarning')}
                            </span>
                            <span className="text-xxxs text-muted-foreground font-mono truncate opacity-60 group-hover:opacity-100 transition-opacity">
                                {filePath}:{line}
                            </span>
                            {'source' in issue && (
                                <span className="px-1.5 py-0.5 bg-muted/30 rounded text-xxxs uppercase font-bold text-muted-foreground/60 border border-border/30 ml-auto flex items-center gap-1">
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
                        {t('terminal.workspaceIssuesNoWorkspace')}
                    </div>
                ) : isLoading && totalCount === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        {t('terminal.workspaceIssuesLoading')}
                    </div>
                ) : totalCount === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
                        <CheckCircle2 className="w-8 h-8 text-success" />
                        <div className="text-sm font-bold">{t('terminal.workspaceIssuesNoIssues')}</div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {analysis.lspDiagnostics.length > 0 && (
                            <section className="space-y-2">
                                <div className="text-xxxs font-black uppercase tracking-widest text-primary/80 flex items-center gap-2">
                                    <FileCode className="w-3 h-3" />
                                    {t('terminal.workspaceIssuesLanguageServer')} ({analysis.lspDiagnostics.length})
                                </div>
                                {analysis.lspDiagnostics.map((issue, i) => renderIssue(issue, `lsp-${i}`))}
                            </section>
                        )}
                        {analysis.issues.length > 0 && (
                            <section className="space-y-2">
                                <div className="text-xxxs font-black uppercase tracking-widest text-destructive/80 flex items-center gap-2">
                                    <Terminal className="w-3 h-3" />
                                    {t('terminal.workspaceIssuesTerminal')} ({analysis.issues.length})
                                </div>
                                {analysis.issues.map((issue, i) => renderIssue(issue, `term-${i}`))}
                            </section>
                        )}
                        {analysis.annotations.length > 0 && (
                            <section className="space-y-2">
                                <div className="text-xxxs font-black uppercase tracking-widest text-warning/80 flex items-center gap-2">
                                    <FileCode className="w-3 h-3" />
                                    {t('terminal.workspaceIssuesAnnotations')} ({analysis.annotations.length})
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
