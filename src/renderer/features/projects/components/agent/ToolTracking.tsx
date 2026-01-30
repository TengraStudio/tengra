import { CheckCircle, Clock, Loader2, Square, XCircle } from 'lucide-react';
import React from 'react';

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

export const ToolTracking: React.FC<ToolTrackingProps> = ({ executions, t }) => {
    return (
        <div className="flex-1 bg-card rounded-xl border border-border flex flex-col min-h-0 overflow-hidden">
            <div className="p-3 border-b border-border shrink-0">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Square className="w-4 h-4 text-primary" />
                    {t('agent.activeTools')}
                </h3>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                {executions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{t('agent.noToolCalls')}</p>
                ) : (
                    executions.map((tool) => (
                        <div key={tool.id} className="bg-muted/10 border border-border/50 rounded-lg p-2 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-foreground truncate">{tool.name}</span>
                                {tool.status === 'running' ? (
                                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                                ) : tool.status === 'completed' ? (
                                    <CheckCircle className="w-3 h-3 text-success" />
                                ) : (
                                    <XCircle className="w-3 h-3 text-destructive" />
                                )}
                            </div>
                            {tool.duration !== undefined && (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {((tool.duration ?? 0) / 1000).toFixed(2)}s
                                </div>
                            )}
                            {tool.error && (
                                <p className="text-[10px] text-destructive truncate">{tool.error}</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
