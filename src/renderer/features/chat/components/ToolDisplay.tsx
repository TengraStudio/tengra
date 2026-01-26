import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Language, useTranslation } from '@/i18n';
import { ToolResult } from '@/types';
import { JsonObject, JsonValue } from '@/types/common';

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
    toolCall: ToolCallType
    result?: ToolResult
    isExecuting?: boolean
    language?: Language
}

import { cn } from '@/lib/utils';

export function ToolDisplay({ toolCall, result, isExecuting, language = 'en' }: ToolDisplayProps) {
    const { t } = useTranslation(language);
    const hasError = result?.error;
    const resultData = result?.result as CommandExecutionResult | undefined;
    const execStderr = resultData?.stderr;
    const execError = resultData?.error;
    const [commandExpanded, setCommandExpanded] = useState(false);
    const [userExpanded, setUserExpanded] = useState(false);

    useEffect(() => {
        if (toolCall.name !== 'execute_command') { return; }

        let timer: NodeJS.Timeout | undefined;

        if (isExecuting || execError || execStderr) {
            timer = setTimeout(() => {
                setCommandExpanded(true);
            }, 0);
        }

        return () => {
            if (timer) { clearTimeout(timer); }
        };
    }, [toolCall.name, isExecuting, execError, execStderr]);

    // SPECIAL HANDLING: Terminal Commands ("Direct & Real-time")
    if (toolCall.name === 'execute_command') {
        const command = String(toolCall.arguments.command ?? '');

        return (
            <TerminalView
                toolCallId={toolCall.id}
                command={command}
                result={result}
                isExecuting={isExecuting}
                expanded={commandExpanded}
                onToggleExpand={() => setCommandExpanded(!commandExpanded)}
            />
        );
    }

    // DEFAULT HANDLING: Status Bar Style
    // const icon = getToolIcon(toolCall.name) // Unused now
    // const isCompleted = !!result

    // Auto-expand only if there is an error or it's a specific tool type
    // Auto-expand only if there is an error or it's a specific tool type

    // Specific status messages
    let statusText = t('tools.usingTool');
    if (isExecuting) {
        if (toolCall.name.includes('search')) { statusText = t('tools.searching'); }
        else if (toolCall.name.includes('file')) { statusText = t('tools.readingFiles'); }
        else if (toolCall.name.includes('command')) { statusText = t('tools.executingCmd'); }
        else if (toolCall.name.includes('screenshot')) { statusText = t('tools.screenshotting'); }
    } else {
        if (hasError) { statusText = t('tools.failed'); }
        else { statusText = t('tools.completed'); }
    }

    if (isExecuting) {
        return (
            <div className="flex items-center gap-3 py-2 px-1 animate-pulse">
                <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <span className="text-sm text-foreground/70 font-medium">{statusText}</span>
            </div>
        );
    }

    return (
        <div className="my-2 group">
            <button
                onClick={() => setUserExpanded(!userExpanded)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full text-left",
                    hasError
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "bg-muted/20 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
            >
                <div>{hasError ? '❌' : '✅'}</div>
                <div className="flex-1 truncate font-mono opacity-80">
                    <span className="opacity-70 mr-2">{toolCall.name}</span>
                    <span className="opacity-50">({statusText})</span>
                </div>
                <div className="transition-transform duration-200 opacity-50" style={{ transform: userExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                </div>
            </button>

            {userExpanded && (
                <div className="mt-2 ml-2 border-l-2 border-white/10 pl-3 py-1 space-y-3 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1">
                        <div className="text-sm uppercase tracking-wider text-muted-foreground font-bold opacity-50">{t('tools.input')}</div>
                        <ToolArguments name={toolCall.name} args={toolCall.arguments} t={t} />
                    </div>
                    {result && (
                        <div className="space-y-1">
                            <div className="text-sm uppercase tracking-wider text-muted-foreground font-semibold opacity-70">{t('tools.output')}</div>
                            <ToolOutput name={toolCall.name} result={result.result} t={t} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ToolArguments({ name, args, t }: { name: string; args: JsonObject; t: (key: string) => string }) {
    if (name === 'read_file' || name === 'write_file') {
        const pathValue = typeof args.path === 'string'
            ? args.path
            : (typeof args.file === 'string' ? args.file : '');
        return <div className="font-mono text-primary bg-primary/10 px-2 py-1 rounded inline-block">{t('tools.path')}: {pathValue}</div>;
    }
    return <pre className="font-mono text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto">{JSON.stringify(args, null, 2)}</pre>;
}

function ToolOutput({ name, result, t }: { name: string; result: JsonValue; t: (key: string) => string }) {
    // Other tool outputs remain the same but cleaner
    if (name === 'read_file') {
        const content = typeof result === 'string'
            ? result
            : (result && typeof result === 'object' && !Array.isArray(result) && typeof (result as JsonObject).content === 'string'
                ? (result as JsonObject).content as string
                : '');
        return (
            <div className="relative group">
                <div className="absolute right-2 top-2 text-sm text-muted-foreground opacity-50">{t('tools.filePreview')}</div>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        code({ className, children, ...props }) {
                            return <code className={className} {...props}>{children}</code>;
                        }
                    }}
                >
                    {`\`\`\`\n${content}\n\`\`\``}
                </ReactMarkdown>
            </div>
        );
    }

    if (name === 'search_web') {
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            const resultsValue = (result as JsonObject).results;
            const results = Array.isArray(resultsValue)
                ? resultsValue.filter((item): item is JsonObject => !!item && typeof item === 'object' && !Array.isArray(item))
                : [];
            if (results.length > 0) {
                return (
                    <div className="flex flex-col gap-2">
                        {results.map((r, i) => {
                            const url = typeof r.url === 'string' ? r.url : '';
                            const title = typeof r.title === 'string' ? r.title : '';
                            const snippet = typeof r.snippet === 'string' ? r.snippet : '';
                            const content = typeof r.content === 'string' ? r.content : '';
                            return (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block p-2 bg-card border border-border rounded hover:border-primary/50 transition-colors group">
                                    <div className="font-medium text-primary group-hover:underline truncate">{title}</div>
                                    <div className="text-muted-foreground line-clamp-2 mt-1">{content || snippet}</div>
                                </a>
                            );
                        })}
                    </div>
                );
            }
        }
    }

    if (name === 'capture_screenshot') {
        const imgParams = typeof result === 'string'
            ? result
            : (result && typeof result === 'object' && !Array.isArray(result) ? (result as JsonObject).image : undefined);
        if (typeof imgParams === 'string') { return <img src={imgParams} className="max-w-full rounded-md border border-border shadow-sm" alt="Screenshot" />; }
    }

    if (typeof result === 'string') {
        return (
            <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result}
                </ReactMarkdown>
            </div>
        );
    }

    let displayStr = '';
    try { displayStr = JSON.stringify(result, null, 2); } catch { displayStr = String(result); }
    return <pre className="font-mono text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto max-h-60">{displayStr}</pre>;
}
