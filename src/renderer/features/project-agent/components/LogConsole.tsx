import { Message, ToolCall } from '@shared/types/chat';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { ArrowDown, Brain, ChevronDown, ChevronUp, FileCode, Info, Terminal, User, Wrench } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LogConsoleProps {
    logs: Message[];
    className?: string;
}

interface SimpleDiffProps {
    oldText: string;
    newText: string;
}

const SimpleDiff = ({ oldText, newText }: SimpleDiffProps) => {
    const lines = useMemo(() => {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const diff: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }> = [];

        // Simplified diff (max 100 lines)
        let i = 0, j = 0;
        const maxLines = 100;

        while ((i < oldLines.length || j < newLines.length) && diff.length < maxLines) {
            if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                diff.push({ type: 'unchanged', content: oldLines[i] });
                i++; j++;
            } else if (j < newLines.length) {
                diff.push({ type: 'added', content: newLines[j] });
                j++;
            } else {
                diff.push({ type: 'removed', content: oldLines[i] });
                i++;
            }
        }

        if (i < oldLines.length || j < newLines.length) {
            diff.push({ type: 'unchanged', content: '...' });
        }
        return diff;
    }, [oldText, newText]);

    return (
        <div className="mt-2 border border-white/5 rounded overflow-hidden text-[9px] bg-black/40">
            {lines.map((line, idx) => (
                <div key={idx} className={cn(
                    "flex gap-2 px-2 py-0.5",
                    line.type === 'added' ? "bg-emerald-500/10 text-emerald-400" :
                        line.type === 'removed' ? "bg-red-500/10 text-red-400" :
                            "text-muted-foreground/50"
                )}>
                    <span className="shrink-0 w-3 opacity-50">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <span className="whitespace-pre-wrap break-all">{line.content}</span>
                </div>
            ))}
        </div>
    );
};

interface ToolCallItemProps {
    call: ToolCall;
    isExpanded: boolean;
    onToggle: () => void;
}

type ToolArgs = Record<string, unknown>;

const ToolCallDetails = ({ args, isFileEdit }: { args: ToolArgs; isFileEdit: boolean }) => {
    const targetContent = args.TargetContent as string | undefined;
    const replacementContent = args.ReplacementContent as string | undefined;

    return (
        <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <pre className="text-[8px] bg-black/40 p-1.5 rounded border border-white/5 text-muted-foreground/70 overflow-x-auto max-h-[150px] custom-scrollbar">
                {JSON.stringify(args, null, 2)}
            </pre>

            {isFileEdit && targetContent !== undefined && replacementContent !== undefined && (
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground uppercase font-bold tracking-wider">
                        <Info className="w-2.5 h-2.5" />
                        <span>Değişiklik Önizleme</span>
                    </div>
                    <SimpleDiff oldText={targetContent} newText={replacementContent} />
                </div>
            )}
        </div>
    );
};

const getToolSummary = (name: string, args: ToolArgs): string => {
    if (name.includes('replace') || name.includes('write')) {
        const targetFile = args.TargetFile as string | undefined;
        const fileName = targetFile ? targetFile.split(/[\\/]/).pop() : 'dosya';
        return `${fileName} düzenleniyor`;
    }
    if (name.includes('run_command')) {
        const cmd = (args.CommandLine as string | undefined) ?? '';
        return `Komut: ${cmd.slice(0, 50)}${cmd.length > 50 ? '...' : ''}`;
    }
    return `${name} çalıştırılıyor`;
};

const getToolStatusClass = (isFileEdit: boolean, isCommand: boolean) => {
    if (isFileEdit) {
        return "bg-emerald-500/5 border-emerald-500/20";
    }
    if (isCommand) {
        return "bg-blue-500/5 border-blue-500/20";
    }
    return "bg-white/5 border-white/5";
};

const getToolTextClass = (isFileEdit: boolean, isCommand: boolean) => {
    if (isFileEdit) {
        return "text-emerald-400";
    }
    if (isCommand) {
        return "text-blue-400";
    }
    return "text-amber-200/80";
};

const ToolStatusIcon = ({ isFileEdit, isCommand }: { isFileEdit: boolean; isCommand: boolean }) => {
    if (isFileEdit) {
        return <FileCode className="w-3 h-3" />;
    }
    if (isCommand) {
        return <Terminal className="w-3 h-3" />;
    }
    return <Wrench className="w-3 h-3" />;
};

const ToolCallItem = ({ call, isExpanded, onToggle }: ToolCallItemProps) => {
    const args = useMemo(() => safeJsonParse(call.function.arguments, {} as ToolArgs), [call.function.arguments]);
    const name = call.function.name;

    const isFileEdit = name.includes('replace') || name.includes('write');
    const isCommand = name.includes('run_command');

    const summary = getToolSummary(name, args);

    return (
        <div className={cn(
            "rounded px-2 py-1.5 mb-1 border overflow-hidden transition-all duration-200",
            getToolStatusClass(isFileEdit, isCommand)
        )}>
            <div className="flex items-center justify-between mb-0.5">
                <div className={cn(
                    "text-xs font-mono truncate flex items-center gap-1.5",
                    getToolTextClass(isFileEdit, isCommand)
                )}>
                    <ToolStatusIcon isFileEdit={isFileEdit} isCommand={isCommand} />
                    <span className="opacity-50 text-[10px]">$</span>
                    <span className="font-bold">{summary}</span>
                </div>
                <button
                    onClick={onToggle}
                    className="text-[9px] hover:text-primary transition-colors text-muted-foreground ml-2 flex items-center gap-0.5"
                >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? 'Gizle' : 'Detay'}
                </button>
            </div>

            {isExpanded && <ToolCallDetails args={args} isFileEdit={isFileEdit} />}
        </div>
    );
};

interface LogEntryProps {
    log: Message;
    expandedTools: Record<string, boolean>;
    toggleTool: (id: string) => void;
}

const RoleIcon = ({ role }: { role: string }) => {
    if (role === 'user') {
        return <User className="w-3 h-3 text-blue-400" />;
    }
    if (role === 'assistant') {
        return <Brain className="w-3 h-3 text-purple-400" />;
    }
    return <Wrench className="w-3 h-3 text-amber-400" />;
};

const ReasoningBlock = ({ content }: { content: string }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!content) { return null; }

    return (
        <div className="mb-2 border border-purple-500/20 bg-purple-500/5 rounded-lg overflow-hidden transition-all duration-300">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-purple-500/10 transition-colors text-[9px] font-bold text-purple-400/70 uppercase tracking-widest"
            >
                <div className="flex items-center gap-2">
                    <Brain className={cn("w-3 h-3", isExpanded ? "animate-pulse" : "")} />
                    <span>AI Reasoning Process</span>
                </div>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {isExpanded && (
                <div className="px-3 py-2 text-[10px] text-purple-200/60 leading-relaxed font-sans italic border-t border-purple-500/10 bg-black/20">
                    {content}
                </div>
            )}
        </div>
    );
};

const LogTimestamp = ({ timestamp }: { timestamp: number | Date }) => (
    <span className="text-[9px] text-muted-foreground/30">
        {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
);

const LogContent = ({
    content,
    isTool,
    shortenContent,
    onToggle
}: {
    content: string;
    isTool: boolean;
    shortenContent?: boolean;
    onToggle?: () => void;
}) => (
    <div className={cn(
        "text-foreground/80 whitespace-pre-wrap break-words leading-relaxed p-2 rounded border transition-colors",
        isTool ? "bg-black/60 border-white/5 font-mono text-[9px] text-amber-100/60" : "bg-white/[0.02] border-white/5"
    )}>
        {content}
        {shortenContent && onToggle && (
            <button
                onClick={onToggle}
                className="block mt-1 text-[9px] text-blue-400 hover:text-blue-300 transition-colors"
            >
                Visa mer...
            </button>
        )}
    </div>
);

const LogEntry = React.memo(({ log, expandedTools, toggleTool }: LogEntryProps) => {
    const [isContentExpanded, setIsContentExpanded] = useState(false);
    if (log.role === 'system') {
        return null;
    }

    const content = formatContent(log.content);
    const isLongContent = content.length > 500;
    const displayContent = isLongContent && !isContentExpanded ? shorten(content, 500) : content;

    return (
        <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 py-1 pr-2">
            <div className="shrink-0 mt-0.5">
                <RoleIcon role={log.role} />
            </div>

            <div className="flex-1 space-y-2 overflow-hidden min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn("font-bold text-[10px] uppercase tracking-tighter",
                        log.role === 'user' ? "text-blue-400" : log.role === 'assistant' ? "text-purple-400" : "text-amber-400"
                    )}>
                        {log.role}
                    </span>
                    <LogTimestamp timestamp={log.timestamp} />
                </div>

                {log.reasoning && <ReasoningBlock content={log.reasoning} />}

                {log.toolCalls?.map((call, i) => (
                    <ToolCallItem
                        key={`${log.id}-tool-${i}`}
                        call={call}
                        isExpanded={expandedTools[`${log.id}-tool-${i}`] || false}
                        onToggle={() => toggleTool(`${log.id}-tool-${i}`)}
                    />
                ))}

                {content && (
                    <LogContent
                        content={displayContent}
                        isTool={log.role === 'tool'}
                        shortenContent={isLongContent && !isContentExpanded}
                        onToggle={() => setIsContentExpanded(true)}
                    />
                )}
            </div>
        </div>
    );
});

LogEntry.displayName = 'LogEntry';

export const LogConsole = ({ logs, className }: LogConsoleProps) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
    const [atBottom, setAtBottom] = useState(true);

    const toggleTool = useCallback((id: string) => {
        setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    // Helper to keep scroll at bottom if already at bottom
    useEffect(() => {
        if (atBottom && virtuosoRef.current) {
            // Small timeout to allow render to happen
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({ index: logs.length - 1, align: 'end', behavior: 'smooth' });
            }, 50);
        }
    }, [logs.length, atBottom]);

    return (
        <div className={cn("flex flex-col h-full bg-black/40 rounded-lg border border-white/10 overflow-hidden font-mono text-[10px]", className)}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/5 shrink-0 z-10">
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground font-medium uppercase tracking-tight text-[9px]">UAC Console</span>
                <span className="ml-auto text-[9px] text-muted-foreground/30">{logs.length} olay</span>
            </div>

            <div className="flex-1 relative">
                {logs.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground/40 italic">
                        Loglar bekleniyor...
                    </div>
                ) : (
                    <Virtuoso
                        ref={virtuosoRef}
                        data={logs}
                        totalCount={logs.length}
                        atBottomStateChange={setAtBottom}
                        followOutput={'smooth'}
                        itemContent={(_index, log) => (
                            <LogEntry
                                key={log.id}
                                log={log}
                                expandedTools={expandedTools}
                                toggleTool={toggleTool}
                            />
                        )}
                        className="custom-scrollbar"
                        style={{ height: '100%' }}
                    />
                )}

                {!atBottom && logs.length > 0 && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => virtuosoRef.current?.scrollToIndex({ index: logs.length - 1, align: 'end', behavior: 'smooth' })}
                        className="absolute bottom-4 right-4 h-6 w-6 rounded-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 p-0 shadow-lg z-20"
                    >
                        <ArrowDown className="w-3 h-3" />
                    </Button>
                )}
            </div>
        </div>
    );
};

// Helper to format content (handles string or array)
function formatContent(content: Message['content']): string {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter(c => c.type === 'text')
            .map(c => (c as { text: string }).text)
            .join(' ');
    }
    return '';
}

// Helper to truncate long strings
function shorten(str: string, maxLen: number = 1000): string {
    if (!str) {
        return '';
    }
    if (str.length <= maxLen) {
        return str;
    }
    return str.slice(0, maxLen) + '...';
}
