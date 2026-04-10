import { AlertTriangle, Sparkles, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';

type TerminalSemanticIssue = {
    id: string;
    tabId: string;
    severity: 'error' | 'warning';
    message: string;
    timestamp: number;
};

interface TerminalSemanticPanelProps {
    t: (key: string, options?: Record<string, string | number>) => string;
    activeSemanticIssues: TerminalSemanticIssue[];
    activeSemanticErrorCount: number;
    activeSemanticWarningCount: number;
    clearActiveSemanticIssues: () => void;
    revealSemanticIssue: (issue: TerminalSemanticIssue) => void;
    handleAiExplainError: (issue: TerminalSemanticIssue) => Promise<void>;
    handleAiFixError: (issue: TerminalSemanticIssue) => Promise<void>;
}

export function TerminalSemanticPanel({
    t,
    activeSemanticIssues,
    activeSemanticErrorCount,
    activeSemanticWarningCount,
    clearActiveSemanticIssues,
    revealSemanticIssue,
    handleAiExplainError,
    handleAiFixError,
}: TerminalSemanticPanelProps) {
    return (
        <div className="absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 min-w-80 max-w-lg">
            <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 typo-caption font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    {t('terminal.semanticIssues')}
                </div>
                <div className="flex items-center gap-2 text-xxxs text-muted-foreground">
                    <span>
                        {t('terminal.semanticErrors')}: {activeSemanticErrorCount}
                    </span>
                    <span>
                        {t('terminal.semanticWarnings')}: {activeSemanticWarningCount}
                    </span>
                    <button
                        onClick={clearActiveSemanticIssues}
                        className="px-1.5 py-0.5 rounded border border-border hover:bg-accent/50 transition-colors text-foreground"
                    >
                        {t('terminal.clearIssues')}
                    </button>
                </div>
            </div>
            {activeSemanticIssues.length === 0 ? (
                <div className="px-1 py-2 typo-caption text-muted-foreground">
                    {t('terminal.semanticNoIssues')}
                </div>
            ) : (
                <div className="max-h-56 overflow-y-auto space-y-1">
                    {activeSemanticIssues.map(issue => (
                        <div
                            key={issue.id}
                            className="w-full text-left rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors border border-transparent hover:border-border/70 group"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span
                                    className={cn(
                                        'text-xxxs   font-semibold',
                                        issue.severity === 'error'
                                            ? 'text-destructive'
                                            : 'text-warning'
                                    )}
                                >
                                    {issue.severity}
                                </span>
                                <div className="flex items-center gap-1">
                                    {issue.severity === 'error' && (
                                        <>
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    void handleAiExplainError(issue);
                                                }}
                                                className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                title={t('terminal.aiExplainError')}
                                            >
                                                <Sparkles className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    void handleAiFixError(issue);
                                                }}
                                                className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                title={t('terminal.aiFixError')}
                                            >
                                                <Wrench className="w-3 h-3" />
                                            </button>
                                        </>
                                    )}
                                    <span className="text-xxxs text-muted-foreground">
                                        {new Date(issue.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    revealSemanticIssue(issue);
                                }}
                                className="w-full text-left"
                            >
                                <div className="typo-caption text-foreground/90 mt-0.5 line-clamp-2">
                                    {issue.message}
                                </div>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
