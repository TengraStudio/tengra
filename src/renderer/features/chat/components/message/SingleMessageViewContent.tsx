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
import { IconChevronDown, IconCopy } from '@tabler/icons-react';
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
import { MessageSources } from './MessageSources';
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

interface BubbleContentSectionProps {
    contentProps: MessageBubbleContentProps;
    message: Message;
    showToggle: boolean;
    setShowRawMarkdown: (val: boolean) => void;
    t: TranslationFn;
}

const BubbleContentSection = memo(
    ({ contentProps, message, showToggle, setShowRawMarkdown, t }: BubbleContentSectionProps) => (
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
            <MessageSources
                sources={message.sources ?? []}
                onSourceClick={contentProps.onSourceClick}
                t={t}
            />
        </div>
    )
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
}

type ToolLineStatus = 'running' | 'completed' | 'failed';
type ToolActivityAction =
    | { type: 'open_file'; path: string; readOnly?: boolean }
    | { type: 'open_diff'; path: string };
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

function basename(pathValue: string): string {
    const trimmed = pathValue.trim();
    if (!trimmed) {
        return trimmed;
    }
    return trimmed.split(/[\\/]/).pop() || trimmed;
}

type FileChangeItem = {
    path: string;
    displayPath: string;
    additions: number;
    deletions: number;
    diffId?: string;
};

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

function extractStringField(value: unknown, key: string): string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return '';
    }
    const record = value as Record<string, unknown>;
    const v = record[key];
    return typeof v === 'string' ? v : '';
}

function extractNumberField(value: unknown, key: string): number | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const v = record[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function extractTerminalOutput(value: unknown): string {
    // Different providers/tools return terminal text under different keys.
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return '';
    }
    const record = value as Record<string, unknown>;

    const direct =
        extractStringField(record, 'output')
        || extractStringField(record, 'stdout')
        || '';

    const stderr = extractStringField(record, 'stderr');
    if (direct || stderr) {
        return [direct, stderr].filter(Boolean).join(direct && stderr ? '\n' : '');
    }

    // Some IPC responses wrap payload as { data/result/content: { ... } }
    const nested = record.data ?? record.result ?? record.content;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const n = nested as Record<string, unknown>;
        const nestedOut =
            extractStringField(n, 'output')
            || extractStringField(n, 'stdout')
            || '';
        const nestedErr = extractStringField(n, 'stderr');
        if (nestedOut || nestedErr) {
            return [nestedOut, nestedErr].filter(Boolean).join(nestedOut && nestedErr ? '\n' : '');
        }
    }

    // Don't fall back to "message" here. Many terminal tools include a generic
    // status message (e.g. "session is persistent") which is not command output.
    return '';
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
            if (!pathValue || !stats) {
                continue;
            }
            out.push({
                path: pathValue,
                displayPath: toDisplayPath(pathValue, basePath),
                additions: stats.additions,
                deletions: stats.deletions,
                diffId,
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
                if (!pathValue || !stats) {
                    continue;
                }
                out.push({
                    path: pathValue,
                    displayPath: toDisplayPath(pathValue, basePath),
                    additions: stats.additions,
                    deletions: stats.deletions,
                    diffId,
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
                        onClick={onCopy}
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

function getToolArgsPaths(args: Record<string, JsonValue>): string[] {
    const paths: string[] = [];
    if (Array.isArray(args.files)) {
        for (const entry of args.files) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                continue;
            }
            const record = entry as Record<string, JsonValue>;
            const p = typeof record.path === 'string' ? record.path : (typeof record.file === 'string' ? record.file : '');
            if (p.trim().length > 0) {
                paths.push(p);
            }
        }
    }
    const direct = typeof args.path === 'string'
        ? args.path
        : (typeof args.file === 'string' ? args.file : '');
    if (direct.trim().length > 0) {
        paths.push(direct);
    }
    return Array.from(new Set(paths));
}

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

function buildToolActivityLines(
    toolCall: ToolCallView,
    toolResult: ToolResult | undefined,
    isExecuting: boolean
): ToolActivityLine[] {
    const name = toolCall.name;
    const args = toolCall.arguments ?? {};
    const errorText = readToolErrorText(toolResult);
    const status: ToolLineStatus = isExecuting ? 'running' : (errorText ? 'failed' : 'completed');

    // Providers use slightly different naming conventions (e.g. mcp_filesystem_list vs filesystem__list).
    const isFsWrite =
        name.includes('filesystem__write')
        || name.includes('filesystem_write')
        || name.includes('mcp_filesystem_write')
        || name === 'write_file'
        || name === 'write_files';
    const isFsRead =
        name.includes('filesystem__read')
        || name.includes('filesystem_read')
        || name.includes('mcp_filesystem_read')
        || name === 'read_file';
    const isFsList =
        name.includes('filesystem__list')
        || name.includes('filesystem_list')
        || name.includes('mcp_filesystem_list')
        || name === 'list_directory'
        || name === 'list_dir';
    const isSearch = name.includes('search') && !name.includes('web');
    const isCmd =
        name.includes('terminal__run_command')
        || name.includes('terminal_run_command')
        || name.includes('mcp_terminal_run_command')
        || name === 'execute_command';
    const isPatch = name === 'patch_file' || name === 'edit_file';

    const isFsMkdir =
        name.includes('create_directory')
        || name.includes('filesystem__create_directory')
        || name.includes('mcp_filesystem_create_directory');
    const isFsDeleteFile =
        name.includes('delete_file')
        || name.includes('filesystem__delete_file')
        || name.includes('mcp_filesystem_delete_file');
    const isFsDeleteDir =
        name.includes('delete_directory')
        || name.includes('filesystem__delete_directory')
        || name.includes('mcp_filesystem_delete_directory');
    const isFsRename =
        name.includes('rename_path')
        || name.includes('filesystem__rename_path')
        || name.includes('mcp_filesystem_rename_path');
    const isFsCopy =
        name.includes('copy_path')
        || name.includes('filesystem__copy_path')
        || name.includes('mcp_filesystem_copy_path');
    const isFsExists =
        name.includes('exists')
        || name.includes('filesystem__exists')
        || name.includes('mcp_filesystem_exists');

    if (isFsWrite) {
        const paths = getToolArgsPaths(args).filter(Boolean);
        if (paths.length === 0) {
            return [{ key: toolCall.id, text: status === 'running' ? 'Creating file(s)...' : 'Created file(s)', status }];
        }
        const verb = status === 'running' ? 'Creating' : status === 'failed' ? 'Failed' : 'Created';
        return paths.map((p, i) => ({
            key: `${toolCall.id}:${i}`,
            text: `${verb} 1 file(s): ${basename(p)}${status === 'failed' && errorText ? ` — ${errorText}` : ''}`,
            status,
            action: status === 'failed' ? undefined : { type: 'open_file', path: p, readOnly: true },
        }));
    }

    if (isFsRead) {
        const pathValue = typeof args.path === 'string' ? args.path : (typeof args.file === 'string' ? args.file : '');
        const fileName = basename(pathValue || '');
        const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
        return [{
            key: toolCall.id,
            // Keep it minimal: just the file name. Status is shown via the dot.
            text: `${fileName || 'file'}${suffix}`,
            status,
            action: status === 'failed' || !pathValue ? undefined : { type: 'open_file', path: pathValue, readOnly: true },
        }];
    }

    if (isFsList) {
        const argPath = typeof args.path === 'string' ? args.path : '';
        const folderName = basename(argPath || '');
        if (status === 'running') {
            return [{ key: toolCall.id, text: `Exploring ${folderName || 'folder'}`, status }];
        }
        const payload = toolResult?.result;
        const basePath = payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (typeof (payload as Record<string, unknown>).path === 'string' ? (payload as Record<string, unknown>).path as string : '')
            : '';
        const entries = payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray((payload as Record<string, unknown>).entries)
            ? ((payload as Record<string, unknown>).entries as unknown[])
            : [];
        const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
        const baseName = basename(basePath || argPath || '');
        return [{
            key: toolCall.id,
            text: `${status === 'failed' ? 'Failed' : 'Found'} ${entries.length} item(s) in ${baseName || 'folder'} folder${suffix}`,
            status,
        }];
    }

    if (isFsMkdir) {
        const pathValue = typeof args.path === 'string' ? args.path : '';
        const folderName = basename(pathValue || '');
        const verb = status === 'running' ? 'Creating' : status === 'failed' ? 'Failed' : 'Created';
        const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
        return [{
            key: toolCall.id,
            text: `${verb} folder: ${folderName || 'folder'}${suffix}`,
            status,
        }];
    }

    if (isFsDeleteFile || isFsDeleteDir) {
        const pathValue = typeof args.path === 'string' ? args.path : '';
        const nameValue = basename(pathValue || '');
        const noun = isFsDeleteDir ? 'folder' : 'file';
        const verb = status === 'running' ? 'Deleting' : status === 'failed' ? 'Failed' : 'Deleted';
        const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
        return [{
            key: toolCall.id,
            text: `${verb} ${noun}: ${nameValue || noun}${suffix}`,
            status,
        }];
    }

    if (isFsRename) {
        const oldPath = typeof (args as Record<string, JsonValue>).oldPath === 'string' ? String((args as Record<string, JsonValue>).oldPath) : '';
        const newPath = typeof (args as Record<string, JsonValue>).newPath === 'string' ? String((args as Record<string, JsonValue>).newPath) : '';
        const fromName = basename(oldPath || '');
        const toName = basename(newPath || '');
        const verb = status === 'running' ? 'Renaming' : status === 'failed' ? 'Failed' : 'Renamed';
        const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
        return [{
            key: toolCall.id,
            text: `${verb}: ${fromName || 'item'} → ${toName || 'item'}${suffix}`,
            status,
        }];
    }

    if (isFsCopy) {
        const sourcePath = typeof (args as Record<string, JsonValue>).sourcePath === 'string' ? String((args as Record<string, JsonValue>).sourcePath) : '';
        const destinationPath = typeof (args as Record<string, JsonValue>).destinationPath === 'string' ? String((args as Record<string, JsonValue>).destinationPath) : '';
        const fromName = basename(sourcePath || '');
        const toName = basename(destinationPath || '');
        const verb = status === 'running' ? 'Copying' : status === 'failed' ? 'Failed' : 'Copied';
        const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
        return [{
            key: toolCall.id,
            text: `${verb}: ${fromName || 'item'} → ${toName || 'item'}${suffix}`,
            status,
        }];
    }

    if (isFsExists) {
        const pathValue = typeof args.path === 'string' ? args.path : '';
        const nameValue = basename(pathValue || '');
        const verb = status === 'running' ? 'Checking' : status === 'failed' ? 'Failed' : 'Checked';
        const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
        return [{
            key: toolCall.id,
            text: `${verb}: ${nameValue || 'path'}${suffix}`,
            status,
        }];
    }

    if (isSearch) {
        if (status === 'running') {
            return [{ key: toolCall.id, text: 'Searching files...', status }];
        }
        const payload = toolResult?.result;
        const results = payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray((payload as Record<string, unknown>).results)
            ? ((payload as Record<string, unknown>).results as unknown[])
            : [];
        if (results.length === 0) {
            const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
            return [{ key: toolCall.id, text: `${status === 'failed' ? 'Failed' : 'No results'}${suffix}`.trim(), status }];
        }
        return [{
            key: toolCall.id,
            text: `Found ${results.length} result(s)`,
            status,
        }];
    }

    if (isPatch) {
        const pathValue = typeof args.path === 'string' ? args.path : (typeof args.file === 'string' ? args.file : '');
        const fileName = basename(pathValue || '');
        const verb = status === 'running' ? 'Updating' : status === 'failed' ? 'Failed' : 'Updated';
        const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
        return [{
            key: toolCall.id,
            text: `${verb} ${fileName || 'file'}${suffix}`,
            status,
            action: status === 'failed' || !pathValue ? undefined : { type: 'open_diff', path: pathValue },
        }];
    }

    if (isCmd) {
        const cmd = typeof args.command === 'string' ? args.command.trim() : '';
        const base = cmd.length > 0 ? cmd.split(/\s+/)[0] : 'command';
        if (status === 'running') {
            return [{ key: toolCall.id, text: `Running ${base}`, status }];
        }
        const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
        return [{ key: toolCall.id, text: `${status === 'failed' ? 'Failed' : 'Ran'} ${base}${suffix}`, status }];
    }

    const suffix = status === 'failed' && errorText ? ` — ${errorText}` : '';
    const categoryKey = (() => {
        const lower = name.toLowerCase();
        const argKeys = Object.keys(args ?? {});

        // 1) Name-based classification (fast path)
        if (lower.includes('filesystem')) { return 'files'; }
        if (lower.includes('terminal')) { return 'command'; }
        if (lower.includes('git')) { return 'git'; }
        if (lower.includes('clipboard')) { return 'clipboard'; }
        if (lower.includes('web')) { return 'web'; }
        if (lower.includes('screenshot') || lower.includes('capture')) { return 'screenshot'; }
        if (lower.includes('workspace')) { return 'workspace'; }
        if (lower.includes('process')) { return 'process'; }
        if (lower.includes('performance')) { return 'performance'; }
        if (lower.includes('system')) { return 'system'; }
        if (lower.includes('proxy')) { return 'proxy'; }

        // 2) Args-based heuristics (covers providers that omit "filesystem/terminal" in tool names)
        if (argKeys.some(k => k.toLowerCase() === 'command' || k.toLowerCase() === 'cmd')) { return 'command'; }
        if (argKeys.some(k => k.toLowerCase() === 'cwd')) { return 'command'; }
        if (argKeys.some(k => ['path', 'file', 'files', 'oldpath', 'newpath', 'sourcepath', 'destinationpath'].includes(k.toLowerCase()))) {
            return 'files';
        }
        if (argKeys.some(k => ['url', 'href', 'query'].includes(k.toLowerCase()))) { return 'web'; }

        return 'background';
    })();

    const friendly = (() => {
        const lower = name.toLowerCase();
        if (categoryKey === 'system') {
            if (lower.includes('env')) { return 'Checked environment'; }
            if (lower.includes('gpu')) { return 'Checked graphics'; }
            if (lower.includes('health')) { return 'Checked health'; }
            if (lower.includes('info')) { return 'Checked computer info'; }
            return 'Checked computer';
        }
        if (categoryKey === 'process') {
            if (lower.includes('spawn')) { return 'Started a task'; }
            if (lower.includes('kill')) { return 'Stopped a task'; }
            if (lower.includes('list')) { return 'Checked running tasks'; }
            return 'Checked running tasks';
        }

        switch (categoryKey) {
            case 'files':
                return 'File updated';
            case 'command':
                return 'Command ran';
            case 'git':
                return 'Checked changes';
            case 'clipboard':
                return 'Copied';
            case 'web':
                return 'Checked web';
            case 'screenshot':
                return 'Captured screenshot';
            case 'workspace':
                return 'Checked project';
            case 'performance':
                return 'Checked performance';
            case 'proxy':
                return 'Synced service';
            default:
                return 'Background task finished';
        }
    })();

    const text = status === 'running'
        ? 'Working in background…'
        : status === 'failed'
            ? `Failed: ${friendly}${suffix}`
            : `${friendly}${suffix}`;

    return [{ key: toolCall.id, text, status }];
}

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
    const toolCalls = buildToolCalls(message);
    const toolResultMap = buildToolResultMap(message);
    const thoughts = Array.isArray(message.reasonings) ? message.reasonings : [];

    const maxThoughtIndex = Math.max(
        thoughts.length - 1,
        ...toolCalls.map(tc => (typeof tc.thoughtIndex === 'number' ? tc.thoughtIndex : -1))
    );

    const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});
    const [inferredToolThoughtMap, setInferredToolThoughtMap] = useState<Record<string, number>>({});

    // Assign tools (without explicit thoughtIndex) to the current thought *once*,
    // so they don't "jump" to the last thought when new thought blocks arrive.
    useEffect(() => {
        if (toolCalls.length === 0) {
            return;
        }
        const currentThoughtIndex = Math.max(0, thoughts.length - 1);
        setInferredToolThoughtMap(prev => {
            let changed = false;
            const next = { ...prev };
            for (const tc of toolCalls) {
                if (typeof tc.thoughtIndex === 'number') {
                    continue;
                }
                if (next[tc.id] !== undefined) {
                    continue;
                }
                next[tc.id] = currentThoughtIndex;
                changed = true;
            }
            return changed ? next : prev;
        });
    }, [toolCalls, thoughts.length]);

    useEffect(() => {
        const latest = Math.max(0, maxThoughtIndex);

        // While streaming the last message, keep only the newest thought open.
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

        // Once the last message is done, collapse all thoughts by default.
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

    if (maxThoughtIndex < 0) {
        return null;
    }

    return (
        <div className="w-full my-2 space-y-2">
            {Array.from({ length: maxThoughtIndex + 1 }).map((_, idx) => {
                const thoughtText = thoughts[idx] ?? '';
                const expanded = Boolean(expandedMap[idx] ?? true);
                const headerBase = t('workspaceAgent.thoughtStep', { index: idx + 1 });
                const durationSuffix = typeof message.responseTime === 'number' && Number.isFinite(message.responseTime)
                    ? ` • ${(message.responseTime / 1000).toFixed(1)}${t('messageBubble.secondsShort')}`
                    : '';
                const header = `${headerBase}${durationSuffix}`;

                const lines: ToolActivityLine[] = [];

                // Build per-thought tool lines with a small amount of aggregation for terminal commands.
                const terminalSessionMeta = new Map<string, { cwd: string }>();
                const terminalBlocksBySession = new Map<string, TerminalCardData>();

                const toolCallsForThought = toolCalls.filter(toolCall => {
                    const thoughtIndex = typeof toolCall.thoughtIndex === 'number'
                        ? toolCall.thoughtIndex
                        : (inferredToolThoughtMap[toolCall.id] ?? Math.max(0, thoughts.length - 1));
                    return thoughtIndex === idx;
                });

                for (const toolCall of toolCallsForThought) {
                    const result = toolResultMap.get(toolCall.id);
                    const executing = Boolean(isStreaming) && !toolResultMap.has(toolCall.id);
                    const name = toolCall.name;
                    const args = toolCall.arguments ?? {};

                    // --- Terminal (fake terminal UI) ---
                    if (name === 'terminal_session_start') {
                        const sessionId = typeof args.sessionId === 'string' ? args.sessionId : '';
                        const cwd = typeof args.cwd === 'string' ? args.cwd : '';
                        if (sessionId) {
                            terminalSessionMeta.set(sessionId, { cwd: cwd || '.' });
                        }
                        continue; // Don't show a line for session start.
                    }

                    if (name === 'terminal_session_write') {
                        const sessionId = typeof args.sessionId === 'string' ? args.sessionId : '';
                        const input = typeof args.input === 'string' ? args.input : '';
                        const inputKind = args.inputKind === 'input' ? 'input' : 'command';
                        if (sessionId && inputKind === 'command' && input.trim().length > 0) {
                            const cwd = terminalSessionMeta.get(sessionId)?.cwd ?? '.';
                            const card: TerminalCardData = {
                                kind: 'terminal',
                                title: executing ? 'Running background command' : 'Ran background command',
                                cwd,
                                command: input.trim(),
                                output: '',
                                exitCode: null,
                            };
                            terminalBlocksBySession.set(sessionId, card);
                            lines.push({ key: toolCall.id, status: executing ? 'running' : (result?.success === false ? 'failed' : 'completed'), terminal: card });
                            continue;
                        }
                        // Non-command input: keep minimal.
                        continue;
                    }

                    if (name === 'terminal_session_wait' || name === 'terminal_session_read') {
                        const sessionId = typeof args.sessionId === 'string' ? args.sessionId : '';
                        const payload = result?.result;
                        const output = extractTerminalOutput(payload);
                        const exitCode = extractNumberField(payload, 'exitCode');
                        const cwd = terminalSessionMeta.get(sessionId)?.cwd ?? '.';
                        if (sessionId) {
                            const existing = terminalBlocksBySession.get(sessionId);
                            if (existing) {
                                if (output.trim().length > 0) {
                                    existing.output = output;
                                }
                                if (typeof exitCode === 'number') {
                                    existing.exitCode = exitCode;
                                }
                                continue;
                            }
                            // Output without a visible command: show it as a standalone terminal block.
                            if (output.trim().length > 0 || typeof exitCode === 'number') {
                                const card: TerminalCardData = {
                                    kind: 'terminal',
                                    title: 'Terminal output',
                                    cwd,
                                    command: '',
                                    output,
                                    exitCode: typeof exitCode === 'number' ? exitCode : null,
                                };
                                lines.push({ key: toolCall.id, status: executing ? 'running' : (result?.success === false ? 'failed' : 'completed'), terminal: card });
                            }
                            continue;
                        }
                    }

                    const isCmd = name.includes('terminal__run_command') || name === 'execute_command';
                    if (isCmd) {
                        const cmd = typeof (args as Record<string, unknown>).command === 'string'
                            ? String((args as Record<string, unknown>).command).trim()
                            : '';
                        const cwd = typeof (args as Record<string, unknown>).cwd === 'string'
                            ? String((args as Record<string, unknown>).cwd).trim()
                            : '.';
                        const payload = result?.result;
                        const output = extractTerminalOutput(payload);
                        const exitCode = extractNumberField(payload, 'exitCode');
                        const card: TerminalCardData = {
                            kind: 'terminal',
                            title: executing ? 'Running background command' : 'Ran background command',
                            cwd: cwd || '.',
                            command: cmd,
                            output: output || '',
                            exitCode: typeof exitCode === 'number' ? exitCode : null,
                        };
                        lines.push({ key: toolCall.id, status: executing ? 'running' : (result?.success === false ? 'failed' : 'completed'), terminal: card });
                        continue;
                    }

                    // --- Default tool lines ---
                    lines.push(...buildToolActivityLines(toolCall, result, executing));
                }

                if (thoughtText.trim().length === 0 && lines.length === 0) {
                    return null;
                }

                const statusDot = (() => {
                    const hasRunning = lines.some(l => l.status === 'running');
                    const hasFailed = lines.some(l => l.status === 'failed');
                    if (hasRunning) {
                        return 'bg-primary/70';
                    }
                    if (hasFailed) {
                        return 'bg-destructive/70';
                    }
                    return 'bg-muted-foreground/60';
                })();

                return (
                    <div key={idx} className="w-full">
                        <button
                            type="button"
                            onClick={() => setExpandedMap(prev => ({ ...prev, [idx]: !(prev[idx] ?? true) }))}
                            className={cn(
                                'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                                expanded ? 'bg-muted/20' : 'hover:bg-muted/15'
                            )}
                            aria-label={expanded ? t('chat.collapse') : t('chat.expand')}
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
                                        {lines.map(line => (
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
                                                {line.terminal ? (
                                                    <div className="min-w-0 flex-1">
                                                        <TerminalToolCard data={line.terminal} />
                                                    </div>
                                                ) : line.action ? (
                                                    <button
                                                        type="button"
                                                        className="min-w-0 break-words text-left hover:underline"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (line.action?.type === 'open_file') {
                                                                navigateToWorkspace({ type: 'open_file', path: line.action.path, readOnly: line.action.readOnly });
                                                            } else if (line.action?.type === 'open_diff') {
                                                                navigateToWorkspace({ type: 'open_diff', path: line.action.path });
                                                            }
                                                        }}
                                                    >
                                                        {line.text ?? ''}
                                                    </button>
                                                ) : (
                                                    <div className="min-w-0 break-words">{line.text ?? ''}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});

ThoughtTimeline.displayName = 'ThoughtTimeline';

const FileChangesCard = memo(({
    changes,
    t,
}: {
    changes: FileChangeItem[];
    t: TranslationFn;
}) => {
    const [isUndoing, setIsUndoing] = useState(false);

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
                // Best-effort. If one fails, keep going.

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
        navigateToWorkspace({ type: 'open_diff', path: first.path });
    }, [changes]);

    return (
        <div className="mt-3 rounded-xl border border-border/30 bg-muted/10 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground/90">
                        {changes.length} {changes.length === 1 ? 'file changed' : 'files changed'}
                    </span>
                    <span className="ml-2 text-primary/90">+{totals.additions}</span>
                    <span className="ml-1 text-destructive/90">-{totals.deletions}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onUndo}
                        disabled={!canUndo}
                        className={cn(
                            'text-sm font-medium',
                            canUndo ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/40 cursor-not-allowed'
                        )}
                        aria-label={t('chat.undo')}
                    >
                        {isUndoing ? t('common.loading') : 'Undo'}
                    </button>
                    <button
                        type="button"
                        onClick={onReview}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground"
                        aria-label={t('chat.review')}
                    >
                        Review
                    </button>
                </div>
            </div>

            <div className="mt-2 space-y-1">
                {changes.map((c, idx) => (
                    <button
                        key={`${c.path}:${c.diffId ?? ''}:${idx}`}
                        type="button"
                        onClick={() => navigateToWorkspace({ type: 'open_diff', path: c.path })}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left text-sm text-foreground/80 hover:bg-muted/20"
                    >
                        <span className="min-w-0 break-words">{c.displayPath}</span>
                        <span className="flex-shrink-0 tabular-nums">
                            <span className="text-primary/90">+{c.additions}</span>
                            <span className="ml-2 text-destructive/90">-{c.deletions}</span>
                        </span>
                    </button>
                ))}
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
    }: MessageBubbleInnerProps) => {
        const { showToggle, showActions } = createToggleVisibilityFlags(
            displayContent,
            contentProps.images.length > 0,
            isUser,
            quotaDetails
        );
        const fileChanges = useMemo(
            () => (!isUser ? extractFileChanges(message) : []),
            [isUser, message.toolCalls, message.toolResults]
        );

        return (
            <div className={UI_PRIMITIVES.CHAT_BUBBLE_BASE}>
                {isStreaming && <ResponseProgress />}
                <BubbleContentSection
                    contentProps={contentProps}
                    message={message}
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
                {!isUser && fileChanges.length > 0 && (
                    <FileChangesCard changes={fileChanges} t={actionsContextProps.t} />
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
}

const PlanAndThought = memo(
    ({
        plan,
        message,
        isLast,
        isStreaming,
        onApprovePlan,
        t,
    }: PlanAndThoughtProps & { message: Message }) => {
        return (
            <>
                <PlanSection
                    plan={plan}
                    isLast={isLast}
                    isStreaming={isStreaming}
                    onApprovePlan={onApprovePlan}
                    t={t}
                />
                <ThoughtTimeline message={message} isStreaming={isStreaming} isLast={isLast} t={t} />
            </>
        );
    }
);

PlanAndThought.displayName = 'PlanAndThought';

const buildWrapperClasses = (isUser: boolean, isFocused?: boolean): string =>
    cn(
        'flex w-full animate-fade-in group/message rounded-2xl p-2 transition-all duration-300',
        isUser ? 'justify-end' : 'justify-start',
        isFocused && 'bg-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/5'
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
