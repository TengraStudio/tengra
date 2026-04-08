import { JsonObject, JsonValue } from '@shared/types/common';
import {
    CheckCircle2,
    ChevronDown,
    CircleAlert,
    Loader2,
    Search,
    TerminalSquare,
    Wrench,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ToolOutputVirtualizer } from '@/components/shared/ToolOutputVirtualizer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

function getStatusText(toolName: string, isExecuting: boolean, hasError: boolean, t: (key: string) => string): string {
    if (!isExecuting) {
        return hasError ? t('tools.failed') : t('tools.completed');
    }
    if (toolName.includes('search')) { return t('tools.searching'); }
    if (toolName.includes('file')) { return t('tools.readingFiles'); }
    if (toolName.includes('command')) { return t('tools.executingCmd'); }
    if (toolName.includes('screenshot')) { return t('tools.screenshotting'); }
    return t('tools.usingTool');
}

function getStatusVariant(status: ToolStatus): 'warning' | 'success' | 'destructive' {
    if (status === 'running') {
        return 'warning';
    }
    if (status === 'failed') {
        return 'destructive';
    }
    return 'success';
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
            <div className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-xs text-primary">
                {t('tools.path')} {pathValue}
            </div>
        );
    }
    return (
        <pre className="max-h-48 overflow-x-auto overflow-y-auto rounded-md border border-border/40 bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
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

function FilePreview({ content, t }: { content: string; t: (key: string) => string }) {
    if (content.length > 1000) {
        return <ToolOutputVirtualizer content={content} maxHeight="320px" isDark={false} />;
    }
    return (
        <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
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
        <pre className="max-h-52 overflow-x-auto overflow-y-auto rounded-md border border-border/40 bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
            {displayStr}
        </pre>
    );
}

function ToolOutput({ name, result, t }: { name: string; result: JsonValue; t: (key: string) => string }) {
    if (name === 'read_file') {
        return <FilePreview content={extractStringContent(result)} t={t} />;
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
                            className="rounded-md border border-border/50 bg-background/70 p-2 text-xs transition-colors hover:border-primary/40"
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

    useAutoExpandCommand(toolCall.name, isExecuting, resultData?.error, resultData?.stderr, setCommandExpanded);
    const status: ToolStatus = isExecuting ? 'running' : (hasError ? 'failed' : 'completed');
    const statusText = getStatusText(toolCall.name, Boolean(isExecuting), hasError, t);
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
        <Card
            className={cn(
                'my-2 overflow-hidden border-border/40 bg-card/70 backdrop-blur-sm',
                status === 'failed' && 'border-destructive/35'
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
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/25"
                aria-label={expanded ? t('chat.collapse') : t('chat.expand')}
            >
                <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-md border border-border/50 bg-background/70 p-1.5 text-muted-foreground">
                        {getToolIcon(toolCall.name)}
                    </div>
                    <div className="min-w-0">
                        <div className="truncate font-mono text-xs font-semibold text-foreground/90">
                            {toolCall.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xxs text-muted-foreground">
                            {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                            {status === 'completed' && <CheckCircle2 className="h-3 w-3 text-success" />}
                            {status === 'failed' && <CircleAlert className="h-3 w-3 text-destructive" />}
                            <span>{statusText}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(status)} className="text-xxs">
                                {status === 'running'
                                    ? t('tools.running')
                                    : status === 'failed'
                                        ? t('tools.failed')
                                        : t('tools.completed')}
                    </Badge>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                </div>
            </button>

            {expanded && (
                <CardContent className="space-y-3 px-4 pb-4 pt-0">
                    <div className="rounded-lg border border-border/40 bg-background/50 p-3">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                            {t('tools.input')}
                        </div>
                        <ToolArguments name={toolCall.name} args={toolCall.arguments} t={t} />
                    </div>

                    {isExecuting && !result && (
                        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/25 p-3 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>{statusText}</span>
                        </div>
                    )}

                    {result && (
                        <div className="rounded-lg border border-border/40 bg-background/50 p-3">
                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                                {t('tools.output')}
                            </div>
                            <ToolOutput name={toolCall.name} result={result.result ?? {}} t={t} />
                            {typeof toolError === 'string' && toolError.trim().length > 0 && (
                                <div className="mt-3 rounded-md border border-destructive/35 bg-destructive/10 px-2 py-1.5 font-mono text-xs text-destructive">
                                    {toolError}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
});
