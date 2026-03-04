import { CheckCircle2, Clock, Cog, Loader2, Wrench, XCircle } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

export interface ToolExecution {
    id: string;
    name: string;
    status: 'running' | 'completed' | 'error';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    error?: string;
}

interface ToolTrackingProps {
    executions: ToolExecution[];
    t: (key: string, options?: Record<string, string | number>) => string;
}

const ToolItem: React.FC<{ tool: ToolExecution }> = ({ tool }) => {
    const getStatusStyles = () => {
        switch (tool.status) {
            case 'running':
                return {
                    bg: 'bg-primary/5',
                    border: 'border-primary/20',
                    icon: <Loader2 className="w-3 h-3 text-primary animate-spin" />,
                    glow: 'shadow-[0_0_10px_hsl(var(--primary)/0.1)]',
                };
            case 'completed':
                return {
                    bg: 'bg-success/5',
                    border: 'border-success/20',
                    icon: <CheckCircle2 className="w-3 h-3 text-success" />,
                    glow: '',
                };
            case 'error':
                return {
                    bg: 'bg-destructive/5',
                    border: 'border-destructive/20',
                    icon: <XCircle className="w-3 h-3 text-destructive" />,
                    glow: '',
                };
            default:
                return {
                    bg: 'bg-muted/30',
                    border: 'border-border',
                    icon: <Cog className="w-3 h-3 text-muted-foreground" />,
                    glow: '',
                };
        }
    };

    const styles = getStatusStyles();

    return (
        <div
            className={cn(
                'p-2.5 rounded-lg border transition-all duration-300 font-mono',
                styles.bg,
                styles.border,
                styles.glow
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="shrink-0 w-5 h-5 rounded flex items-center justify-center bg-card/50">
                        {styles.icon}
                    </div>
                    <span
                        className={cn(
                            'text-[11px] font-medium truncate',
                            tool.status === 'running' && 'text-primary',
                            tool.status === 'completed' && 'text-muted-foreground',
                            tool.status === 'error' && 'text-destructive'
                        )}
                    >
                        {tool.name}
                    </span>
                </div>

                {tool.duration !== undefined && (
                    <div className="shrink-0 flex items-center gap-1 text-[9px] text-muted-foreground tabular-nums">
                        <Clock className="w-2.5 h-2.5" />
                        {(tool.duration / 1000).toFixed(2)}s
                    </div>
                )}
            </div>

            {tool.error && (
                <div className="mt-2 p-2 bg-destructive/5 rounded border border-destructive/10">
                    <p className="text-[9px] text-destructive/80 font-mono truncate">
                        {tool.error}
                    </p>
                </div>
            )}

            {tool.status === 'running' && (
                <div className="mt-2 h-0.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-primary/50 rounded-full animate-pulse" />
                </div>
            )}
        </div>
    );
};

export const ToolTracking: React.FC<ToolTrackingProps> = ({ executions, t }) => {
    const runningCount = executions.filter(e => e.status === 'running').length;
    const completedCount = executions.filter(e => e.status === 'completed').length;
    const errorCount = executions.filter(e => e.status === 'error').length;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur-xl">
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-border bg-card/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Wrench className="w-4 h-4 text-warning" />
                            {runningCount > 0 && (
                                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground font-mono">
                                {t('agent.activeTools')}
                            </h3>
                            <div className="text-[9px] font-mono text-warning/50 tracking-wider">
                                TOOL.EXEC.TRACKER
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    {executions.length > 0 && (
                        <div className="flex items-center gap-2 text-[9px] font-mono">
                            {runningCount > 0 && (
                                <span className="text-primary">{runningCount} RUN</span>
                            )}
                            {completedCount > 0 && (
                                <span className="text-success/60">{completedCount} OK</span>
                            )}
                            {errorCount > 0 && (
                                <span className="text-destructive/60">{errorCount} ERR</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Tool list */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                {executions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6">
                        <div className="w-10 h-10 rounded-xl bg-muted/30 border border-border flex items-center justify-center mb-3">
                            <Cog className="w-5 h-5 text-muted-foreground/30" />
                        </div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">
                            {t('agent.noToolCalls')}
                        </p>
                        <p className="text-[9px] font-mono text-muted-foreground/30 mt-1">
                            STANDBY...
                        </p>
                    </div>
                ) : (
                    executions.map(tool => <ToolItem key={tool.id} tool={tool} />)
                )}
            </div>

            {/* Footer */}
            {executions.length > 0 && (
                <div className="shrink-0 px-3 py-1.5 border-t border-border bg-card/30 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                    <span>TOTAL: {executions.length}</span>
                    <span className="text-warning/40">
                        AVG:{' '}
                        {executions.filter(e => e.duration).length > 0
                            ? (
                                  executions
                                      .filter(e => e.duration)
                                      .reduce((acc, e) => acc + (e.duration ?? 0), 0) /
                                  executions.filter(e => e.duration).length /
                                  1000
                              ).toFixed(2)
                            : '0.00'}
                        s
                    </span>
                </div>
            )}
        </div>
    );
};
