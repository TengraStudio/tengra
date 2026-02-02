import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
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

interface ExpandedToolContentProps {
    toolName: string;
    args: JsonObject;
    result: ToolResult | undefined;
    t: (key: string) => string;
}

const ExpandedToolContent: React.FC<ExpandedToolContentProps> = ({ toolName, args, result, t }) => (
    <div className="mt-2 ml-2 border-l-2 border-white/10 pl-3 py-1 space-y-3 animate-in slide-in-from-top-1 duration-200">
        <div className="space-y-1">
            <div className="text-sm uppercase tracking-wider text-muted-foreground font-bold opacity-50">{t('tools.input')}</div>
            <ToolArguments name={toolName} args={args} t={t} />
        </div>
        {result && (
            <div className="space-y-1">
                <div className="text-sm uppercase tracking-wider text-muted-foreground font-semibold opacity-70">{t('tools.output')}</div>
                <ToolOutput name={toolName} result={result.result} t={t} />
            </div>
        )}
    </div>
);

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

const ExecutingSpinner: React.FC<{ statusText: string }> = ({ statusText }) => (
    <div className="flex items-center gap-3 py-2 px-1 animate-pulse">
        <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <span className="text-sm text-foreground/70 font-medium">{statusText}</span>
    </div>
);

interface ToolStatusButtonProps {
    hasError: boolean
    toolName: string
    statusText: string
    expanded: boolean
    onToggle: () => void
}

const ToolStatusButton: React.FC<ToolStatusButtonProps> = ({ hasError, toolName, statusText, expanded, onToggle }) => (
    <button
        onClick={onToggle}
        className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full text-left",
            hasError
                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "bg-muted/20 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
        )}
    >
        <div>{hasError ? '❌' : '✅'}</div>
        <div className="flex-1 truncate font-mono opacity-80">
            <span className="opacity-70 mr-2">{toolName}</span>
            <span className="opacity-50">({statusText})</span>
        </div>
        <div className="transition-transform duration-200 opacity-50" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
        </div>
    </button>
);

function useAutoExpandCommand(
    toolName: string,
    isExecuting: boolean | undefined,
    execError: string | undefined,
    execStderr: string | undefined,
    setExpanded: React.Dispatch<React.SetStateAction<boolean>>
): void {
    useEffect(() => {
        if (toolName !== 'execute_command') { return; }
        const shouldExpand = Boolean(isExecuting) || Boolean(execError) || Boolean(execStderr);
        if (!shouldExpand) { return; }

        const timer = setTimeout(() => setExpanded(true), 0);
        return () => clearTimeout(timer);
    }, [toolName, isExecuting, execError, execStderr, setExpanded]);
}

export function ToolDisplay({ toolCall, result, isExecuting, language = 'en' }: ToolDisplayProps) {
    const { t } = useTranslation(language);
    const hasError = !!result?.error;
    const resultData = result?.result as CommandExecutionResult | undefined;
    const [commandExpanded, setCommandExpanded] = useState(false);
    const [userExpanded, setUserExpanded] = useState(false);

    useAutoExpandCommand(toolCall.name, isExecuting, resultData?.error, resultData?.stderr, setCommandExpanded);

    if (toolCall.name === 'execute_command') {
        return (
            <TerminalView
                toolCallId={toolCall.id}
                command={String(toolCall.arguments.command ?? '')}
                result={result}
                isExecuting={isExecuting}
                expanded={commandExpanded}
                onToggleExpand={() => setCommandExpanded(!commandExpanded)}
            />
        );
    }

    const statusText = getStatusText(toolCall.name, !!isExecuting, hasError, t);

    if (isExecuting) {
        return <ExecutingSpinner statusText={statusText} />;
    }

    return (
        <div className="my-2 group">
            <ToolStatusButton
                hasError={hasError}
                toolName={toolCall.name}
                statusText={statusText}
                expanded={userExpanded}
                onToggle={() => setUserExpanded(!userExpanded)}
            />
            {userExpanded && <ExpandedToolContent toolName={toolCall.name} args={toolCall.arguments} result={result} t={t} />}
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

function extractStringContent(result: JsonValue): string {
    if (typeof result === 'string') { return result; }
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        const content = (result as JsonObject).content;
        if (typeof content === 'string') { return content; }
    }
    return '';
}

function extractSearchResults(result: JsonValue): JsonObject[] {
    if (!result || typeof result !== 'object' || Array.isArray(result)) { return []; }
    const resultsValue = (result as JsonObject).results;
    if (!Array.isArray(resultsValue)) { return []; }
    return resultsValue.filter((item): item is JsonObject => !!item && typeof item === 'object' && !Array.isArray(item));
}

function extractImageUrl(result: JsonValue): string | null {
    if (typeof result === 'string') { return result; }
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        const img = (result as JsonObject).image;
        if (typeof img === 'string') { return img; }
    }
    return null;
}

const FilePreview: React.FC<{ content: string; t: (key: string) => string }> = ({ content, t }) => (
    <div className="relative group">
        <div className="absolute right-2 top-2 text-sm text-muted-foreground opacity-50">{t('tools.filePreview')}</div>
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ code({ className, children, ...props }) { return <code className={className} {...props}>{children}</code>; } }}
        >
            {`\`\`\`\n${content}\n\`\`\``}
        </ReactMarkdown>
    </div>
);

interface SearchResultItemProps {
    url: string
    title: string
    snippet: string
    content: string
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({ url, title, snippet, content }) => (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block p-2 bg-card border border-border rounded hover:border-primary/50 transition-colors group">
        <div className="font-medium text-primary group-hover:underline truncate">{title}</div>
        <div className="text-muted-foreground line-clamp-2 mt-1">{content || snippet}</div>
    </a>
);

const SearchResults: React.FC<{ results: JsonObject[] }> = ({ results }) => (
    <div className="flex flex-col gap-2">
        {results.map((r, i) => (
            <SearchResultItem
                key={i}
                url={typeof r.url === 'string' ? r.url : ''}
                title={typeof r.title === 'string' ? r.title : ''}
                snippet={typeof r.snippet === 'string' ? r.snippet : ''}
                content={typeof r.content === 'string' ? r.content : ''}
            />
        ))}
    </div>
);

const ImageOutput: React.FC<{ imgUrl: string }> = ({ imgUrl }) => (
    <img src={imgUrl} className="max-w-full rounded-md border border-border shadow-sm" alt="Screenshot" />
);

const MarkdownOutput: React.FC<{ content: string }> = ({ content }) => (
    <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
);

const JsonOutput: React.FC<{ value: JsonValue }> = ({ value }) => {
    const displayStr = (() => { try { return JSON.stringify(value, null, 2); } catch { return String(value); } })();
    return <pre className="font-mono text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto max-h-60">{displayStr}</pre>;
};

function ToolOutput({ name, result, t }: { name: string; result: JsonValue; t: (key: string) => string }) {
    if (name === 'read_file') {
        return <FilePreview content={extractStringContent(result)} t={t} />;
    }

    if (name === 'search_web') {
        const results = extractSearchResults(result);
        if (results.length > 0) { return <SearchResults results={results} />; }
    }

    if (name === 'capture_screenshot') {
        const imgUrl = extractImageUrl(result);
        if (imgUrl) { return <ImageOutput imgUrl={imgUrl} />; }
    }

    if (typeof result === 'string') {
        return <MarkdownOutput content={result} />;
    }

    return <JsonOutput value={result} />;
}
