import { Bot, CheckCircle, ChevronDown, ChevronRight, Clock, List, Loader2, Pause, Play, Plus, Trash2, X, XCircle } from 'lucide-react';
import React, { memo, useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { cn } from '@/lib/utils';

export interface TaskHistoryItem {
    id: string;
    description: string;
    provider: string;
    model: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    planCount: number;
    currentPlan?: number;
    metrics?: {
        tokensUsed: number;
        llmCalls: number;
        toolCalls: number;
        estimatedCost: number;
    };
}

interface TaskSidebarProps {
    groupedTasks: Record<string, TaskHistoryItem[]>;
    expandedProviders: Set<string>;
    toggleProvider: (provider: string) => void;
    selectedTaskId: string | null;
    onSelectTask: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onResumeTask: (taskId: string) => void;
    onCloseSidebar: () => void;
    onNewTask: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const TaskItem = memo(({
    task,
    isSelected,
    onSelect,
    onDelete,
    onResume,
    formatTime,
    t
}: {
    task: TaskHistoryItem;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onResume: (id: string) => void;
    formatTime: (date: Date) => string;
    t: (key: string, options?: Record<string, string | number>) => string;
}) => {
    const getStatusIcon = (s: TaskHistoryItem['status']) => {
        switch (s) {
            case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
            case 'paused': return <Pause className="w-4 h-4 text-yellow-500" />;
            default: return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
        }
    };

    return (
        <div
            onClick={() => onSelect(task.id)}
            className={cn(
                "group relative p-3 rounded-lg cursor-pointer transition-all border border-transparent mb-0.5",
                isSelected
                    ? "bg-primary/10 border-primary/20 shadow-sm"
                    : "hover:bg-muted/10 hover:border-border/30"
            )}
        >
            <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2 overflow-hidden mr-2">
                    {getStatusIcon(task.status)}
                    <span className={cn(
                        "text-sm font-medium truncate",
                        isSelected ? "text-primary-foreground" : "text-foreground"
                    )}>
                        {task.description ?? t('agent.untitled_task')}
                    </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {task.status === 'paused' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onResume(task.id); }}
                            className="p-1 hover:bg-primary/20 rounded text-primary transition-colors"
                            title={t('common.resume')}
                        >
                            <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                        className="p-1 hover:bg-destructive/10 rounded text-destructive/70 hover:text-destructive transition-colors"
                        title={t('common.delete')}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1 opacity-60">
                        <Clock className="w-3 h-3" />
                        {formatTime(task.createdAt)}
                    </span>
                    <span className="opacity-30">•</span>
                    <span className="truncate max-w-[80px] opacity-60">{task.model}</span>
                </div>
                {task.metrics && task.metrics.tokensUsed > 0 && (
                    <div className="text-[10px] font-mono text-primary/40 group-hover:text-primary transition-colors">
                        {Math.round(task.metrics.tokensUsed / 1000)}k tkn
                    </div>
                )}
            </div>
        </div>
    );
});

TaskItem.displayName = 'TaskItem';

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
    groupedTasks,
    expandedProviders,
    toggleProvider,
    selectedTaskId,
    onSelectTask,
    onDeleteTask,
    onResumeTask,
    onCloseSidebar,
    onNewTask,
    t
}) => {
    const [now] = useState(() => Date.now());

    const formatRelativeTime = useMemo(() => (date: Date): string => {
        const diff = now - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1) { return t('agent.justNow'); }
        if (minutes < 60) { return t('agent.minutesAgo', { count: minutes }); }
        if (hours < 24) { return t('agent.hoursAgo', { count: hours }); }
        return t('agent.daysAgo', { count: days });
    }, [now, t]);

    // Flatten data for Virtuoso
    const items = useMemo(() => {
        const flattened: Array<{ type: 'header'; provider: string; count: number } | { type: 'task'; task: TaskHistoryItem }> = [];
        Object.entries(groupedTasks).forEach(([provider, tasks]) => {
            flattened.push({ type: 'header', provider, count: tasks.length });
            if (expandedProviders.has(provider)) {
                tasks.forEach(task => flattened.push({ type: 'task', task }));
            }
        });
        return flattened;
    }, [groupedTasks, expandedProviders]);

    return (
        <div className="w-80 border-r border-border flex flex-col bg-card/10 backdrop-blur-3xl h-full shadow-2xl">
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-card/40">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
                        <List className="w-4 h-4 text-primary relative" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/70">{t('agent.history')}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onNewTask}
                        className="p-2 hover:bg-primary/10 text-primary rounded-xl transition-all active:scale-90 flex items-center gap-2 border border-primary/20 shadow-lg shadow-primary/5"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onCloseSidebar}
                        className="p-2 hover:bg-muted/20 rounded-xl transition-all active:scale-90 border border-border/50"
                    >
                        <X className="w-4 h-4 text-muted-foreground/50" />
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative">
                {items.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 space-y-4">
                        <div className="w-20 h-20 rounded-[2.5rem] bg-muted/5 flex items-center justify-center border border-muted/10">
                            <Bot className="w-10 h-10 text-muted-foreground/10" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 leading-relaxed">
                            {t('agent.no_tasks_yet')}
                        </p>
                    </div>
                ) : (
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={items}
                        itemContent={(_index, item) => {
                            if (item.type === 'header') {
                                return (
                                    <button
                                        onClick={() => toggleProvider(item.provider)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/5 transition-colors group border-y border-border/10 mt-2 first:mt-0"
                                    >
                                        <div className="p-1 rounded-md bg-muted/10 group-hover:bg-primary/10 transition-colors">
                                            {expandedProviders.has(item.provider) ? (
                                                <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                            ) : (
                                                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                            )}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground transition-colors">
                                            {item.provider}
                                        </span>
                                        <span className="ml-auto text-[9px] font-black font-mono text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity">
                                            {item.count.toString().padStart(2, '0')}
                                        </span>
                                    </button>
                                );
                            } else {
                                return (
                                    <div className="px-2">
                                        <TaskItem
                                            task={item.task}
                                            isSelected={selectedTaskId === item.task.id}
                                            onSelect={onSelectTask}
                                            onDelete={onDeleteTask}
                                            onResume={onResumeTask}
                                            formatTime={formatRelativeTime}
                                            t={t}
                                        />
                                    </div>
                                );
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );
};

