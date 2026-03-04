import {
    Bot,
    ChevronDown,
    ChevronRight,
    Clock,
    History,
    Play,
    Plus,
    Terminal,
    Trash2,
    X,
    Zap,
} from 'lucide-react';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { CheckpointItem } from '@/features/workspace/hooks/useAgentHistory';
import { cn } from '@/lib/utils';

import { CheckpointList } from './CheckpointList';

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
    latestCheckpointId?: string;
}

interface TaskSidebarProps {
    groupedTasks: Record<string, TaskHistoryItem[]>;
    expandedProviders: Set<string>;
    toggleProvider: (provider: string) => void;
    selectedTaskId: string | null;
    onSelectTask: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onResumeTask: (taskId: string) => void;
    onResumeCheckpoint: (checkpointId: string) => void;
    onRollbackCheckpoint: (checkpointId: string) => void;
    getCheckpoints: (taskId: string) => Promise<CheckpointItem[]>;
    onCloseSidebar: () => void;
    onNewTask: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const StatusLED: React.FC<{ status: TaskHistoryItem['status'] }> = ({ status }) => {
    const colors = {
        running: 'bg-success shadow-success/50 animate-pulse',
        completed: 'bg-primary shadow-primary/50',
        failed: 'bg-destructive shadow-destructive/50',
        paused: 'bg-warning shadow-warning/50',
    };

    return (
        <div className="relative flex items-center justify-center w-3 h-3">
            <div className={cn('absolute w-2 h-2 rounded-full shadow-[0_0_8px]', colors[status])} />
            <div className={cn('w-1.5 h-1.5 rounded-full', colors[status])} />
        </div>
    );
};

const TaskItem = memo(
    ({
        task,
        isSelected,
        onSelect,
        onDelete,
        onResume,
        onResumeCheckpoint,
        onRollbackCheckpoint,
        getCheckpoints,
        formatTime,
        t,
    }: {
        task: TaskHistoryItem;
        isSelected: boolean;
        onSelect: (id: string) => void;
        onDelete: (id: string) => void;
        onResume: (id: string) => void;
        onResumeCheckpoint: (id: string) => void;
        onRollbackCheckpoint: (id: string) => void;
        getCheckpoints: (id: string) => Promise<CheckpointItem[]>;
        formatTime: (date: Date) => string;
        t: (key: string, options?: Record<string, string | number>) => string;
    }) => {
        const [showCheckpoints, setShowCheckpoints] = useState(false);
        const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
        const [isLoadingCheckpoints, setIsLoadingCheckpoints] = useState(false);

        const toggleCheckpoints = useCallback(
            async (e: React.MouseEvent) => {
                e.stopPropagation();
                if (!showCheckpoints) {
                    setIsLoadingCheckpoints(true);
                    try {
                        const data = await getCheckpoints(task.id);
                        setCheckpoints(data);
                    } finally {
                        setIsLoadingCheckpoints(false);
                    }
                }
                setShowCheckpoints(!showCheckpoints);
            },
            [showCheckpoints, task.id, getCheckpoints]
        );

        return (
            <div
                onClick={() => onSelect(task.id)}
                className={cn(
                    'group relative cursor-pointer transition-all duration-200 font-mono',
                    'border-l-2 ml-2 pl-3 py-2 pr-2',
                    isSelected
                        ? 'border-l-primary bg-primary/5'
                        : 'border-l-border hover:border-l-muted-foreground hover:bg-muted/30'
                )}
            >
                {/* Scan line effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-foreground/[0.02] to-transparent h-8 animate-scan" />
                </div>

                <div className="flex items-start gap-2 relative">
                    <StatusLED status={task.status} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className={cn(
                                    'text-xs font-medium truncate tracking-tight',
                                    isSelected ? 'text-primary' : 'text-foreground/90'
                                )}
                            >
                                {task.description}
                            </span>
                        </div>

                        {/* Metrics row */}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                            <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatTime(task.createdAt)}
                            </span>
                            <span className="text-border">|</span>
                            <span className="truncate max-w-[60px] uppercase text-[9px]">
                                {task.model}
                            </span>
                            {task.metrics && task.metrics.tokensUsed > 0 && (
                                <>
                                    <span className="text-border">|</span>
                                    <span className="text-primary/60">
                                        {Math.round(task.metrics.tokensUsed / 1000)}K
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action buttons - appear on hover */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={e => {
                            void toggleCheckpoints(e);
                        }}
                        className={cn(
                            'p-1.5 rounded transition-colors',
                            showCheckpoints
                                ? 'text-primary bg-primary/10'
                                : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                        )}
                        title={t('agent.viewCheckpoints')}
                    >
                        <History className="w-3 h-3" />
                    </button>
                    {(task.status === 'paused' ||
                        (task.latestCheckpointId && task.status !== 'running')) && (
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                if (task.status === 'paused') {
                                    onResume(task.id);
                                } else if (task.latestCheckpointId) {
                                    onResumeCheckpoint(task.latestCheckpointId);
                                }
                            }}
                            className="p-1.5 rounded text-success/70 hover:text-success hover:bg-success/10 transition-colors"
                            title={t('common.resume')}
                        >
                            <Play className="w-3 h-3 fill-current" />
                        </button>
                    )}
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            onDelete(task.id);
                        }}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title={t('common.delete')}
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>

                {/* Checkpoints panel */}
                {showCheckpoints && (
                    <div className="mt-2 ml-1 border-l border-dashed border-primary/30 pl-3 py-1">
                        <CheckpointList
                            checkpoints={checkpoints}
                            onResume={id => onResumeCheckpoint(id)}
                            onRollback={id => onRollbackCheckpoint(id)}
                            isLoading={isLoadingCheckpoints}
                            formatTime={formatTime}
                            t={t}
                        />
                    </div>
                )}
            </div>
        );
    }
);

TaskItem.displayName = 'TaskItem';

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
    groupedTasks,
    expandedProviders,
    toggleProvider,
    selectedTaskId,
    onSelectTask,
    onDeleteTask,
    onResumeTask,
    onResumeCheckpoint,
    onRollbackCheckpoint,
    getCheckpoints,
    onCloseSidebar,
    onNewTask,
    t,
}) => {
    const [now] = useState(() => Date.now());

    const formatRelativeTime = useMemo(
        () =>
            (date: Date): string => {
                const diff = now - date.getTime();
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(diff / 3600000);
                const days = Math.floor(diff / 86400000);
                if (minutes < 1) {
                    return t('agent.justNow');
                }
                if (minutes < 60) {
                    return t('agent.minutesAgo', { count: minutes });
                }
                if (hours < 24) {
                    return t('agent.hoursAgo', { count: hours });
                }
                return t('agent.daysAgo', { count: days });
            },
        [now, t]
    );

    const items = useMemo(() => {
        const flattened: Array<
            | { type: 'header'; provider: string; count: number }
            | { type: 'task'; task: TaskHistoryItem }
        > = [];
        Object.entries(groupedTasks).forEach(([provider, tasks]) => {
            flattened.push({ type: 'header', provider, count: tasks.length });
            if (expandedProviders.has(provider)) {
                tasks.forEach(task => flattened.push({ type: 'task', task }));
            }
        });
        return flattened;
    }, [groupedTasks, expandedProviders]);

    return (
        <div className="w-72 flex flex-col h-full bg-card/40 backdrop-blur-xl border-r border-border relative overflow-hidden">
            {/* Decorative grid pattern */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: `
                        linear-gradient(to right, currentColor 1px, transparent 1px),
                        linear-gradient(to bottom, currentColor 1px, transparent 1px)
                    `,
                        backgroundSize: '20px 20px',
                    }}
                />
            </div>

            {/* Header */}
            <div className="relative p-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Terminal className="w-4 h-4 text-primary" />
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground font-mono">
                                {t('agent.history')}
                            </h3>
                            <div className="text-[9px] font-mono text-primary/50 tracking-wider">
                                SYS.TASKS.LOG
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onNewTask}
                            className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 hover:border-primary/40 group"
                            title="New Task"
                        >
                            <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                        <button
                            onClick={onCloseSidebar}
                            className="p-2 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* ASCII art decorative line */}
                <div className="mt-2 text-[8px] font-mono text-muted-foreground/20 tracking-widest overflow-hidden">
                    {'═'.repeat(40)}
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 min-h-0 relative">
                {items.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                        <div className="relative mb-4">
                            <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-border flex items-center justify-center">
                                <Bot className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
                                <Zap className="w-2 h-2 text-muted-foreground/40" />
                            </div>
                        </div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">
                            {t('agent.no_tasks_yet')}
                        </p>
                        <p className="text-[9px] font-mono text-muted-foreground/30">
                            AWAITING COMMANDS...
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
                                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/30 transition-colors group mt-1 first:mt-0"
                                    >
                                        <div
                                            className={cn(
                                                'p-1 rounded transition-colors',
                                                expandedProviders.has(item.provider)
                                                    ? 'text-primary'
                                                    : 'text-muted-foreground group-hover:text-foreground'
                                            )}
                                        >
                                            {expandedProviders.has(item.provider) ? (
                                                <ChevronDown className="w-3 h-3" />
                                            ) : (
                                                <ChevronRight className="w-3 h-3" />
                                            )}
                                        </div>
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground transition-colors">
                                            {item.provider}
                                        </span>
                                        <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent mx-2" />
                                        <span className="text-[9px] font-mono text-primary/40 tabular-nums">
                                            [{item.count.toString().padStart(2, '0')}]
                                        </span>
                                    </button>
                                );
                            } else {
                                return (
                                    <TaskItem
                                        task={item.task}
                                        isSelected={selectedTaskId === item.task.id}
                                        onSelect={onSelectTask}
                                        onDelete={onDeleteTask}
                                        onResume={onResumeTask}
                                        onResumeCheckpoint={onResumeCheckpoint}
                                        onRollbackCheckpoint={onRollbackCheckpoint}
                                        getCheckpoints={getCheckpoints}
                                        formatTime={formatRelativeTime}
                                        t={t}
                                    />
                                );
                            }
                        }}
                    />
                )}
            </div>

            {/* Footer status bar */}
            <div className="p-2 border-t border-border bg-card/30">
                <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                    <span>v2.1.0</span>
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
                        <span>ONLINE</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
