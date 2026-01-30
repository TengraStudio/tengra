import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { ToolResult } from '@/types';

interface CommandExecutionResult {
    stdout?: string;
    stderr?: string;
    error?: string;
}

interface TerminalViewProps {
    toolCallId: string
    command: string
    result?: ToolResult
    isExecuting?: boolean
    expanded: boolean
    onToggleExpand: () => void
}

export function TerminalView({
    toolCallId,
    command,
    result,
    isExecuting,
    expanded,
    onToggleExpand
}: TerminalViewProps) {
    const { t } = useTranslation();
    const [showMarkdown, setShowMarkdown] = useState(false);

    const resultData = result?.result as CommandExecutionResult | undefined;
    const stdout = resultData?.stdout;
    const stderr = resultData?.stderr;
    const error = resultData?.error;

    const outputText = [stdout, stderr, error].filter(Boolean).join('\n');
    const preview = outputText ? outputText.split('\n').slice(0, 6).join('\n') : '';
    const hasOutput = Boolean(outputText);

    const statusLabel = isExecuting ? t('tools.running') : (error || stderr ? t('tools.error') : t('tools.completed'));
    const statusClass = error || stderr
        ? 'bg-destructive/10 text-destructive border-destructive/20'
        : isExecuting
            ? 'bg-success/10 text-success border-success/20'
            : 'bg-muted/20 text-muted-foreground border-border/50';

    return (
        <div className="my-3 animate-in fade-in slide-in-from-bottom-1 duration-500">
            <button
                onClick={onToggleExpand}
                className={cn(
                    "w-full text-left rounded-xl border px-3 py-2 transition-all",
                    expanded ? "bg-muted/30 border-border" : "bg-muted/10 border-border/50 hover:bg-muted/20"
                )}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border", statusClass)}>
                            {statusLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">{t('tools.command')}</span>
                        <span className="text-xs font-mono text-foreground/80 truncate">{command}</span>
                    </div>
                    <span className={cn("text-xs text-muted-foreground transition-transform", expanded && "rotate-180")}>v</span>
                </div>
                {!expanded && (
                    <div className="mt-2 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-24 overflow-hidden">
                        {preview || (isExecuting ? t('tools.executing') : t('tools.noOutput'))}
                    </div>
                )}
            </button>

            {expanded && (
                <div className="terminal-window mt-3 border border-border shadow-2xl rounded-xl overflow-hidden">
                    {/* Mac-style Header */}
                    <div className="terminal-header bg-muted h-7 flex items-center justify-between px-2">
                        <div className="flex gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                            <div className="terminal-dot bg-destructive border-destructive"></div>
                            <div className="terminal-dot bg-warning border-warning"></div>
                            <div className="terminal-dot bg-success border-success"></div>
                        </div>
                        <div className="text-sm text-muted-foreground font-medium select-none flex-1 text-center font-mono flex items-center justify-center gap-2">
                            <span className="opacity-50">admin@macbook</span>
                            <span className="text-zinc-600">~</span>
                            <span>zsh</span>
                        </div>
                        {hasOutput && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMarkdown(!showMarkdown);
                                }}
                                className="text-xs bg-background/50 text-muted-foreground hover:bg-background/80 px-2 py-0.5 rounded border border-border transition-colors uppercase tracking-wider font-bold mr-2"
                                title={t('toolDisplay.markdownView')}
                            >
                                {showMarkdown ? t('toolDisplay.text') : t('toolDisplay.markdown')}
                            </button>
                        )}
                        {/* KILL BUTTON */}
                        {isExecuting && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void (async () => {
                                        const success = await window.electron.killTool(toolCallId);
                                        if (success) { console.warn("Process killed"); }
                                    })();
                                }}
                                className="text-sm bg-destructive/10 text-destructive hover:bg-destructive/20 px-2 py-0.5 rounded border border-destructive/20 transition-colors uppercase tracking-wider font-bold"
                                title={t('tools.forceStop')}
                            >
                                {t('tools.stop')}
                            </button>
                        )}
                    </div>

                    {/* Terminal Body */}
                    <div className="terminal-content p-4 bg-background min-h-[120px] max-h-[400px] overflow-y-auto font-mono text-sm leading-relaxed selection:bg-primary/20">
                        {/* Command Prompt Line */}
                        <div className="flex items-center gap-2 text-success font-bold mb-1">
                            <span className="text-primary">&gt;</span>
                            <span className="text-cyan-300">~</span>
                            <span className="text-zinc-200">{command}</span>
                        </div>

                        {/* Output */}
                        <div className="pl-0 mt-2">
                            {/* Loading State */}
                            {isExecuting && (
                                <div className="flex items-center gap-2 text-muted-foreground italic mb-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse"></span>
                                    {t('tools.executingCommand')}
                                </div>
                            )}

                            {result ? (
                                <>
                                    {showMarkdown ? (
                                        <div className="text-zinc-200 text-sm leading-6">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {outputText || t('tools.noOutputReturned')}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <>
                                            {stdout && (
                                                <div className="text-zinc-300 whitespace-pre-wrap leading-6 tracking-wide">
                                                    {stdout}
                                                </div>
                                            )}
                                            {stderr && (
                                                <div className="text-destructive whitespace-pre-wrap mt-2 leading-6">
                                                    <span className="inline-block mr-2">stderr:</span>
                                                    {stderr}
                                                </div>
                                            )}
                                            {error && (
                                                <div className="text-destructive font-bold whitespace-pre-wrap mt-2 leading-6 bg-destructive/10 p-2 rounded">
                                                    <span className="inline-block mr-2">error:</span>
                                                    {error}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!hasOutput && !isExecuting && (
                                        <div className="text-zinc-600 italic text-xs mt-1 opacity-50">
                                            {t('tools.noOutput')}
                                        </div>
                                    )}
                                </>
                            ) : null}

                            {/* Blinking Cursor at the end */}
                            <div className="mt-2">
                                <span className="text-success font-bold mr-2">&gt;</span>
                                <span className="inline-block w-2.5 h-5 bg-muted/80 align-sub animate-pulse"></span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
