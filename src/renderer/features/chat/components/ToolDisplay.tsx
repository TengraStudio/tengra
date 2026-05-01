/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { JsonObject, JsonValue } from '@shared/types/common';
import { IconChevronDown, IconLoader2 } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';

import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import { navigateToWorkspace } from '@/features/workspace/utils/workspace-navigation';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { ToolResult } from '@/types';

import { TerminalView } from './TerminalView';


interface CommandExecutionResult {
    stdout?: string;
    stderr?: string;
    error?: string;
}

interface ToolCallType {
    id: string;
    name: string;
    arguments: JsonObject;
}

interface ToolDisplayProps {
    toolCall: ToolCallType;
    result?: ToolResult;
    isExecuting?: boolean;
    language?: Language;
}

type ToolStatus = 'running' | 'completed' | 'failed';
type Translator = (key: string, options?: Record<string, string | number>) => string;

const FriendlyToolNames: Record<string, string> = {
    'list_directory': 'analyzingProject',
    'read_file': 'readingFiles',
    'write_file': 'writeFileSummary',
    'write_files': 'writeFileSummary',
    'patch_file': 'editFileSummary',
    'execute_command': 'executingCmd',
    'capture_screenshot': 'screenshotting',
    'search_web': 'searching',
    'grep_search': 'readingFiles',
    'list_files': 'analyzingProject',
    'search_files': 'searchingFiles',
};

function normalizeToolName(toolName: string, args: JsonObject): string {
    // Tool calls may come through directly (read_file) or via MCP (mcp__filesystem__read).
    switch (toolName) {
        case 'mcp__filesystem__read':
            return 'read_file';
        case 'mcp__filesystem__write':
            return Array.isArray(args.files) ? 'write_files' : 'write_file';
        case 'mcp__filesystem__list':
            return 'list_directory';
        case 'mcp__terminal__run_command':
            return 'execute_command';
        case 'mcp__web__search':
            return 'search_web';
        default:
            return toolName;
    }
}

function getFilePathsFromArgs(args: JsonObject): string[] {
    const paths: string[] = [];
    if (Array.isArray(args.files)) {
        for (const f of args.files) {
            if (!f || typeof f !== 'object' || Array.isArray(f)) {
                continue;
            }
            const fileRecord = f as JsonObject;
            const path = typeof fileRecord.path === 'string'
                ? fileRecord.path
                : (typeof fileRecord.file === 'string' ? fileRecord.file : '');
            if (path.trim().length > 0) {
                paths.push(path);
            }
        }
    }
    const primary = getPrimaryPath(args);
    if (primary.trim().length > 0) {
        paths.push(primary);
    }
    return Array.from(new Set(paths));
}

function summarizeNameList(names: string[], max: number = 3): string {
    const cleaned = names.map(n => n.trim()).filter(Boolean);
    if (cleaned.length === 0) {
        return '';
    }
    if (cleaned.length <= max) {
        return cleaned.join(', ');
    }
    return `${cleaned.slice(0, max).join(', ')} +${cleaned.length - max}`;
}

function getPrimaryPath(args: JsonObject): string {
    if (Array.isArray(args.files) && args.files.length > 0) {
        const firstFile = args.files[0];
        if (firstFile && typeof firstFile === 'object' && !Array.isArray(firstFile)) {
            const fileRecord = firstFile as JsonObject;
            if (typeof fileRecord.path === 'string' && fileRecord.path.trim().length > 0) {
                return fileRecord.path;
            }
            if (typeof fileRecord.file === 'string' && fileRecord.file.trim().length > 0) {
                return fileRecord.file;
            }
        }
    }
    const candidates = [
        args.path,
        args.file,
        args.rootPath,
        args.SearchPath,
        args.TargetFile,
        args.command,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate;
        }
    }
    return '';
}

function summarizePathValue(pathValue: string): string {
    const trimmedPath = pathValue.trim();
    if (trimmedPath.length === 0) {
        return trimmedPath;
    }
    const lastSegment = trimmedPath.split(/[\\/]/).pop();
    return lastSegment && lastSegment.length > 0 ? lastSegment : trimmedPath;
}

function countResultItems(result: JsonValue): number {
    if (typeof result === 'string') {
        const trimmed = result.trim();
        if (trimmed.length === 0) {
            return 0;
        }
        return trimmed.split(/\r?\n/).length;
    }
    if (!result || typeof result !== 'object') {
        return 0;
    }
    if (Array.isArray(result)) {
        return result.length;
    }

    const record = result as JsonObject;
    const listCandidates = [record.results, record.items, record.entries, record.files];
    for (const candidate of listCandidates) {
        if (Array.isArray(candidate)) {
            return candidate.length;
        }
    }

    const content = record.content;
    if (typeof content === 'string') {
        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) {
            return 0;
        }
        return trimmedContent.split(/\r?\n/).length;
    }
    return 0;
}

function getToolSummaryText(
    toolCall: ToolCallType,
    result: ToolResult | undefined,
    isExecuting: boolean,
    hasError: boolean,
    t: Translator
): string {
    const toolName = toolCall.name;
    const filePaths = getFilePathsFromArgs(toolCall.arguments);
    const fileNames = filePaths.map(summarizePathValue).filter(Boolean);
    const fileList = summarizeNameList(fileNames);
    const primaryPath = summarizePathValue(getPrimaryPath(toolCall.arguments));

    if (isExecuting) {
        if (toolName === 'read_file') {
            const path = primaryPath || fileList;
            return path ? t('frontend.tools.analyzingFile', { path }) : t('frontend.tools.readingFiles');
        }
        if (toolName === 'list_directory' || toolName === 'list_files' || toolName === 'list_dir') {
            return primaryPath ? t('frontend.tools.analyzingPath', { path: primaryPath }) : t('frontend.tools.analyzingProject');
        }
        if (toolName === 'write_file' || toolName === 'write_files') {
            return t('frontend.tools.writingFiles', { count: fileNames.length || 1 });
        }
        const key = FriendlyToolNames[toolName] || 'usingTool';
        return t(`tools.${key}`);
    }

    if (hasError) {
        return t('frontend.tools.failed');
    }

    if (toolName === 'list_directory' || toolName === 'list_files') {
        return t('frontend.tools.listDirSummary', {
            count: countResultItems(result?.result ?? []),
        });
    }
    if (toolName === 'read_file') {
        return t('frontend.tools.readFileSummary', { path: primaryPath });
    }
    if (toolName === 'write_file' || toolName === 'write_files') {
        return t('frontend.tools.filesWrittenSummary', {
            count: fileNames.length || 1,
            files: fileList || primaryPath,
        });
    }
    if (toolName === 'patch_file' || toolName === 'edit_file') {
        return t('frontend.tools.editFileSummary', { path: primaryPath });
    }

    return t('frontend.tools.completed');
}

function readToolError(result?: ToolResult): string | undefined {
    if (!result) {
        return undefined;
    }
    if (typeof result.error === 'string' && result.error.trim().length > 0) {
        return result.error;
    }
    const payload = result.result;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return undefined;
    }
    const errorValue = (payload as JsonObject).error;
    if (typeof errorValue === 'string' && errorValue.trim().length > 0) {
        return errorValue;
    }
    return undefined;
}

function useAutoExpandCommand(
    toolName: string,
    isExecuting: boolean | undefined,
    execError: string | undefined,
    execStderr: string | undefined,
    setExpanded: React.Dispatch<React.SetStateAction<boolean>>
): void {
    useEffect(() => {
        if (toolName !== 'execute_command') {
            return;
        }
        const shouldExpand = Boolean(isExecuting) || Boolean(execError) || Boolean(execStderr);
        if (!shouldExpand) {
            return;
        }
        const timer = setTimeout(() => setExpanded(true), 0);
        return () => clearTimeout(timer);
    }, [toolName, isExecuting, execError, execStderr, setExpanded]);
}

function extractSearchResults(result: JsonValue): JsonObject[] {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        return [];
    }
    const resultsValue = (result as JsonObject).results;
    if (!Array.isArray(resultsValue)) {
        return [];
    }
    return resultsValue.filter((item): item is JsonObject => !!item && typeof item === 'object' && !Array.isArray(item));
}

type DirectoryEntry = { name: string; isDirectory: boolean };

function extractDirectoryEntries(result: JsonValue): DirectoryEntry[] {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        return [];
    }
    const record = result as JsonObject;
    const entriesValue = Array.isArray(record.entries)
        ? record.entries
        : (Array.isArray(record.files) ? record.files : (Array.isArray(record.items) ? record.items : null));

    if (!entriesValue) {
        return [];
    }

    const entries: DirectoryEntry[] = [];
    for (const entry of entriesValue) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            continue;
        }
        const obj = entry as JsonObject;
        const name = typeof obj.name === 'string'
            ? obj.name
            : (typeof obj.path === 'string' ? obj.path : '');
        if (name.trim().length === 0) {
            continue;
        }
        const isDirectory = Boolean(obj.isDirectory === true || obj.directory === true || obj.type === 'directory');
        entries.push({ name, isDirectory });
    }
    return entries;
}

function joinPath(basePath: string, segment: string): string {
    if (basePath.trim().length === 0) {
        return segment;
    }
    const normalizedBase = basePath.replace(/[\\/]+$/, '');
    const sep = normalizedBase.includes('\\') ? '\\' : '/';
    return `${normalizedBase}${sep}${segment}`;
}

function extractImageUrl(result: JsonValue): string | null {
    if (typeof result === 'string') {
        return result;
    }
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        const img = (result as JsonObject).image;
        if (typeof img === 'string') {
            return img;
        }
    }
    return null;
}

function FileSystemSummary({ name, args }: { name: string; args: JsonObject }) {
    const getPath = (obj: Record<string, unknown>) => {
        if (typeof obj.path === 'string') {return obj.path;}
        if (typeof obj.TargetFile === 'string') {return obj.TargetFile;}
        if (typeof obj.file === 'string') {return obj.file;}
        return '';
    };
    
    const handleLinkClick = (e: React.MouseEvent, type: 'diff' | 'editor', targetPath: string) => {
        e.stopPropagation();
        if (type === 'diff') {
            navigateToWorkspace({ type: 'open_diff', path: targetPath });
        } else {
            navigateToWorkspace({ type: 'open_file', path: targetPath });
        }
    };

    const renderFileButton = (path: string, type: 'diff' | 'editor') => {
        const fileName = path.split(/[\\/]/).pop() || path;
        if (!path) {
            return null;
        }
        return (
            <button
                type="button"
                onClick={(e) => handleLinkClick(e, type, path)}
                className="block w-full truncate rounded-md px-2 py-1 text-left text-sm text-foreground/80 hover:bg-muted/15 hover:text-primary"
            >
                {fileName}
            </button>
        );
    };

    if (name === 'write_file') {
        return <div className="space-y-1">{renderFileButton(getPath(args), 'diff')}</div>;
    }

    if (name === 'write_files') {
        const files = Array.isArray(args.files) ? args.files : [];
        const paths = files
            .map((f: unknown) => getPath((f ?? {}) as Record<string, unknown>))
            .filter(Boolean);
        return (
            <div className="space-y-1">
                {paths.map((path, i) => (
                    <div key={`${i}-${path}`}>{renderFileButton(path, 'diff')}</div>
                ))}
            </div>
        );
    }

    if (name === 'patch_file') {
        return <div className="space-y-1">{renderFileButton(getPath(args), 'diff')}</div>;
    }

    if (name === 'search_files') {
        const path = getPath(args) || (typeof args.rootPath === 'string' ? args.rootPath : '');
        return <div className="space-y-1">{renderFileButton(path, 'editor')}</div>;
    }

    return null;
}

function JsonOutput({ value }: { value: JsonValue }) {
    const displayStr = (() => {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    })();
    return (
        <pre className={UI_PRIMITIVES.CODE_BLOCK}>
            {displayStr}
        </pre>
    );
}

function ToolOutput({ name, args, result, t }: { name: string; args: JsonObject; result: JsonValue; t: (path: string, options?: Record<string, unknown>) => string }) {
    if (name === 'read_file') {
        const pathValue = typeof args.path === 'string'
            ? args.path
            : (typeof args.file === 'string' ? args.file : '');
        const fileName = pathValue.split(/[\\/]/).pop() || pathValue;
        return (
            <div className="space-y-1">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (pathValue) {
                            navigateToWorkspace({ type: 'open_file', path: pathValue });
                        }
                    }}
                    className="block w-full truncate rounded-md px-2 py-1 text-left text-sm text-foreground/80 hover:bg-muted/15 hover:text-primary"
                >
                    {fileName || t('frontend.tools.openFile')}
                </button>
            </div>
        );
    }

    if (['write_file', 'write_files', 'patch_file', 'search_files'].includes(name)) {
        return <FileSystemSummary name={name} args={args} />;
    }

    if (name === 'list_directory' || name === 'list_dir' || name === 'list_files') {
        const entries = extractDirectoryEntries(result);
        const folderPath = typeof args.path === 'string'
            ? args.path
            : (typeof args.SearchPath === 'string' ? args.SearchPath : '');
        const visible = entries.slice(0, 12);
        const hiddenCount = Math.max(0, entries.length - visible.length);

        return (
            <div className="space-y-1">
                {visible.map((entry, idx) => {
                    const fullPath = joinPath(folderPath, entry.name);
                    const fileName = entry.name.split(/[\\/]/).pop() || entry.name;
                    return (
                        <button
                            key={`${idx}-${fullPath}`}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!entry.isDirectory) {
                                    navigateToWorkspace({ type: 'open_file', path: fullPath });
                                }
                            }}
                            className={cn(
                                'block w-full truncate rounded-md px-2 py-1 text-left text-sm text-foreground/80 hover:bg-muted/15',
                                entry.isDirectory ? 'opacity-70 cursor-default' : 'hover:text-primary'
                            )}
                        >
                            {fileName}
                        </button>
                    );
                })}
                {hiddenCount > 0 && (
                    <div className="px-2 py-1 text-sm text-muted-foreground/70">
                        {t('frontend.tools.andMore', { count: hiddenCount })}
                    </div>
                )}
            </div>
        );
    }

    if (name === 'grep_search') {
        const items = extractSearchResults(result);
        if (items.length > 0) {
            const visible = items.slice(0, 12);
            const hiddenCount = Math.max(0, items.length - visible.length);
            return (
                <div className="space-y-1">
                    {visible.map((item, idx) => {
                        const path = typeof item.path === 'string' ? item.path : (typeof item.File === 'string' ? item.File : '');
                        const fileName = path.split(/[\\/]/).pop() || path;
                        return (
                            <button
                                key={`${idx}-${path}`}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigateToWorkspace({ type: 'open_file', path });
                                }}
                                className="block w-full truncate rounded-md px-2 py-1 text-left text-sm text-foreground/80 hover:bg-muted/15 hover:text-primary"
                            >
                                {fileName}
                            </button>
                        );
                    })}
                    {hiddenCount > 0 && (
                        <div className="px-2 py-1 text-sm text-muted-foreground/70">
                            {t('frontend.tools.andMore', { count: hiddenCount })}
                        </div>
                    )}
                </div>
            );
        }
    }

    if (name === 'search_web') {
        const searchResults = extractSearchResults(result);
        if (searchResults.length > 0) {
            const visible = searchResults.slice(0, 8);
            const hiddenCount = Math.max(0, searchResults.length - visible.length);
            return (
                <div className="space-y-1">
                    {visible.map((item, index) => (
                        <a
                            key={`${index}-${String(item.url ?? '')}`}
                            href={typeof item.url === 'string' ? item.url : ''}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate rounded-md px-2 py-1 text-sm text-foreground/80 hover:bg-muted/15 hover:text-primary"
                        >
                            {typeof item.title === 'string' ? item.title : ''}
                        </a>
                    ))}
                    {hiddenCount > 0 && (
                        <div className="px-2 py-1 text-sm text-muted-foreground/70">
                            {t('frontend.tools.andMore', { count: hiddenCount })}
                        </div>
                    )}
                </div>
            );
        }
    }

    if (name === 'capture_screenshot') {
        const imageUrl = extractImageUrl(result);
        if (imageUrl) {
            return <img src={imageUrl} alt={t('frontend.chat.screenshotAlt')} className="max-w-full rounded-md border border-border/40" />;
        }
    }

    return <JsonOutput value={result} />;
}

export const ToolDisplay = React.memo(({ toolCall, result, isExecuting, language = 'en' }: ToolDisplayProps) => {
    const { t } = useTranslation(language);
    const normalizedName = normalizeToolName(toolCall.name, toolCall.arguments);
    const displayToolCall = normalizedName === toolCall.name ? toolCall : { ...toolCall, name: normalizedName };
    const toolError = readToolError(result);
    const hasError = Boolean(toolError);
    const resultData = result?.result as CommandExecutionResult | undefined;
    const [commandExpanded, setCommandExpanded] = useState(false);
    const [isExpanded, setIsExpanded] = useState(Boolean(isExecuting));

    useAutoExpandCommand(displayToolCall.name, isExecuting, resultData?.error, resultData?.stderr, setCommandExpanded);
    const status: ToolStatus = isExecuting ? 'running' : (hasError ? 'failed' : 'completed');
    const summaryText = getToolSummaryText(displayToolCall, result, Boolean(isExecuting), hasError, t);
    const expanded = Boolean(isExecuting) || isExpanded;

    if (displayToolCall.name === 'execute_command') {
        return (
            <TerminalView
                toolCallId={displayToolCall.id}
                command={String(displayToolCall.arguments.command ?? '')}
                result={result}
                isExecuting={isExecuting}
                expanded={commandExpanded}
                onToggleExpand={() => setCommandExpanded(prev => !prev)}
            />
        );
    }

    return (
        <div
            className={cn(
                'my-1 overflow-hidden transition-all duration-300',
                status === 'failed' && 'opacity-90'
            )}
        >
            <button
                type="button"
                onClick={() => {
                    if (isExecuting) {
                        setIsExpanded(true);
                        return;
                    }
                    setIsExpanded(prev => !prev);
                }}
                className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                    expanded ? 'bg-muted/20' : 'hover:bg-muted/15'
                )}
                aria-label={expanded ? t('frontend.chat.collapse') : t('frontend.chat.expand')}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className={cn(
                            'h-2 w-2 rounded-full',
                            status === 'running'
                                ? 'bg-primary/70'
                                : status === 'failed'
                                    ? 'bg-destructive/70'
                                    : 'bg-muted-foreground/60'
                        )}
                    />
                    <div className={cn('truncate text-sm font-medium', status === 'running' && 'text-primary')}>
                        {summaryText}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <IconChevronDown className={cn(
                        'h-4 w-4 text-muted-foreground/60 transition-transform',
                        expanded && 'rotate-180'
                    )} />
                </div>
            </button>

            {expanded && (
                <div className="px-3 pb-2 pt-2">
                    {isExecuting && !result && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconLoader2 className="h-3 w-3 animate-spin" />
                            <span>{t('frontend.tools.executing')}</span>
                        </div>
                    )}

                    {!isExecuting && (
                        <div className="space-y-2">
                            <ToolOutput name={displayToolCall.name} args={displayToolCall.arguments} result={result?.result ?? {}} t={t} />
                            {typeof toolError === 'string' && toolError.trim().length > 0 && (
                                <div className="rounded-md border border-destructive/25 bg-destructive/5 px-2 py-1 text-sm text-destructive">
                                    {toolError}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
