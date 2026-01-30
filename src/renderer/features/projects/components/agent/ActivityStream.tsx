import { Bot, List } from 'lucide-react';
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

const ActivityItem = memo(({ log }: { log: ActivityLog }) => (
    <div className="flex gap-2 text-[11px] leading-relaxed py-0.5 animate-in fade-in slide-in-from-left-1 duration-300">
        <span className="text-muted-foreground/50 whitespace-nowrap font-mono">
            {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span className={cn(
            "font-black uppercase tracking-tighter text-[9px]",
            log.type === 'info' && "text-blue-400",
            log.type === 'llm' && "text-purple-400",
            log.type === 'tool' && "text-yellow-400",
            log.type === 'success' && "text-emerald-400",
            log.type === 'error' && "text-destructive"
        )}>
            [{log.type}]
        </span>
        <span className="text-foreground/80 break-words flex-1 selection:bg-primary/30">{log.message}</span>
    </div>
));

ActivityItem.displayName = 'ActivityItem';

export const ActivityStream: React.FC<ActivityStreamProps> = ({ logs }) => {
    const { t } = useTranslation();
    return (
        <div className="flex-[2] bg-card/30 backdrop-blur-xl rounded-2xl border border-border/50 flex flex-col min-h-0 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/70 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    {t('agent.activitiesCount', { count: logs.length })}
                </h3>
                <List className="w-4 h-4 text-muted-foreground/30" />
            </div>

            <div className="flex-1 min-h-0 relative">
                {logs.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 border border-primary/10">
                            <Bot className="w-8 h-8 text-primary/40" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">{t('agent.waitingActivity')}</p>
                    </div>
                ) : (
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={logs}
                        followOutput="smooth"
                        initialTopMostItemIndex={logs.length > 0 ? logs.length - 1 : 0}
                        itemContent={(_index, log) => (
                            <div className="px-4">
                                <ActivityItem log={log} />
                            </div>
                        )}
                        components={{
                            Header: () => <div className="h-4" />,
                            Footer: () => <div className="h-4" />,
                        }}
                    />
                )}
            </div>
        </div>
    );
};

