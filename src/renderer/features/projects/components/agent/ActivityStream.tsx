import {
    Activity,
    AlertTriangle,
    Bot,
    CheckCircle2,
    Cpu,
    Terminal,
    Wrench,
    XCircle,
} from 'lucide-react';
import React, { memo } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

export interface ActivityLog {
    id: string;
    type: 'info' | 'llm' | 'tool' | 'success' | 'error';
    message: string;
    timestamp: Date;
    details?: string;
}

interface ActivityStreamProps {
    logs: ActivityLog[];
    scrollEndRef?: React.RefObject<HTMLDivElement>;
}

const typeConfig = {
    info: {
        icon: Terminal,
        color: 'text-primary',
        bg: 'bg-primary/10',
        border: 'border-primary/20',
        label: 'SYS',
    },
    llm: {
        icon: Cpu,
        color: 'text-secondary',
        bg: 'bg-secondary/10',
        border: 'border-secondary/20',
        label: 'LLM',
    },
    tool: {
        icon: Wrench,
        color: 'text-warning',
        bg: 'bg-warning/10',
        border: 'border-warning/20',
        label: 'TOOL',
    },
    success: {
        icon: CheckCircle2,
        color: 'text-success',
        bg: 'bg-success/10',
        border: 'border-success/20',
        label: 'OK',
    },
    error: {
        icon: XCircle,
        color: 'text-destructive',
        bg: 'bg-destructive/10',
        border: 'border-destructive/20',
        label: 'ERR',
    },
};

const ActivityItem = memo(({ log, index }: { log: ActivityLog; index: number }) => {
    const config = typeConfig[log.type];
    const Icon = config.icon;

    return (
        <div
            className={cn(
                'group flex items-start gap-3 py-2 px-3 font-mono transition-colors hover:bg-muted/30',
                'animate-in fade-in slide-in-from-left-2 duration-300'
            )}
            style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
        >
            {/* Timestamp column */}
            <div className="shrink-0 w-16 text-[10px] text-muted-foreground tabular-nums pt-0.5">
                {log.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                })}
            </div>

            {/* Type indicator */}
            <div
                className={cn(
                    'shrink-0 flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider border',
                    config.bg,
                    config.border,
                    config.color
                )}
            >
                <Icon className="w-2.5 h-2.5" />
                <span>{config.label}</span>
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0">
                <p
                    className={cn(
                        'text-xs leading-relaxed break-words',
                        log.type === 'error' ? 'text-destructive' : 'text-foreground/80'
                    )}
                >
                    {log.message}
                </p>
                {log.details && (
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {log.details}
                    </p>
                )}
            </div>

            {/* Line number - appears on hover */}
            <div className="shrink-0 text-[9px] text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                #{(index + 1).toString().padStart(4, '0')}
            </div>
        </div>
    );
});

ActivityItem.displayName = 'ActivityItem';

export const ActivityStream: React.FC<ActivityStreamProps> = ({ logs }) => {
    const { t } = useTranslation();

    return (
        <div className="flex-[2] flex flex-col min-h-0 overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur-xl relative">
            {/* Scan line overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
                <div
                    className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-scan-slow"
                    style={{ top: '0%' }}
                />
            </div>

            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-border bg-card/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Activity className="w-4 h-4 text-primary" />
                            {logs.length > 0 && (
                                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground font-mono">
                                {t('agent.activitiesCount', { count: logs.length })}
                            </h3>
                            <div className="text-[9px] font-mono text-primary/50 tracking-wider">
                                STDOUT :: REALTIME
                            </div>
                        </div>
                    </div>

                    {/* Status indicators */}
                    <div className="flex items-center gap-3 text-[9px] font-mono">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
                            <span>STREAM</span>
                        </div>
                        <div className="text-border">|</div>
                        <div className="text-primary/50 tabular-nums">
                            {logs.length.toString().padStart(4, '0')} ENTRIES
                        </div>
                    </div>
                </div>

                {/* ASCII decorative line */}
                <div className="mt-2 text-[8px] font-mono text-muted-foreground/20 tracking-widest overflow-hidden">
                    {'─'.repeat(80)}
                </div>
            </div>

            {/* Log content */}
            <div className="flex-1 min-h-0 relative">
                {logs.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                        <div className="relative mb-6">
                            {/* Animated rings */}
                            <div className="absolute inset-0 -m-4 rounded-full border border-primary/10 animate-ping-slow" />
                            <div className="absolute inset-0 -m-2 rounded-full border border-primary/5" />
                            <div className="w-16 h-16 rounded-2xl bg-card/60 border border-border flex items-center justify-center relative overflow-hidden">
                                <Bot className="w-8 h-8 text-muted-foreground/30 relative z-10" />
                                {/* Grid overlay */}
                                <div
                                    className="absolute inset-0 opacity-10"
                                    style={{
                                        backgroundImage: `
                                        linear-gradient(to right, currentColor 1px, transparent 1px),
                                        linear-gradient(to bottom, currentColor 1px, transparent 1px)
                                    `,
                                        backgroundSize: '8px 8px',
                                    }}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">
                            {t('agent.waitingActivity')}
                        </p>
                        <p className="text-[9px] font-mono text-primary/30">
                            {'>'} MONITORING AGENT ACTIVITY...
                        </p>
                        <div className="mt-4 flex items-center gap-1 text-[9px] font-mono text-muted-foreground/30">
                            <span>{'['}</span>
                            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                                <div className="h-full w-1/3 bg-primary/30 rounded-full animate-pulse" />
                            </div>
                            <span>{']'}</span>
                        </div>
                    </div>
                ) : (
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={logs}
                        followOutput="smooth"
                        initialTopMostItemIndex={logs.length > 0 ? logs.length - 1 : 0}
                        itemContent={(index, log) => <ActivityItem log={log} index={index} />}
                        components={{
                            Header: () => <div className="h-2" />,
                            Footer: () => (
                                <div className="h-8 flex items-center justify-center">
                                    <div className="text-[9px] font-mono text-muted-foreground/30">
                                        {'─'.repeat(20)} END OF LOG {'─'.repeat(20)}
                                    </div>
                                </div>
                            ),
                        }}
                    />
                )}
            </div>

            {/* Footer status bar */}
            <div className="shrink-0 px-3 py-1.5 border-t border-border bg-card/30 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-warning/50" />
                    <span>AUTO-SCROLL: ON</span>
                </div>
                <div className="flex items-center gap-2">
                    <span>BUFFER: 1000</span>
                    <span className="text-border">|</span>
                    <span className="text-primary/40">MEM: OK</span>
                </div>
            </div>
        </div>
    );
};
