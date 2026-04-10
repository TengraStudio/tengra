import { JsonObject, JsonValue } from '@shared/types/common';
import {
    ChevronDown,
    CircleAlert,
    FileText,
    Github,
    ListFilter,
    Loader2,
    Search,
    TerminalSquare,
    Wrench,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    if (isExecuting) {
        const key = FriendlyToolNames[toolName] || 'usingTool';
        return t(`tools.${key}`);
    }

    if (hasError) {
        return t('tools.failed');
    }

    const primaryPath = summarizePathValue(getPrimaryPath(toolCall.arguments));
    if (toolName === 'list_directory' || toolName === 'list_files') {
        return t('tools.listDirSummary', {
            count: countResultItems(result?.result ?? []),
            path: primaryPath,
        });
    }
    if (toolName === 'read_file') {
        return t('tools.readFileSummary', {
            count: countResultItems(result?.result ?? ''),
            path: primaryPath,
        });
    }
    if (toolName === 'write_file' || toolName === 'write_files') {
        return t('tools.writeFileSummary', { path: primaryPath });
    }
    if (toolName === 'patch_file' || toolName === 'edit_file') {
        return t('tools.editFileSummary', { path: primaryPath });
    }

    return t('tools.completed');
}

function getToolIcon(toolName: string): React.ReactNode {
    if (toolName === 'execute_command') {
        return <TerminalSquare className="h-4 w-4" />;
    }
    if (toolName.includes('search')) {
        return <Search className="h-4 w-4" />;
    }
    return <Wrench className="h-4 w-4" />;
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

function ToolArguments({ name, args, t }: { name: string; args: JsonObject; t: (key: string) => string }) {
    if (name === 'read_file' || name === 'write_file') {
        const pathValue = typeof args.path === 'string'
            ? args.path
            : (typeof args.file === 'string' ? args.file : '');
        return (
            <div className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-mono typo-caption text-primary">
                {t('tools.path')} {pathValue}
            </div>
        );
    }
    return (
        <pre className="max-h-48 overflow-x-auto overflow-y-auto rounded-md border border-border/40 bg-muted/40 p-2 font-mono typo-caption text-muted-foreground">
            {JSON.stringify(args, null, 2)}
        </pre>
    );
}

function extractStringContent(result: JsonValue): string {
    if (typeof result === 'string') {
        return result;
    }
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        const content = (result as JsonObject).content;
        if (typeof content === 'string') {
            return content;
        }
    }
    return '';
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

    if (name === 'write_file') {
        const path = getPath(args);
        const fileName = path.split(/[\\/]/).pop() || path;
        return (
            <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                    <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <button 
                        onClick={(e) => handleLinkClick(e, 'diff', path)}
                        className="truncate font-semibold text-success hover:underline transition-all block"
                    >
                        {fileName}
                    </button>
                </div>
            </div>
        );
    }

    if (name === 'write_files') {
        const files = Array.isArray(args.files) ? args.files : [];
        return (
            <div className="grid grid-cols-1 gap-2">
                {files.map((f: unknown, i: number) => {
                    const fileObj = f as Record<string, unknown>;
                    const path = getPath(fileObj);
                    const fileName = path.split(/[\\/]/).pop() || path;
                    return (
                        <div key={i} className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 px-3 py-2 text-sm">
                            <FileText className="h-4 w-4 text-success/70" />
                            <button 
                                onClick={(e) => handleLinkClick(e, 'diff', path)}
                                className="truncate font-medium text-success hover:underline transition-all"
                            >
                                {fileName}
                            </button>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (name === 'patch_file') {
        const path = getPath(args);
        const fileName = path.split(/[\\/]/).pop() || path;
        return (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Github className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <button 
                        onClick={(e) => handleLinkClick(e, 'diff', path)}
                        className="truncate font-semibold text-primary hover:underline transition-all block"
                    >
                        {fileName}
                    </button>
                </div>
            </div>
        );
    }

    if (name === 'search_files' || name === 'grep_search' || name === 'list_directory') {
        const path = getPath(args) || (typeof args.rootPath === 'string' ? args.rootPath : '');
        const fileName = path.split(/[\\/]/).pop() || path;
        return (
            <div className="flex items-center gap-2 rounded-xl border border-muted/20 bg-muted/5 px-4 py-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/20 text-muted-foreground">
                    <Search className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <button 
                        onClick={(e) => handleLinkClick(e, 'editor', path)}
                        className="truncate font-semibold text-muted-foreground hover:underline transition-all block"
                    >
                        {fileName || 'Project Root'}
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

function FilePreview({ content, t }: { content: string; t: (key: string) => string }) {
    return (
        <div className="space-y-2">
            <span className="typo-caption font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {t('tools.filePreview')}
            </span>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{`\`\`\`\n${content}\n\`\`\``}</ReactMarkdown>
        </div>
    );
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
        <pre className="max-h-52 overflow-x-auto overflow-y-auto rounded-md border border-border/40 bg-muted/40 p-2 font-mono typo-caption text-muted-foreground">
            {displayStr}
        </pre>
    );
}

function ToolOutput({ name, args, result, t }: { name: string; args: JsonObject; result: JsonValue; t: (path: string, options?: Record<string, unknown>) => string }) {
    if (name === 'read_file') {
        const content = extractStringContent(result);
        return (
            <div className="space-y-3">
                <FilePreview content={content} t={t} />
            </div>
        );
    }

    if (['write_file', 'write_files', 'patch_file', 'list_directory', 'search_files', 'grep_search'].includes(name)) {
        return <FileSystemSummary name={name} args={args} />;
    }

    if (name === 'grep_search' || name === 'list_dir' || name === 'list_files') {
        const items = extractSearchResults(result);
        const folderPath = typeof args.path === 'string' ? args.path : (typeof args.SearchPath === 'string' ? args.SearchPath : '');
        
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/20 text-muted-foreground">
                        <ListFilter className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-mono text-muted-foreground/60">{folderPath}</div>
                    </div>
                </div>
                
                {items.length > 0 && (
                    <div className="grid gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {items.map((item, idx) => {
                            const path = typeof item.path === 'string' ? item.path : (typeof item.File === 'string' ? item.File : '');
                            const fileName = path.split(/[\\/]/).pop() || path;
                            return (
                                <button
                                    key={`${idx}-${path}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigateToWorkspace({ type: 'open_file', path });
                                    }}
                                    className="flex items-center gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group/file"
                                >
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground/50 group-hover/file:text-primary/70" />
                                    <span className="truncate text-xs font-medium text-foreground/80 group-hover/file:text-primary">
                                        {fileName}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    if (name === 'search_web') {
        const searchResults = extractSearchResults(result);
        if (searchResults.length > 0) {
            return (
                <div className="grid gap-2">
                    {searchResults.map((item, index) => (
                        <a
                            key={`${index}-${String(item.url ?? '')}`}
                            href={typeof item.url === 'string' ? item.url : ''}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-border/50 bg-background/70 p-2 typo-caption transition-colors hover:border-primary/40"
                        >
                            <div className="truncate font-medium text-primary">
                                {typeof item.title === 'string' ? item.title : ''}
                            </div>
                            <div className="mt-1 line-clamp-2 text-muted-foreground">
                                {(typeof item.content === 'string' ? item.content : '') || (typeof item.snippet === 'string' ? item.snippet : '')}
                            </div>
                        </a>
                    ))}
                </div>
            );
        }
    }

    if (name === 'capture_screenshot') {
        const imageUrl = extractImageUrl(result);
        if (imageUrl) {
            return <img src={imageUrl} alt={t('chat.screenshotAlt')} className="max-w-full rounded-md border border-border/40" />;
        }
    }

    if (typeof result === 'string') {
        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>;
    }

    return <JsonOutput value={result} />;
}

export const ToolDisplay = React.memo(({ toolCall, result, isExecuting, language = 'en' }: ToolDisplayProps) => {
    const { t } = useTranslation(language);
    const toolError = readToolError(result);
    const hasError = Boolean(toolError);
    const resultData = result?.result as CommandExecutionResult | undefined;
    const [commandExpanded, setCommandExpanded] = useState(false);
    const [isExpanded, setIsExpanded] = useState(Boolean(isExecuting));
    const [showInput, setShowInput] = useState(false);

    useAutoExpandCommand(toolCall.name, isExecuting, resultData?.error, resultData?.stderr, setCommandExpanded);
    const status: ToolStatus = isExecuting ? 'running' : (hasError ? 'failed' : 'completed');
    const summaryText = getToolSummaryText(toolCall, result, Boolean(isExecuting), hasError, t);
    const expanded = Boolean(isExecuting) || isExpanded;

    if (toolCall.name === 'execute_command') {
        return (
            <TerminalView
                toolCallId={toolCall.id}
                command={String(toolCall.arguments.command ?? '')}
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
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-all duration-300 rounded-xl group/tool',
                    expanded ? 'bg-muted/30 mb-2' : 'hover:bg-muted/20 bg-transparent'
                )}
                aria-label={expanded ? t('chat.collapse') : t('chat.expand')}
            >
                <div className="flex min-w-0 items-center gap-3">
                    <div className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-full border transition-all duration-300',
                        status === 'running' ? 'border-primary/30 bg-primary/10 animate-pulse' : 
                        status === 'failed' ? 'border-destructive/30 bg-destructive/10' :
                        'border-border/50 bg-background/50 group-hover/tool:border-primary/30'
                    )}>
                        {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                        {status === 'failed' && <CircleAlert className="h-3 w-3 text-destructive" />}
                        {status === 'completed' && (
                            <div className="text-muted-foreground group-hover/tool:text-primary transition-colors">
                                {getToolIcon(toolCall.name)}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className={cn(
                            'truncate text-sm font-medium transition-colors',
                            status === 'running' ? 'text-primary' : 'text-foreground/90'
                        )}>
                            {summaryText}
                        </div>
                        {expanded && (
                            <div className="mt-0.5 text-xxs font-mono text-muted-foreground/60">
                                {toolCall.name}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ChevronDown className={cn(
                        'h-4 w-4 text-muted-foreground/50 transition-transform duration-300',
                        expanded && 'rotate-180 text-primary'
                    )} />
                </div>
            </button>

            {expanded && (
                <div className="space-y-3 px-1 pb-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="rounded-xl border border-border/40 bg-card/40 p-3 shadow-sm backdrop-blur-sm">
                        {isExecuting && !result && (
                            <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>{t('tools.executing')}</span>
                            </div>
                        )}

                        {!isExecuting && (
                            <div className="space-y-4">
                                <ToolOutput name={toolCall.name} args={toolCall.arguments} result={result?.result ?? {}} t={t} />
                                
                                {typeof toolError === 'string' && toolError.trim().length > 0 && (
                                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive font-mono">
                                        {toolError}
                                    </div>
                                )}

                                <div className="pt-2 border-t border-border/20">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowInput(prev => !prev);
                                        }}
                                        className="text-xxs uppercase tracking-wider font-bold text-muted-foreground/40 float-right hover:text-primary transition-colors"
                                    >
                                        {t('tools.input')}
                                    </button>
                                    {showInput && (
                                        <div className="clear-both pt-2">
                                            <ToolArguments name={toolCall.name} args={toolCall.arguments} t={t} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});
