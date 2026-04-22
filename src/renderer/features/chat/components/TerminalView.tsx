/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChevronDown, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

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
        <div className="space-y-2 font-mono typo-caption leading-5">
            {error && (
                <pre className="whitespace-pre-wrap rounded-md border border-destructive/25 bg-destructive/5 p-2 text-destructive">
                    {error}
                </pre>
            )}
            {stderr && (
                <pre className="whitespace-pre-wrap rounded-md border border-border/40 bg-muted/10 p-2 text-foreground/80">
                    {stderr}
                </pre>
            )}
            {stdout && (
                <pre className="whitespace-pre-wrap rounded-md border border-border/40 bg-muted/10 p-2 text-foreground/80">
                    {stdout}
                </pre>
            )}
            {!hasOutput && !isExecuting && <div className="text-muted-foreground">{t('tools.noOutput')}</div>}
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
    const [showFullOutput, setShowFullOutput] = useState(false);

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

    const { stdout, stderr, error, exitCode } = useMemo(() => extractCommandExecutionResult(result), [result]);
    const hasOutput = Boolean(
        (stdout && stdout.trim().length > 0)
        || (stderr && stderr.trim().length > 0)
        || (error && error.trim().length > 0)
    );
    const hasError = Boolean((error && error.trim().length > 0) || (stderr && stderr.trim().length > 0));
    const statusType = getStatusType(isExecuting, hasError);

    const summaryText = useMemo(() => {
        const cmd = command.trim().length > 0 ? command.trim() : t('tools.commandUnknown');
        if (statusType === 'running') {
            return t('tools.runningCommand', { command: cmd });
        }
        if (statusType === 'error') {
            return t('tools.failedCommand', { command: cmd });
        }
        return t('tools.ranCommand', { command: cmd });
    }, [command, statusType, t]);

    const previewText = useMemo(() => {
        const parts = [error, stderr, stdout].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
        if (parts.length === 0) {
            return isExecuting ? t('tools.executingCommand') : t('tools.noOutput');
        }
        const firstLine = parts[0].trim().split(/\r?\n/)[0];
        return firstLine.length > 160 ? `${firstLine.slice(0, 160)}...` : firstLine;
    }, [error, stderr, stdout, isExecuting, t]);

    const statusDotClass =
        statusType === 'running'
            ? 'bg-primary/70'
            : statusType === 'error'
                ? 'bg-destructive/70'
                : 'bg-muted-foreground/60';

    return (
        <div className="my-1 overflow-hidden">
            <button
                type="button"
                onClick={onToggleExpand}
                className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                    expanded ? 'bg-muted/20' : 'hover:bg-muted/15'
                )}
                aria-label={expanded ? t('chat.collapse') : t('chat.expand')}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', statusDotClass)} />
                    <div className="min-w-0">
                        <div className={cn('truncate text-sm font-medium', statusType === 'running' && 'text-primary')}>
                            {summaryText}
                        </div>
                        {!expanded && (
                            <div className="truncate text-xs text-muted-foreground/70">
                                {previewText}
                            </div>
                        )}
                    </div>
                </div>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground/60 transition-transform', expanded && 'rotate-180')} />
            </button>

            {expanded && (
                <div className="px-3 pb-2 pt-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 truncate font-mono text-xs text-muted-foreground/80">
                            {command || t('tools.commandUnknown')}
                            {typeof exitCode === 'number' && <span className="ml-2">{`(exit ${exitCode})`}</span>}
                        </div>
                        {hasOutput && (
                            <button
                                type="button"
                                className="text-xs text-muted-foreground/70 hover:text-foreground"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFullOutput(prev => !prev);
                                }}
                            >
                                {showFullOutput ? t('tools.showLess') : t('tools.showMore')}
                            </button>
                        )}
                    </div>

                    {isExecuting && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>{t('tools.executingCommand')}</span>
                            <button
                                type="button"
                                className="ml-auto text-xs text-destructive hover:underline"
                                onClick={(event) => {
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
                            </button>
                        </div>
                    )}

                    <div className="mt-2">
                        <TerminalTextOutput
                            stdout={showFullOutput ? stdout : undefined}
                            stderr={stderr}
                            error={error}
                            hasOutput={hasOutput}
                            isExecuting={isExecuting}
                            t={t}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

TerminalView.displayName = 'TerminalView';
