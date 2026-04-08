import { ChevronDown, Loader2, SquareTerminal } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { ToolResult } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface CommandExecutionResult {
    stdout?: string;
    stderr?: string;
    error?: string;
    exitCode?: number | null;
}

interface TerminalViewProps {
    toolCallId: string;
    command: string;
    result?: ToolResult;
    isExecuting?: boolean;
    expanded: boolean;
    onToggleExpand: () => void;
}

type StatusType = 'error' | 'running' | 'completed';

function getStatusType(isExecuting: boolean | undefined, hasError: boolean): StatusType {
    if (hasError) {
        return 'error';
    }
    if (isExecuting) {
        return 'running';
    }
    return 'completed';
}

function extractCommandExecutionResult(result?: ToolResult): CommandExecutionResult {
    if (!result) {
        return {};
    }

    const payload = result.result;
    if (typeof payload === 'string') {
        return {
            stdout: payload,
            error: typeof result.error === 'string' ? result.error : undefined,
        };
    }

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const maybeStdout = (payload as Record<string, unknown>).stdout;
        const maybeStderr = (payload as Record<string, unknown>).stderr;
        const maybeError = (payload as Record<string, unknown>).error;
        const maybeExitCode = (payload as Record<string, unknown>).exitCode;

        return {
            stdout: typeof maybeStdout === 'string' ? maybeStdout : undefined,
            stderr: typeof maybeStderr === 'string' ? maybeStderr : undefined,
            error: typeof maybeError === 'string'
                ? maybeError
                : (typeof result.error === 'string' ? result.error : undefined),
            exitCode: typeof maybeExitCode === 'number' ? maybeExitCode : null,
        };
    }

    return {
        error: typeof result.error === 'string' ? result.error : undefined,
    };
}

function getStatusVariant(statusType: StatusType): 'destructive' | 'warning' | 'success' {
    if (statusType === 'error') {
        return 'destructive';
    }
    if (statusType === 'running') {
        return 'warning';
    }
    return 'success';
}

function TerminalTextOutput({
    stdout,
    stderr,
    error,
    hasOutput,
    isExecuting,
    t,
}: {
    stdout?: string;
    stderr?: string;
    error?: string;
    hasOutput: boolean;
    isExecuting?: boolean;
    t: (key: string) => string;
}) {
    return (
        <div className="space-y-3 font-mono text-xs leading-5">
            {stdout && <pre className="whitespace-pre-wrap text-emerald-200">{stdout}</pre>}
            {stderr && (
                <pre className="whitespace-pre-wrap rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-amber-200">
                    {t('tools.stderrLabel')} {stderr}
                </pre>
            )}
            {error && (
                <pre className="whitespace-pre-wrap rounded-md border border-red-400/35 bg-red-400/10 p-2 text-red-200">
                    {t('tools.errorLabel')} {error}
                </pre>
            )}
            {!hasOutput && !isExecuting && (
                <div className="text-muted-foreground">{t('tools.noOutput')}</div>
            )}
        </div>
    );
}

export const TerminalView = React.memo(({
    toolCallId,
    command,
    result,
    isExecuting,
    expanded,
    onToggleExpand,
}: TerminalViewProps) => {
    const { t } = useTranslation();
    const [showMarkdown, setShowMarkdown] = useState(false);

    useEffect(() => {
        return () => {
            if (!isExecuting) {
                return;
            }
            void (async () => {
                const success = await window.electron.killTool(toolCallId);
                if (success) {
                    appLogger.warn('TerminalView', `Process auto-killed on unmount: ${toolCallId}`);
                }
            })();
        };
    }, [isExecuting, toolCallId]);

    const { stdout, stderr, error, exitCode } = extractCommandExecutionResult(result);
    const outputText = [stdout, stderr, error].filter(Boolean).join('\n');
    const preview = useMemo(
        () => (outputText ? outputText.split('\n').slice(0, 6).join('\n') : ''),
        [outputText]
    );
    const hasOutput = Boolean(outputText);
    const hasError = Boolean(error ?? stderr);
    const statusType = getStatusType(isExecuting, hasError);
    const statusLabel = isExecuting
        ? t('tools.running')
        : hasError
            ? t('tools.error')
            : t('tools.completed');

    return (
        <Card className={cn('my-2 overflow-hidden border-border/40 bg-card/70 backdrop-blur-sm', hasError && 'border-destructive/35')}>
            <button
                type="button"
                onClick={onToggleExpand}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/25"
            >
                <div className="flex min-w-0 items-center gap-2">
                    <SquareTerminal className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">{t('tools.command')}</span>
                    <span className="truncate font-mono text-xs text-foreground/90">{command}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(statusType)} className="text-xxs">
                        {statusLabel}
                    </Badge>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                </div>
            </button>

            {!expanded && (
                <div className="px-4 pb-4">
                    <pre className="max-h-24 overflow-hidden whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {preview || (isExecuting ? t('tools.executingCommand') : t('tools.noOutput'))}
                    </pre>
                </div>
            )}

            {expanded && (
                <CardContent className="space-y-3 px-4 pb-4 pt-0">
                    <div className="overflow-hidden rounded-lg border border-border/40 bg-[#0b1016]">
                        <div className="flex items-center justify-between border-b border-white/10 bg-black/15 px-3 py-2">
                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-red-400/85" />
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/85" />
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/85" />
                            </div>
                            <div className="flex items-center gap-2">
                                {hasOutput && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 border-white/15 bg-white/5 px-2 text-xxs text-slate-200 hover:bg-white/10"
                                        onClick={event => {
                                            event.stopPropagation();
                                            setShowMarkdown(prev => !prev);
                                        }}
                                        title={t('toolDisplay.markdownView')}
                                    >
                                        {showMarkdown ? t('toolDisplay.text') : t('toolDisplay.markdown')}
                                    </Button>
                                )}
                                {isExecuting && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 px-2 text-xxs"
                                        onClick={event => {
                                            event.stopPropagation();
                                            void (async () => {
                                                const success = await window.electron.killTool(toolCallId);
                                                if (success) {
                                                    appLogger.warn('TerminalView', 'Process killed');
                                                }
                                            })();
                                        }}
                                        title={t('tools.forceStop')}
                                    >
                                        {t('tools.stop')}
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto p-3">
                            <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs text-emerald-300">
                                <span>&gt;</span>
                                <span className="break-all">{command}</span>
                                {typeof exitCode === 'number' && (
                                    <span className="text-xxs text-slate-300/80">({`exit ${exitCode}`})</span>
                                )}
                            </div>
                            {isExecuting && (
                                <div className="mb-3 flex items-center gap-2 text-xs text-slate-300">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>{t('tools.executingCommand')}</span>
                                </div>
                            )}
                            {showMarkdown ? (
                                <div className="prose prose-invert max-w-none text-sm text-slate-200">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {outputText || t('tools.noOutputReturned')}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <TerminalTextOutput
                                    stdout={stdout}
                                    stderr={stderr}
                                    error={error}
                                    hasOutput={hasOutput}
                                    isExecuting={isExecuting}
                                    t={t}
                                />
                            )}
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
});
