/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { JsonValue } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { IconChevronDown, IconCopy, IconExternalLink, IconHistory, IconRefresh } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import { compactToolCallsForDisplay } from '@/features/chat/components/message/tool-call-display.util';
import { navigateToWorkspace } from '@/features/workspace/utils/workspace-navigation';
import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import { Message, ToolResult } from '@/types';

import { AssistantLogo } from './AssistantLogo';
import { MarkdownContent, MessageBubbleContent } from './MarkdownContent';
import { MessageActions } from './MessageActions';
import {
    createToggleVisibilityFlags,
    MessageActionsContextProps,
    MessageBubbleContentProps,
    QuotaDetails,
} from './MessageBubbleContent.util';
import { MessageFooter } from './MessageFooter';
import { MessageImages } from './MessageImages';
import { PlanSection } from './PlanSection';
import { RawToggle } from './RawToggle';
import { ResponseProgress } from './ResponseProgress';
import { ToolRecoveryNotice } from './ToolRecoveryNotice';


type TranslationFn = (key: string, options?: Record<string, string | number>) => string;
type ToolCallView = {
    id: string;
    name: string;
    arguments: Record<string, JsonValue>;
    rawArguments: string;
    thoughtIndex?: number;
};

function buildToolCalls(message: Message): ToolCallView[] {
    const displayToolCalls = compactToolCallsForDisplay(message.toolCalls);
    if (!displayToolCalls || displayToolCalls.length === 0) {
        return [];
    }
    return displayToolCalls
        .map(toolCall => {
            const name = typeof toolCall.function?.name === 'string' ? toolCall.function.name : '';
            const args = typeof toolCall.function?.arguments === 'string' ? toolCall.function.arguments : '';
            if (name.trim().length === 0 && args.trim().length === 0) {
                return null;
            }
            const thoughtIndexRaw = (toolCall as unknown as Record<string, unknown>)['thoughtIndex'];
            const thoughtIndex = typeof thoughtIndexRaw === 'number' && Number.isFinite(thoughtIndexRaw)
                ? Math.max(0, Math.floor(thoughtIndexRaw))
                : undefined;
            return {
                id: typeof toolCall.id === 'string' && toolCall.id.trim().length > 0
                    ? toolCall.id
                    : `${name || 'tool'}-${toolCall.index ?? 0}`,
                name,
                arguments: safeJsonParse<Record<string, JsonValue>>(args, {}),
                rawArguments: args,
                ...(typeof thoughtIndex === 'number' ? { thoughtIndex } : {}),
            };
        })
        .filter((tc): tc is ToolCallView => tc !== null);
}

function buildToolResultMap(message: Message): Map<string, ToolResult> {
    const toolResults = Array.isArray(message.toolResults) ? message.toolResults : [];
    const map = new Map<string, ToolResult>();
    for (const toolResult of toolResults) {
        if (typeof toolResult.toolCallId === 'string' && toolResult.toolCallId.length > 0) {
            map.set(toolResult.toolCallId, toolResult);
        }
    }
    return map;
}

function readThoughtSegments(message: Message): string[] {
    if (Array.isArray(message.reasonings) && message.reasonings.length > 0) {
        return message.reasonings.filter(
            (segment): segment is string =>
                typeof segment === 'string' && segment.trim().length > 0
        );
    }

    const aiPresentation = message.metadata?.aiPresentation;
    if (!aiPresentation || typeof aiPresentation !== 'object' || Array.isArray(aiPresentation)) {
        return [];
    }

    const reasoningSegments = (aiPresentation as Record<string, unknown>).reasoningSegments;
    if (!Array.isArray(reasoningSegments)) {
        return [];
    }

    return reasoningSegments.filter(
        (segment): segment is string =>
            typeof segment === 'string' && segment.trim().length > 0
    );
}

interface BubbleContentSectionProps {
    contentProps: MessageBubbleContentProps;
    _message: Message;
    showToggle: boolean;
    setShowRawMarkdown: (val: boolean) => void;
    t: TranslationFn;
}

const BubbleContentSection = memo(
    ({ contentProps, _message, showToggle, setShowRawMarkdown, t }: BubbleContentSectionProps) => {
        // Sources removed as per user request

        return (
            <div className="flex flex-col gap-2">
                <MessageImages images={contentProps.images} t={t} />
                {showToggle && (
                    <RawToggle
                        active={contentProps.showRawMarkdown}
                        onClick={() => setShowRawMarkdown(!contentProps.showRawMarkdown)}
                        t={t}
                    />
                )}
                <MessageBubbleContent {...contentProps} />

            </div>
        );
    }
);

BubbleContentSection.displayName = 'BubbleContentSection';

interface MessageBubbleInnerProps {
    isUser: boolean;
    isStreaming?: boolean;
    displayContent: string;
    quotaDetails: QuotaDetails | null;
    message: Message;
    contentProps: MessageBubbleContentProps;
    actionsContextProps: MessageActionsContextProps;
    mode: CanonicalChatMode;
}

type ToolLineStatus = 'running' | 'completed' | 'failed';
type ToolActivityAction =
    | { type: 'open_file'; path: string; readOnly?: boolean }
    | { type: 'open_diff'; path: string; diffId?: string };

type TerminalCardData = {
    kind: 'terminal';
    title: string;
    cwd: string;
    command: string;
    output: string;
    exitCode?: number | null;
};

type ToolActivityLine = {
    key: string;
    status: ToolLineStatus;
    text?: string;
    action?: ToolActivityAction;
    terminal?: TerminalCardData;
};

type FileChangeItem = {
    path: string;
    displayPath: string;
    additions: number;
    deletions: number;
    diffId?: string;
    preview?: string;
};

type CanonicalChatMode = 'instant' | 'thinking' | 'agent';

function resolveCanonicalChatMode(message: Message): CanonicalChatMode {
    const aiPresentation = message.metadata?.aiPresentation;
    if (aiPresentation && typeof aiPresentation === 'object' && !Array.isArray(aiPresentation)) {
        const raw = (aiPresentation as Record<string, unknown>).systemMode;
        if (raw === 'instant' || raw === 'thinking' || raw === 'agent') {
            return raw;
        }
        if (raw === 'ask') {
            return 'instant';
        }
        if (raw === 'fast' || raw === 'architect') {
            return raw === 'fast' ? 'instant' : 'thinking';
        }
    }
    return 'thinking';
}

function normalizeForPrefix(value: string): string {
    return value.replace(/\\/g, '/').replace(/\/+$/g, '');
}

function toDisplayPath(filePath: string, basePath?: string): string {
    const rawPath = (filePath ?? '').trim();
    const rawBase = (basePath ?? '').trim();
    if (!rawPath) {
        return 'file';
    }
    if (!rawBase) {
        return rawPath.replace(/\\/g, '/');
    }
    const p = normalizeForPrefix(rawPath);
    const b = normalizeForPrefix(rawBase);
    if (b && p.toLowerCase().startsWith((b + '/').toLowerCase())) {
        return p.slice(b.length + 1);
    }
    return rawPath.replace(/\\/g, '/');
}

function extractDiffStats(value: unknown): { additions: number; deletions: number } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const v = value as Record<string, unknown>;
    const additions = typeof v.additions === 'number' && Number.isFinite(v.additions) ? v.additions : 0;
    const deletions = typeof v.deletions === 'number' && Number.isFinite(v.deletions) ? v.deletions : 0;
    if (additions === 0 && deletions === 0) {
        return null;
    }
    return { additions, deletions };
}

function extractFileChanges(message: Message): FileChangeItem[] {
    const toolCalls = buildToolCalls(message);
    const toolCallById = new Map(toolCalls.map(tc => [tc.id, tc]));

    const results = Array.isArray(message.toolResults) ? message.toolResults : [];
    const out: FileChangeItem[] = [];

    for (const toolResult of results) {
        if (!toolResult || typeof toolResult !== 'object') {
            continue;
        }
        const tr = toolResult as ToolResult;
        const call = toolCallById.get(tr.toolCallId);
        const basePath = call && typeof call.arguments?.basePath === 'string' ? String(call.arguments.basePath) : undefined;

        const payload = tr.result;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            continue;
        }
        const record = payload as Record<string, unknown>;
        const kind = typeof record.resultKind === 'string' ? record.resultKind : '';

        if (kind === 'file_write' || kind === 'file_patch' || kind === 'file_delete') {
            const pathValue = typeof record.path === 'string' ? record.path : '';
            const stats = extractDiffStats(record.diffStats);
            const diffId = typeof record.diffId === 'string' ? record.diffId : undefined;
            const preview = typeof record.diffPreview === 'string'
                ? record.diffPreview
                : (typeof record.preview === 'string' ? record.preview : undefined);
            if (!pathValue || !stats) {
                continue;
            }
            out.push({
                path: pathValue,
                displayPath: toDisplayPath(pathValue, basePath),
                additions: stats.additions,
                deletions: stats.deletions,
                diffId,
                preview,
            });
            continue;
        }

        if (kind === 'multi_file_write' && Array.isArray(record.files)) {
            for (const entry of record.files) {
                if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                    continue;
                }
                const file = entry as Record<string, unknown>;
                const pathValue = typeof file.path === 'string' ? file.path : '';
                const stats = extractDiffStats(file.diffStats);
                const diffId = typeof file.diffId === 'string' ? file.diffId : undefined;
                const preview = typeof file.diffPreview === 'string'
                    ? file.diffPreview
                    : (typeof file.preview === 'string' ? file.preview : undefined);
                if (!pathValue || !stats) {
                    continue;
                }
                out.push({
                    path: pathValue,
                    displayPath: toDisplayPath(pathValue, basePath),
                    additions: stats.additions,
                    deletions: stats.deletions,
                    diffId,
                    preview,
                });
            }
        }
    }

    // Deduplicate by (path + diffId) while keeping order.
    const seen = new Set<string>();
    return out.filter(item => {
        const key = `${item.path}::${item.diffId ?? ''}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

const TerminalToolCard = memo(({
    data,
}: {
    data: TerminalCardData;
}) => {
    const onCopy = useCallback(async () => {
        const text = data.command.trim().length > 0 ? data.command : `${data.cwd} >`;
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // ignore
        }
    }, [data.command, data.cwd]);

    const headerRight = typeof data.exitCode === 'number'
        ? `Exit code ${data.exitCode}`
        : '';
    const isRunning = data.title.toLowerCase().includes('running');
    const outputTrimmed = data.output.trim();
    // Always show an output area once the command finished so users can
    // distinguish "empty output" vs "not displayed".
    const showOutput = isRunning ? outputTrimmed.length > 0 : true;

    return (
        <div className="w-full rounded-xl border border-border/25 bg-muted/10 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
                <div className="typo-overline font-medium text-muted-foreground">
                    {data.title}
                </div>
                <div className="flex items-center gap-2">
                    {headerRight && (
                        <div className="typo-overline text-muted-foreground/70 tabular-nums">
                            {headerRight}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            void onCopy();
                        }}
                        className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/20"
                        aria-label="Copy command"
                    >
                        <IconCopy className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="mt-2 rounded-lg border border-border/20 bg-background/40 px-3 py-2 font-mono text-sm text-foreground/85">
                <div className="break-words">
                    <span className="text-muted-foreground">{data.cwd}</span>
                    <span className="text-muted-foreground"> &gt; </span>
                    <span>{data.command}</span>
                </div>
                {showOutput && (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap leading-relaxed text-foreground/80">
                        {outputTrimmed.length > 0 ? outputTrimmed.trimEnd() : 'No output'}
                    </pre>
                )}
            </div>
        </div>
    );
});

TerminalToolCard.displayName = 'TerminalToolCard';

function readToolErrorText(toolResult?: ToolResult): string {
    if (!toolResult) {
        return '';
    }
    if (typeof toolResult.error === 'string' && toolResult.error.trim().length > 0) {
        return toolResult.error.trim();
    }
    const payload = toolResult.result;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const err = (payload as Record<string, unknown>).error;
        if (typeof err === 'string' && err.trim().length > 0) {
            return err.trim();
        }
    }
    return '';
}

function buildToolLine(
    key: string,
    text: string,
    status: ToolLineStatus,
    action?: ToolActivityAction
): ToolActivityLine {
    return action ? { key, text, status, action } : { key, text, status };
}

function buildToolActivityLines(
    toolCall: ToolCallView,
    toolResult: ToolResult | undefined,
    isExecuting: boolean
): ToolActivityLine[] {
    const errorText = readToolErrorText(toolResult);
    const status: ToolLineStatus = isExecuting ? 'running' : (errorText ? 'failed' : 'completed');
    const prettyName = toolCall.name.replace(/__/g, ' ').replace(/_/g, ' ').trim() || 'tool';
    const prefix = status === 'running' ? 'Running' : status === 'failed' ? 'Failed' : 'Completed';
    const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
    return [buildToolLine(toolCall.id, `${prefix} ${prettyName}${suffix}`, status)];
}

type ThoughtTimelineEntry = {
    idx: number;
    thoughtText: string;
    expanded: boolean;
    header: string;
    lines: ToolActivityLine[];
};

function getThoughtStatusDot(lines: ToolActivityLine[]): string {
    const hasRunning = lines.some(line => line.status === 'running');
    if (hasRunning) {
        return 'bg-primary/70';
    }
    const hasFailed = lines.some(line => line.status === 'failed');
    return hasFailed ? 'bg-destructive/70' : 'bg-muted-foreground/60';
}

function renderThoughtActivityLine(line: ToolActivityLine): React.ReactNode {
    return (
        <div key={line.key} className="flex items-start gap-2 text-sm text-foreground/80">
            <span
                className={cn(
                    'mt-2 h-1.5 w-1.5 rounded-full flex-shrink-0',
                    line.status === 'running'
                        ? 'bg-primary/70'
                        : line.status === 'failed'
                            ? 'bg-destructive/70'
                            : 'bg-muted-foreground/60'
                )}
            />
            <div className="min-w-0 break-words">{line.text ?? ''}</div>
        </div>
    );
}

const ThoughtTimelineItem = memo(({
    entry,
    onToggle,
    t,
}: {
    entry: ThoughtTimelineEntry;
    onToggle: (idx: number) => void;
    t: TranslationFn;
}) => {
    const { idx, thoughtText, expanded, header, lines } = entry;
    const statusDot = getThoughtStatusDot(lines);

    return (
        <div className="w-full">
            <button
                type="button"
                onClick={() => onToggle(idx)}
                className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                    expanded ? 'bg-muted/20' : 'hover:bg-muted/15'
                )}
                aria-label={expanded ? t('frontend.chat.collapse') : t('frontend.chat.expand')}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', statusDot)} />
                    <div className="truncate text-sm font-medium text-foreground/90">{header}</div>
                </div>
                <IconChevronDown className={cn('h-4 w-4 text-muted-foreground/60 transition-transform', expanded && 'rotate-180')} />
            </button>

            {expanded && (
                <div className="px-3 pb-2 pt-2 space-y-2">
                    {thoughtText.trim().length > 0 && (
                        <div className="text-sm leading-relaxed text-foreground/85">
                            <MarkdownContent content={thoughtText} t={t} />
                        </div>
                    )}
                    {lines.length > 0 && (
                        <div className="space-y-1">
                            {lines.map(renderThoughtActivityLine)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

ThoughtTimelineItem.displayName = 'ThoughtTimelineItem';

const ThoughtTimeline = memo(({
    message,
    isStreaming,
    isLast,
    t,
}: {
    message: Message;
    isStreaming?: boolean;
    isLast: boolean;
    t: TranslationFn;
}) => {
    const thoughts = readThoughtSegments(message);
    const toolCalls = buildToolCalls(message);
    const toolResultMap = useMemo(() => buildToolResultMap(message), [message]);
    const maxThoughtIndex = useMemo(
        () => Math.max(
            thoughts.length - 1,
            toolCalls.length === 0 ? -1 : 0,
            ...toolCalls.map(tc => (typeof tc.thoughtIndex === 'number' ? tc.thoughtIndex : -1))
        ),
        [thoughts.length, toolCalls]
    );

    const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});
    const [inferredToolThoughtMap, setInferredToolThoughtMap] = useState<Record<string, number>>({});

    useEffect(() => {
        if (toolCalls.length === 0) {
            return;
        }
        const currentThoughtIndex = Math.max(0, thoughts.length - 1);
        setInferredToolThoughtMap(prev => {
            let changed = false;
            const next = { ...prev };
            for (const toolCall of toolCalls) {
                if (typeof toolCall.thoughtIndex === 'number' || next[toolCall.id] !== undefined) {
                    continue;
                }
                next[toolCall.id] = currentThoughtIndex;
                changed = true;
            }
            return changed ? next : prev;
        });
    }, [toolCalls, thoughts.length]);

    useEffect(() => {
        const latest = Math.max(0, maxThoughtIndex);
        if (isStreaming && isLast) {
            setExpandedMap(() => {
                const next: Record<number, boolean> = {};
                for (let i = 0; i <= latest; i += 1) {
                    next[i] = i === latest;
                }
                return next;
            });
            return;
        }
        if (!isStreaming && isLast) {
            setExpandedMap(() => {
                const next: Record<number, boolean> = {};
                for (let i = 0; i <= latest; i += 1) {
                    next[i] = false;
                }
                return next;
            });
        }
    }, [isStreaming, isLast, maxThoughtIndex]);

    const entries = useMemo(() => {
        if (maxThoughtIndex < 0) {
            return [] as ThoughtTimelineEntry[];
        }

        const entriesForThoughts: ThoughtTimelineEntry[] = [];
        for (let idx = 0; idx <= maxThoughtIndex; idx += 1) {
            const thoughtText = thoughts[idx] ?? '';
            const expanded = Boolean(expandedMap[idx] ?? true);
            const headerBase = thoughtText.trim().length > 0
                ? t('frontend.workspaceAgent.thoughtStep', { index: idx + 1 })
                : t('frontend.chat.usingTool');
            const durationSuffix = typeof message.responseTime === 'number' && Number.isFinite(message.responseTime)
                ? ` • ${(message.responseTime / 1000).toFixed(1)}${t('frontend.messageBubble.secondsShort')}`
                : '';
            const header = `${headerBase}${durationSuffix}`;

            const lines: ToolActivityLine[] = [];
            const toolCallsForThought = toolCalls.filter(toolCall => {
                const thoughtIndex = typeof toolCall.thoughtIndex === 'number'
                    ? toolCall.thoughtIndex
                    : (inferredToolThoughtMap[toolCall.id] ?? Math.max(0, thoughts.length - 1));
                return thoughtIndex === idx;
            });

            for (const toolCall of toolCallsForThought) {
                const result = toolResultMap.get(toolCall.id);
                const executing = Boolean(isStreaming) && !toolResultMap.has(toolCall.id);
                lines.push(...buildToolActivityLines(toolCall, result, executing));
            }

            if (thoughtText.trim().length === 0 && lines.length === 0) {
                continue;
            }

            entriesForThoughts.push({
                idx,
                thoughtText,
                expanded,
                header,
                lines,
            });
        }

        return entriesForThoughts;
    }, [expandedMap, inferredToolThoughtMap, isStreaming, maxThoughtIndex, message.responseTime, t, thoughts, toolCalls, toolResultMap]);

    if (maxThoughtIndex < 0) {
        return null;
    }

    return (
        <div className="w-full my-2 space-y-2">
            {entries.map(entry => (
                <ThoughtTimelineItem
                    key={entry.idx}
                    entry={entry}
                    onToggle={idx => setExpandedMap(prev => ({ ...prev, [idx]: !(prev[idx] ?? true) }))}
                    t={t}
                />
            ))}
        </div>
    );
});

ThoughtTimeline.displayName = 'ThoughtTimeline';
const FileChangesCard = memo(({
    changes,
}: {
    changes: FileChangeItem[];
}) => {
    const [isUndoing, setIsUndoing] = useState(false);
    const [expandedByKey, setExpandedByKey] = useState<Record<string, boolean>>({});

    const totals = useMemo(() => {
        const additions = changes.reduce((sum, c) => sum + (c.additions ?? 0), 0);
        const deletions = changes.reduce((sum, c) => sum + (c.deletions ?? 0), 0);
        return { additions, deletions };
    }, [changes]);

    const diffIds = useMemo(
        () => Array.from(new Set(changes.map(c => c.diffId).filter((id): id is string => typeof id === 'string' && id.length > 0))),
        [changes]
    );
    const canUndo = diffIds.length > 0 && !isUndoing;

    const onUndo = useCallback(async () => {
        if (!canUndo) {
            return;
        }
        setIsUndoing(true);
        try {
            for (const id of diffIds) {
                await window.electron.files.revertFileChange(id);
            }
        } finally {
            setIsUndoing(false);
        }
    }, [canUndo, diffIds]);

    const onReview = useCallback(() => {
        const first = changes[0];
        if (!first) {
            return;
        }
        navigateToWorkspace({ type: 'open_diff', path: first.path, diffId: first.diffId });
    }, [changes]);

    return (
        <div className="mt-3 overflow-hidden rounded border border-border bg-background">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground/90">
                        {changes.length} {changes.length === 1 ? 'file changed' : 'files changed'}
                    </span>
                    <span className="text-primary font-medium">+{totals.additions}</span>
                    <span className="text-destructive font-medium">-{totals.deletions}</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => {
                            void onUndo();
                        }}
                        disabled={!canUndo}
                        className={cn(
                            'flex items-center gap-1.5 text-xs transition-colors',
                            canUndo ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/30 cursor-not-allowed'
                        )}
                    >
                        {isUndoing ? <IconRefresh className="w-3.5 h-3.5 animate-spin" /> : <IconHistory className="w-3.5 h-3.5" />}
                        <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={onReview}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <span>Review</span>
                        <IconExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="divide-y divide-border/10">
                {changes.map((c, idx) => {
                    const rowKey = `${c.path}:${c.diffId ?? ''}:${idx}`;
                    const expanded = Boolean(expandedByKey[rowKey]);
                    return (
                        <div key={rowKey} className="group">
                            <button
                                type="button"
                                onClick={() => {
                                    navigateToWorkspace({ type: 'open_diff', path: c.path, diffId: c.diffId });
                                    setExpandedByKey(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
                                }}
                                className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/20"
                            >
                                <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">{c.displayPath}</span>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="tabular-nums text-xs font-medium">
                                        <span className="text-primary/80">+{c.additions}</span>
                                        <span className="ml-2 text-destructive/80">-{c.deletions}</span>
                                    </span>
                                    <IconChevronDown className={cn('w-4 h-4 text-muted-foreground/40 transition-transform', expanded && 'rotate-180')} />
                                </div>
                            </button>
                            {expanded && typeof c.preview === 'string' && c.preview.trim().length > 0 && (
                                <div className="px-4 pb-3">
                                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/10 p-2 text-xs text-foreground/80">
                                        {c.preview}
                                    </pre>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

FileChangesCard.displayName = 'FileChangesCard';

const MessageBubbleInner = memo(
    ({
        isUser,
        isStreaming,
        displayContent,
        quotaDetails,
        message,
        contentProps,
        actionsContextProps,
        mode,
    }: MessageBubbleInnerProps) => {
        const { showToggle, showActions } = createToggleVisibilityFlags(
            displayContent,
            contentProps.images.length > 0,
            isUser,
            quotaDetails
        );
        const fileChanges = useMemo(
            () => (!isUser ? extractFileChanges(message) : []),
            [isUser, message]
        );
        const inlineToolCalls = useMemo(() => {
            if (mode === 'thinking' || mode === 'agent') {
                return [] as ToolCallView[];
            }
            return buildToolCalls(message);
        }, [message, mode]);
        const inlineToolResultMap = useMemo(() => buildToolResultMap(message), [message]);

        return (
            <div className={UI_PRIMITIVES.CHAT_BUBBLE_BASE}>
                {isStreaming && <ResponseProgress />}
                <BubbleContentSection
                    contentProps={contentProps}
                    _message={message}
                    showToggle={showToggle}
                    setShowRawMarkdown={actionsContextProps.setShowRawMarkdown}
                    t={actionsContextProps.t}
                />
                {showActions && (
                    <MessageActions
                        displayContent={displayContent}
                        message={message}
                        isSpeaking={actionsContextProps.isSpeaking}
                        onStop={actionsContextProps.onStop}
                        onSpeak={actionsContextProps.onSpeak}
                        onBookmark={actionsContextProps.onBookmark}
                        onReact={actionsContextProps.onReact}
                        onRate={actionsContextProps.onRate}
                        onRegenerate={actionsContextProps.onRegenerate}
                        t={actionsContextProps.t}
                    />
                )}
                {!isUser && inlineToolCalls.length > 0 && (
                    <div className="mt-3 rounded border border-border bg-muted/10 p-2.5">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">Tool calls</div>
                        <div className="space-y-2">
                            {inlineToolCalls.map(toolCall => (
                                <div key={toolCall.id} className="rounded border border-border bg-background px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-mono text-xs text-foreground">{toolCall.name || 'tool'}</div>
                                        <span
                                            className={cn(
                                                'h-1.5 w-1.5 rounded-full',
                                                inlineToolResultMap.has(toolCall.id) ? 'bg-muted-foreground/70' : 'bg-primary/70'
                                            )}
                                        />
                                    </div>
                                    {toolCall.rawArguments.trim().length > 0 && (
                                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap border-l border-border pl-2 font-mono text-xs text-foreground/80">
                                            {toolCall.rawArguments}
                                        </pre>
                                    )}
                                    {(() => {
                                        const toolResult = inlineToolResultMap.get(toolCall.id);
                                        if (!toolResult) {
                                            return null;
                                        }
                                        const errorText = typeof toolResult.error === 'string'
                                            ? toolResult.error.trim()
                                            : '';
                                        if (errorText.length > 0) {
                                            return (
                                                <div className="mt-1 rounded border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive">
                                                    {errorText}
                                                </div>
                                            );
                                        }
                                        const resultText = (() => {
                                            try {
                                                return JSON.stringify(toolResult.result, null, 2);
                                            } catch {
                                                return '';
                                            }
                                        })();
                                        if (resultText.trim().length === 0) {
                                            return null;
                                        }
                                        return (
                                            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap border-l border-border pl-2 font-mono text-xs text-muted-foreground">
                                                {resultText}
                                            </pre>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {!isUser && fileChanges.length > 0 && (
                    <FileChangesCard changes={fileChanges} />
                )}
                {isUser && (
                    <svg
                        className="absolute -bottom-px -right-2 h-2.5 w-2 fill-current text-muted/10 pointer-events-none"
                        viewBox="0 0 8 10"
                    >
                        <path d="M0 0 L8 10 L0 10 Z" />
                    </svg>
                )}
            </div>
        );
    }
);

MessageBubbleInner.displayName = 'MessageBubbleInner';

interface PlanAndThoughtProps {
    plan: string | null;
    isLast: boolean;
    isStreaming?: boolean;
    onApprovePlan?: () => void;
    t: TranslationFn;
    mode: CanonicalChatMode;
}

const PlanAndThought = memo(
    ({
        plan,
        message,
        isLast,
        isStreaming,
        onApprovePlan,
        t,
        mode,
    }: PlanAndThoughtProps & { message: Message }) => {
        const supportsReasoningTimeline = mode === 'thinking' || mode === 'agent';
        return (
            <>
                <PlanSection
                    plan={plan}
                    isLast={isLast}
                    isStreaming={isStreaming}
                    onApprovePlan={onApprovePlan}
                    t={t}
                />
                {supportsReasoningTimeline && (
                    <ThoughtTimeline message={message} isStreaming={isStreaming} isLast={isLast} t={t} />
                )}
            </>
        );
    }
);

PlanAndThought.displayName = 'PlanAndThought';

const buildWrapperClasses = (isUser: boolean, isFocused?: boolean): string =>
    cn(
        'group/message flex w-full animate-fade-in rounded-md px-2 py-1.5 transition-colors',
        isUser ? 'justify-end' : 'justify-start',
        isFocused && 'bg-muted/30'
    );

const buildContentWrapperClasses = (isUser: boolean): string =>
    cn('flex max-w-4xl gap-3 md:max-w-3xl', isUser ? 'flex-row-reverse' : 'flex-row');

const buildColumnWrapperClasses = (isUser: boolean): string =>
    cn('flex min-w-0 flex-col gap-1', isUser ? 'items-end' : 'items-start');

export interface SingleMessageViewContentProps {
    message: Message;
    backend?: string;
    isUser: boolean;
    isStreaming?: boolean;
    interruptedToolNames: string[];
    isThoughtExpanded: boolean;
    setIsThoughtExpanded: (v: boolean) => void;
    plan: string | null;
    thought: string | null;
    streamingReasoning?: string;
    isLast: boolean;
    onApprovePlan?: () => void;
    displayContent: string;
    quotaDetails: QuotaDetails | null;
    contentProps: MessageBubbleContentProps;
    actionsContextProps: MessageActionsContextProps;
    hasReactions: boolean;
    onReact?: (emoji: string) => void;
    id?: string;
    isFocused?: boolean;
    language: Language;
    streamingSpeed?: number | null;
    t: TranslationFn;
    footerConfig?: {
        showTimestamp?: boolean;
        showTokens?: boolean;
        showModel?: boolean;
        showResponseTime?: boolean;
    };
}

export const SingleMessageViewContent = memo(
    ({
        message,
        backend,
        isUser,
        isStreaming,
        interruptedToolNames,
        plan,
        isLast,
        onApprovePlan,
        displayContent,
        quotaDetails,
        contentProps,
        actionsContextProps,
        hasReactions,
        onReact,
        id,
        isFocused,
        language,
        streamingSpeed,
        t,
        footerConfig,
    }: SingleMessageViewContentProps) => {
        const wrapperClasses = buildWrapperClasses(isUser, isFocused);
        const contentWrapperClasses = buildContentWrapperClasses(isUser);
        const columnWrapperClasses = buildColumnWrapperClasses(isUser);
        const isThoughtOnly = Boolean(message.metadata?.thoughtOnly === true);
        const mode = resolveCanonicalChatMode(message);

        return (
            <div id={id} className={wrapperClasses}>
                <div className={contentWrapperClasses}>
                    {!isUser && (
                        <AssistantLogo
                            displayModel={message.model}
                            provider={message.provider}
                            backend={backend}
                            t={t}
                        />
                    )}
                    <div className={columnWrapperClasses}>
                        <PlanAndThought
                            plan={plan}
                            message={message}
                            isLast={isLast}
                            isStreaming={isStreaming}
                            onApprovePlan={onApprovePlan}
                            t={t}
                            mode={mode}
                        />
                        {!isThoughtOnly && (
                            <>
                                <ToolRecoveryNotice
                                    interruptedToolNames={interruptedToolNames}
                                    onRegenerate={actionsContextProps.onRegenerate}
                                    t={t}
                                />
                                <MessageBubbleInner
                                    isUser={isUser}
                                    isStreaming={isStreaming}
                                    displayContent={displayContent}
                                    quotaDetails={quotaDetails}
                                    message={message}
                                    contentProps={contentProps}
                                    actionsContextProps={actionsContextProps}
                                    mode={mode}
                                />
                            </>
                        )}
                        {!isThoughtOnly && hasReactions && (
                            <div className="mb-1 mt-1 flex flex-wrap gap-1 px-1">
                                {message.reactions?.map((emoji, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => onReact?.(emoji)}
                                        className={UI_PRIMITIVES.REACTION_BADGE}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                        {!isThoughtOnly &&
                            !isUser &&
                            !quotaDetails &&
                            (displayContent || contentProps.images.length > 0) && (
                                <MessageFooter
                                    message={message}
                                    displayContent={displayContent}
                                    language={language}
                                    isStreaming={isStreaming}
                                    streamingSpeed={streamingSpeed}
                                    config={footerConfig}
                                />
                            )}
                    </div>
                </div>
            </div>
        );
    }
);

SingleMessageViewContent.displayName = 'SingleMessageViewContent';



