/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { JsonValue } from '@shared/types/common';
import {
    IconAlertCircle,
    IconAnalyze,
    IconArrowRight,
    IconBolt,
    IconBulb,
    IconCalendar as CalendarIcon,
    IconCalendarMonth,
    IconChartBar,
    IconChartPie,
    IconChecklist,
    IconChevronLeft,
    IconChevronRight,
    IconCircle,
    IconCircleCheck,
    IconClock,
    IconDots,
    IconEdit,
    IconFlag,
    IconHash,
    IconLayoutKanban,
    IconLink,
    IconListCheck,
    IconPlus,
    IconRefresh,
    IconRepeat,
    IconSearch,
    IconSquareCheck,
    IconTrash,
    IconTrendingUp
} from '@tabler/icons-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    addDays,
    addMonths,
    addWeeks,
    addYears,
    eachDayOfInterval,
    eachMonthOfInterval,
    endOfMonth,
    endOfYear,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isSameYear,
    isToday,
    parseISO,
    startOfMonth,
    startOfYear,
    startOfWeek,
    subMonths,
    subYears,
} from 'date-fns';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ConfirmationModal
} from '@/components/ui/ConfirmationModal';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';
import { pushNotification } from '@/store/notification-center.store';
import { fetchModels, getSelectableProviderId } from '@/features/models/utils/model-fetcher';

// Types
type TaskStatus = 'idea' | 'in_progress' | 'approved' | 'upcoming' | 'bug';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface SubTask {
    id: string;
    title: string;
    completed: boolean;
}

interface AITaskOutput {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    subtasks: string[];
}

interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    estimation?: string;
    deadline?: string;
    subtasks: SubTask[];
    createdAt: number;
    dependencies?: string[];
    recurring?: 'daily' | 'weekly' | 'monthly' | 'none';
}

interface WorkspaceTodoTabProps {
    workspace: Workspace;
    onUpdate?: (updates: Partial<Workspace>) => Promise<void>;
    t?: (key: string) => string;
}

const CATEGORIES: { id: TaskStatus; labelKey: string; icon: React.ElementType; color: string }[] = [
    { id: 'idea', labelKey: 'categoryIdea', icon: IconBulb, color: 'text-amber-500' },
    { id: 'upcoming', labelKey: 'categoryUpcoming', icon: IconClock, color: 'text-slate-400' },
    { id: 'in_progress', labelKey: 'categoryInProgress', icon: IconCircle, color: 'text-blue-500' },
    { id: 'approved', labelKey: 'categoryApproved', icon: IconCircleCheck, color: 'text-emerald-500' },
    { id: 'bug', labelKey: 'categoryBug', icon: IconAlertCircle, color: 'text-rose-500' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { icon: React.ElementType; color: string; labelKey: string }> = {
    low: { icon: IconFlag, color: 'text-emerald-500', labelKey: 'priorityLow' },
    medium: { icon: IconFlag, color: 'text-blue-500', labelKey: 'priorityMedium' },
    high: { icon: IconFlag, color: 'text-amber-400', labelKey: 'priorityHigh' },
    urgent: { icon: IconAlertCircle, color: 'text-rose-500', labelKey: 'priorityUrgent' },
};

// Draggable Task Card Component
const TaskCard = ({
    task,
    allTasks = [],
    isOverlay = false,
    onEdit,
    onDelete,
    onToggleSubtask,
    onAddSubtask
}: {
    task: Task;
    allTasks?: Task[];
    isOverlay?: boolean;
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    onToggleSubtask: (taskId: string, subtaskId: string) => void;
    onAddSubtask: (taskId: string) => void;
}) => {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isOverlay ? 100 : undefined
    } : undefined;

    const completedSubtasks = task.subtasks.filter(s => s.completed).length;
    const progressPerc = task.subtasks.length > 0
        ? Math.round((completedSubtasks / task.subtasks.length) * 100)
        : 0;

    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

    const blockingTasks = useMemo(() => {
        if (!task.dependencies || task.dependencies.length === 0) return [];
        return allTasks.filter(t => task.dependencies?.includes(t.id) && t.status !== 'approved');
    }, [task.dependencies, allTasks]);

    const isBlocked = blockingTasks.length > 0;

    return (
        <Card
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={cn(
                "p-4 mb-3 border-border/40 bg-card/60 backdrop-blur-sm cursor-grab active:cursor-grabbing transition-all",
                isDragging && !isOverlay && "opacity-30",
                isOverlay && "shadow-xl ring-1 ring-primary/20 cursor-grabbing rotate-1 scale-102",
                "hover:border-primary/30 group border"
            )}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <priority.icon className={cn("w-3 h-3 shrink-0", priority.color)} />
                            <span className={cn("typo-overline font-medium uppercase ", priority.color)}>
                                {t(`frontend.workspaceTodo.${priority.labelKey}`)}
                            </span>
                            {task.estimation && (
                                <Badge variant="outline" className="h-4 px-1.5 typo-overline border-border/10 bg-muted/20 text-muted-foreground/60 rounded-sm font-medium">
                                    <IconBolt className="w-2.5 h-2.5 mr-1 text-primary/40" />
                                    {task.estimation}
                                </Badge>
                            )}
                            {isBlocked && (
                                <Badge variant="outline" className="h-4 px-1.5 typo-overline border-rose-500/20 bg-rose-500/5 text-rose-500/60 rounded-sm font-bold flex items-center gap-1">
                                    <IconLink className="w-2.5 h-2.5" />
                                    Blocked
                                </Badge>
                            )}
                        </div>
                        <h4 className="text-sm font-medium text-foreground leading-tight pr-4 break-words">
                            {task.title}
                        </h4>
                    </div>
                    <div onPointerDown={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-muted">
                                    <IconDots className="h-4 w-4 text-muted-foreground/60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 border-border/40 backdrop-blur-xl">
                                <DropdownMenuItem onClick={() => onEdit(task)} className="text-sm py-2">
                                    <IconEdit className="mr-2 h-3.5 w-3.5" /> {t('frontend.workspaceTodo.editDetails')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAddSubtask(task.id)} className="text-sm py-2">
                                    <IconListCheck className="mr-2 h-3.5 w-3.5" /> {t('frontend.workspaceTodo.addSubtask')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-sm py-2 text-destructive focus:text-destructive">
                                    <IconTrash className="mr-2 h-3.5 w-3.5" /> {t('frontend.workspaceTodo.deleteTask')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {task.description && (
                    <p className="text-sm text-muted-foreground/60 line-clamp-2 leading-relaxed">
                        {task.description}
                    </p>
                )}

                {task.subtasks.length > 0 && (
                    <div className="space-y-2 py-1">
                        <div className="flex items-center justify-between typo-overline text-muted-foreground/40 font-medium">
                            <span className="flex items-center gap-1.5">
                                <IconSquareCheck className="w-3 h-3" />
                                {completedSubtasks}/{task.subtasks.length}
                            </span>
                            <span>{progressPerc}%</span>
                        </div>
                        <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary/30 transition-all duration-700 ease-in-out"
                                style={{ width: `${progressPerc}%` }}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1" onPointerDown={(e) => e.stopPropagation()}>
                            {task.subtasks.map(sub => (
                                <div key={sub.id} className="flex items-center gap-2 group/sub">
                                    <Checkbox
                                        checked={sub.completed}
                                        onCheckedChange={() => onToggleSubtask(task.id, sub.id)}
                                        className="h-3.5 w-3.5 rounded border-border/40 data-[state=checked]:bg-primary/40 data-[state=checked]:border-none"
                                    />
                                    <span className={cn(
                                        "text-sm transition-colors cursor-default",
                                        sub.completed ? "text-muted-foreground/20 line-through" : "text-muted-foreground/70"
                                    )}>
                                        {sub.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/10">
                    <div className="flex items-center gap-3">
                        {task.deadline ? (
                            <div className="flex items-center gap-1.5 typo-overline text-muted-foreground/40 font-medium">
                                <CalendarIcon className="w-3 h-3 text-muted-foreground/20" />
                                {format(new Date(task.deadline), 'MMM d, yyyy')}
                            </div>
                        ) : <div />}

                        {task.recurring && task.recurring !== 'none' && (
                            <IconRepeat className="w-3 h-3 text-primary/40" />
                        )}
                        {task.dependencies && task.dependencies.length > 0 && (
                            <IconLink className="w-3 h-3 text-blue-500/40" />
                        )}
                    </div>

                    <div className="flex items-center gap-1 typo-overline text-muted-foreground/20 font-medium opacity-0 group-hover:opacity-100 transition-opacity uppercase pl-2">
                        <IconHash className="w-2.5 h-2.5" />
                        {task.id.slice(0, 4)}
                    </div>
                </div>
            </div>
        </Card>
    );
};

// Compact Task Card for Calendar Views
const CompactTaskCard = ({
    task,
    onEdit
}: {
    task: Task;
    onEdit: (task: Task) => void;
}) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: task.id,
    });

    const style = {
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
            }}
            className={cn(
                "text-[10px] leading-tight px-1.5 py-1 rounded border border-border/40 bg-card/40 backdrop-blur-sm cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-card/60 transition-all truncate font-medium flex items-center gap-1.5",
                PRIORITY_CONFIG[task.priority]?.color || "text-foreground"
            )}
        >
            {task.recurring && task.recurring !== 'none' && <IconRepeat className="w-2.5 h-2.5 shrink-0" />}
            <span className="truncate flex-1">{task.title}</span>
        </div>
    );
};

// Droppable Column Component
const TaskColumn = ({
    category,
    tasks,
    allTasks,
    onEdit,
    onDelete,
    onToggleSubtask,
    onAddSubtask,
    customDroppableId
}: {
    category: typeof CATEGORIES[0];
    tasks: Task[];
    allTasks: Task[];
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    onToggleSubtask: (taskId: string, subtaskId: string) => void;
    onAddSubtask: (taskId: string) => void;
    customDroppableId?: string;
}) => {
    const { t } = useTranslation();
    const { setNodeRef, isOver } = useDroppable({
        id: customDroppableId || category.id,
    });

    return (
        <div className={cn("flex flex-col shrink-0", customDroppableId ? "w-full h-full" : "w-80")}>
            {!customDroppableId && (
                <div className="flex items-center gap-2.5 mb-5 px-1.5">
                    <category.icon className={cn("w-4 h-4", category.color)} />
                    <h3 className="text-sm font-semibold text-foreground/80 pt-0.5">
                        {t(`frontend.workspaceTodo.${category.labelKey}`)}
                    </h3>
                    <Badge variant="secondary" className="ml-auto bg-muted/40 text-muted-foreground/50 border-none font-medium typo-overline px-2 h-5 rounded-md">
                        {tasks.length}
                    </Badge>
                </div>
            )}

            <div
                ref={setNodeRef}
                className={cn(
                    "flex-1 p-2.5 rounded-2xl transition-all min-h-0",
                    isOver ? "bg-primary/5 ring-1 ring-inset ring-primary/10 shadow-lg" : (!customDroppableId ? "bg-muted/5 border border-dashed border-border/10" : "")
                )}
            >
                {tasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onToggleSubtask={onToggleSubtask}
                        onAddSubtask={onAddSubtask}
                    />
                ))}

                {tasks.length === 0 && !isOver && !customDroppableId && (
                    <div className="h-full flex flex-col items-center justify-center py-24 grayscale opacity-20 transition-opacity hover:opacity-30">
                        <category.icon className="w-12 h-12 mb-4" />
                        <span className="typo-overline font-medium uppercase">Empty</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Calendar Day Component
const CalendarDay = ({
    day,
    isCurrentMonth,
    tasks,
    onAddTask,
    onEdit,
    onDelete,
    onToggleSubtask,
    onAddSubtask
}: {
    day: Date;
    isCurrentMonth: boolean;
    tasks: Task[];
    onAddTask: (date: string) => void;
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    onToggleSubtask: (taskId: string, subtaskId: string) => void;
    onAddSubtask: (taskId: string) => void;
}) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const { setNodeRef, isOver } = useDroppable({
        id: dateStr,
    });

    const isTodayDate = isToday(day);

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "min-h-140 flex flex-col border-r border-b border-border/20 transition-colors p-2 relative group/day",
                !isCurrentMonth && "bg-muted/5 opacity-40",
                isOver && "bg-primary/5",
                isTodayDate && "bg-primary/2"
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <span className={cn(
                    "text-xs font-semibold px-2 py-1 rounded-md",
                    isTodayDate ? "bg-primary text-primary-foreground" : "text-muted-foreground/60"
                )}>
                    {format(day, 'd')}
                </span>
                <Button
                    variant="ghost"
                    onClick={() => onAddTask(dateStr)}
                    className="h-6 w-6 p-0 opacity-0 group-hover/day:opacity-100 transition-opacity rounded-full hover:bg-muted"
                >
                    <IconPlus className="w-3.5 h-3.5 text-muted-foreground/60" />
                </Button>
            </div>

            <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-100 scrollbar-hide">
                {tasks.map(task => (
                    <CompactTaskCard
                        key={task.id}
                        task={task}
                        onEdit={onEdit}
                    />
                ))}
            </div>
        </div>
    );
};

// Calendar Backlog Component
const CalendarBacklog = ({
    tasks,
    onEdit,
    onDelete,
    onToggleSubtask,
    onAddSubtask
}: {
    tasks: Task[];
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    onToggleSubtask: (taskId: string, subtaskId: string) => void;
    onAddSubtask: (taskId: string) => void;
}) => {
    const { t } = useTranslation();
    const { setNodeRef, isOver } = useDroppable({
        id: 'backlog',
    });

    return (
        <div 
            ref={setNodeRef}
            className={cn(
                "w-80 shrink-0 border-l border-border/20 flex flex-col transition-colors",
                isOver ? "bg-primary/5" : "bg-background/5"
            )}
        >
            <div className="p-6 border-b border-border/10 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40">{t('frontend.workspaceTodo.backlog')}</h3>
                <Badge variant="outline" className="text-[10px] border-border/10">
                    {tasks.length}
                </Badge>
            </div>
            <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-3">
                    {tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggleSubtask={onToggleSubtask}
                            onAddSubtask={onAddSubtask}
                        />
                    ))}
                    {tasks.length === 0 && (
                        <div className="py-12 text-center text-xs text-muted-foreground/20 italic">
                            {t('frontend.workspaceTodo.noUnscheduledTasks')}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
// Analytics Component
const WorkspaceTodoAnalytics = ({ tasks }: { tasks: Task[] }) => {
    const { t } = useTranslation();
    const statusData = useMemo(() => {
        return CATEGORIES.map(cat => ({
            name: t(`frontend.workspaceTodo.${cat.labelKey}`),
            value: tasks.filter(t => t.status === cat.id).length,
            color: cat.id === 'bug' ? '#f43f5e' :
                   cat.id === 'approved' ? '#10b981' :
                   cat.id === 'in_progress' ? '#3b82f6' :
                   cat.id === 'upcoming' ? '#8b5cf6' : '#94a3b8'
        })).filter(d => d.value > 0);
    }, [tasks, t]);

    const priorityData = useMemo(() => {
        return Object.entries(PRIORITY_CONFIG).map(([key, config]) => ({
            name: t(`frontend.workspaceTodo.${config.labelKey}`),
            value: tasks.filter(t => t.priority === key).length,
            color: config.color.includes('rose') ? '#f43f5e' :
                   config.color.includes('amber') ? '#f59e0b' :
                   config.color.includes('emerald') ? '#10b981' : '#3b82f6'
        })).reverse();
    }, [tasks, t]);

    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'approved').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const bugs = tasks.filter(t => t.status === 'bug').length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { total, completed, inProgress, bugs, completionRate };
    }, [tasks]);

    return (
        <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
            <div className="max-w-7xl mx-auto space-y-10">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Tasks', value: stats.total, icon: IconChecklist, color: 'text-primary' },
                        { label: 'Active Progress', value: stats.inProgress, icon: IconTrendingUp, color: 'text-blue-500' },
                        { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: IconCircleCheck, color: 'text-emerald-500' },
                        { label: 'Active Bugs', value: stats.bugs, icon: IconAlertCircle, color: 'text-rose-500' },
                    ].map((s, i) => (
                        <Card key={i} className="p-6 border-border/20 bg-background/5 backdrop-blur-md flex items-center gap-5 group hover:border-primary/20 transition-all">
                            <div className={cn("p-3 rounded-2xl bg-background/20", s.color)}>
                                <s.icon className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{s.label}</span>
                                <span className="text-2xl font-bold tracking-tight">{s.value}</span>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Status Distribution */}
                    <Card className="p-8 border-border/20 bg-background/5 backdrop-blur-md flex flex-col gap-8 h-400">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                <IconChartPie className="w-4 h-4" /> Status Distribution
                            </h3>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff', fontSize: '12px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {statusData.map((d, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                    <span className="text-[10px] font-medium text-muted-foreground/60 uppercase">{d.name}</span>
                                    <span className="text-xs font-bold ml-auto">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Priority Breakdown */}
                    <Card className="p-8 border-border/20 bg-background/5 backdrop-blur-md flex flex-col gap-8 h-400">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                <IconChartBar className="w-4 h-4" /> Priority Breakdown
                            </h3>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }} width={80} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                        contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                        {priorityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

// Year Month Component (Droppable Month in Year View)
const YearMonthCell = ({
    month,
    tasks,
    onEdit,
    onAddTask
}: {
    month: Date;
    tasks: Task[];
    onEdit: (task: Task) => void;
    onAddTask: (date: string) => void;
}) => {
    const monthStr = format(month, 'yyyy-MM');
    const { setNodeRef, isOver } = useDroppable({
        id: monthStr,
    });

    const isCurrentMonth = isSameMonth(month, new Date());

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col border-r border-b border-border/20 transition-colors p-4 min-h-160 relative group/month",
                isOver && "bg-primary/5",
                isCurrentMonth && "bg-primary/2"
            )}
        >
            <div className="flex items-center justify-between mb-3">
                <span className={cn(
                    "text-xs font-bold uppercase tracking-widest",
                    isCurrentMonth ? "text-primary" : "text-muted-foreground/40"
                )}>
                    {format(month, 'MMMM')}
                </span>
                <span className="text-[10px] text-muted-foreground/20 font-medium">
                    {tasks.length} tasks
                </span>
            </div>

            <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                {tasks.slice(0, 4).map(task => (
                    <CompactTaskCard
                        key={task.id}
                        task={task}
                        onEdit={onEdit}
                    />
                ))}
                {tasks.length > 4 && (
                    <div className="text-[9px] text-muted-foreground/30 pl-1 font-medium">
                        + {tasks.length - 4} more
                    </div>
                )}
            </div>
            <Button
                variant="ghost"
                onClick={() => onAddTask(format(startOfMonth(month), 'yyyy-MM-dd'))}
                className="absolute bottom-2 right-2 h-6 w-6 p-0 opacity-0 group-hover/month:opacity-100 transition-opacity rounded-full hover:bg-muted"
            >
                <IconPlus className="w-3.5 h-3.5 text-muted-foreground/60" />
            </Button>
        </div>
    );
};

// Year View Component
const YearView = ({
    currentDate,
    tasks,
    onEdit,
    onAddTask
}: {
    currentDate: Date;
    tasks: Task[];
    onEdit: (task: Task) => void;
    onAddTask: (date: string) => void;
}) => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(yearStart);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background/5 rounded-3xl border border-border/20 mx-10 mb-10 shadow-2xl backdrop-blur-xl">
            <div className="flex-1 grid grid-cols-3 md:grid-cols-4 overflow-y-auto">
                {months.map(month => {
                    const monthTasks = tasks.filter(t => t.deadline && isSameMonth(parseISO(t.deadline), month));
                    return (
                        <YearMonthCell
                            key={month.toString()}
                            month={month}
                            tasks={monthTasks}
                            onEdit={onEdit}
                            onAddTask={onAddTask}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// Week View Component
const WeekView = ({
    currentDate,
    tasks,
    allTasks,
    onAddTask,
    onEdit,
    onDelete,
    onToggleSubtask,
    onAddSubtask
}: {
    currentDate: Date;
    tasks: Task[];
    allTasks: Task[];
    onAddTask: (date: string) => void;
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    onToggleSubtask: (taskId: string, subtaskId: string) => void;
    onAddSubtask: (taskId: string) => void;
}) => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(weekStart);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background/5 rounded-3xl border border-border/20 mx-10 mb-10 shadow-2xl backdrop-blur-xl">
            <div className="flex-1 grid grid-cols-7 overflow-y-auto">
                {days.map(day => {
                    const dayTasks = tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day));
                    return (
                        <div key={day.toString()} className="flex flex-col border-r border-border/20 min-h-0">
                            <div className="py-4 border-b border-border/20 bg-muted/20 text-center flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                                    {format(day, 'EEE')}
                                </span>
                                <span className={cn(
                                    "text-sm font-bold",
                                    isToday(day) ? "text-primary" : "text-foreground/70"
                                )}>
                                    {format(day, 'd')}
                                </span>
                            </div>
                            <div className="flex-1 p-4">
                                <TaskColumn
                                    category={{ id: 'upcoming', labelKey: 'categoryUpcoming', icon: IconCircle, color: '' }}
                                    tasks={dayTasks}
                                    allTasks={allTasks}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onToggleSubtask={onToggleSubtask}
                                    onAddSubtask={onAddSubtask}
                                    customDroppableId={format(day, 'yyyy-MM-dd')}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Calendar View Component
const CalendarView = ({
    currentDate,
    tasks,
    onAddTask,
    onEdit,
    onDelete,
    onToggleSubtask,
    onAddSubtask
}: {
    currentDate: Date;
    tasks: Task[];
    onAddTask: (date: string) => void;
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    onToggleSubtask: (taskId: string, subtaskId: string) => void;
    onAddSubtask: (taskId: string) => void;
}) => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background/5 rounded-3xl border border-border/20 mx-10 mb-10 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-7 border-b border-border/20 bg-muted/20">
                {weekDays.map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                        {day}
                    </div>
                ))}
            </div>
            <div className="flex-1 grid grid-cols-7 overflow-y-auto">
                {days.map(day => {
                    const dayTasks = tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day));
                    return (
                        <CalendarDay
                            key={day.toString()}
                            day={day}
                            isCurrentMonth={isSameMonth(day, monthStart)}
                            tasks={dayTasks}
                            onAddTask={onAddTask}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggleSubtask={onToggleSubtask}
                            onAddSubtask={onAddSubtask}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export const WorkspaceTodoTab: React.FC<WorkspaceTodoTabProps> = ({ workspace, onUpdate }) => {
    const { t } = useTranslation();
    // Initialize tasks from workspace prop directly to avoid sync effect warning
    const [tasks, setTasks] = useState<Task[]>(() => {
        const loadedTasks = (workspace?.metadata?.todos as unknown) as Task[];
        return Array.isArray(loadedTasks) ? loadedTasks : [];
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'kanban' | 'calendar' | 'insights'>('kanban');
    const [calendarGranularity, setCalendarGranularity] = useState<'week' | 'month' | 'year'>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Filtered tasks based on search
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
    const [isSubtaskPromptOpen, setIsSubtaskPromptOpen] = useState(false);
    const [subtaskTaskTarget, setSubtaskTaskTarget] = useState<string | null>(null);
    const [subtaskTitle, setSubtaskTitle] = useState('');

    const prevWorkspaceIdRef = useRef<string | null>(workspace?.id || null);

    // Sync tasks when workspace changes (proper render-phase sync)
    if (workspace?.id !== prevWorkspaceIdRef.current) {
        prevWorkspaceIdRef.current = workspace?.id || null;
        const loadedTasks = (workspace?.metadata?.todos as unknown) as Task[];
        setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
    }

    // Form state
    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        deadline: string;
        priority: TaskPriority;
        estimation: string;
        dependencies: string[];
        recurring: Task['recurring'];
    }>({ title: '', description: '', deadline: '', priority: 'medium', estimation: '', dependencies: [], recurring: 'none' });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Database Persistence: Save tasks to workspace metadata
    const saveTasksToDb = useCallback(async (newTasks: Task[]) => {
        if (!onUpdate) {
            return;
        }
        try {
            await onUpdate({
                metadata: {
                    ...(workspace?.metadata || {}),
                    todos: (newTasks as unknown) as JsonValue
                }
            });
        } catch (err) {
            appLogger.error('WorkspaceTodoTab', 'Failed to save tasks to database', err as Error);
        }
    }, [onUpdate, workspace]);

    const updateTasksAndSave = useCallback((updater: (prev: Task[]) => Task[]) => {
        setTasks(prev => {
            let next = updater(prev);

            // Handle recurring tasks completion
            const completedTask = next.find(t =>
                t.status === 'approved' &&
                prev.find(p => p.id === t.id)?.status !== 'approved' &&
                t.recurring && t.recurring !== 'none'
            );

            if (completedTask) {
                const baseDate = completedTask.deadline ? parseISO(completedTask.deadline) : new Date();
                const nextDate = completedTask.recurring === 'daily' ? addDays(baseDate, 1) :
                               completedTask.recurring === 'weekly' ? addWeeks(baseDate, 1) :
                               addMonths(baseDate, 1);

                const newTask: Task = {
                    ...completedTask,
                    id: uuidv4(),
                    status: 'upcoming',
                    deadline: format(nextDate, 'yyyy-MM-dd'),
                    createdAt: Date.now(),
                    subtasks: completedTask.subtasks.map(s => ({ ...s, id: uuidv4(), completed: false }))
                };
                next = [...next, newTask];
            }

            void saveTasksToDb(next);
            return next;
        });
    }, [saveTasksToDb]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) {
            return;
        }

        const taskId = active.id as string;
        const newStatusOrDate = over.id as string;

        if (CATEGORIES.some(cat => cat.id === newStatusOrDate)) {
            updateTasksAndSave(prev => prev.map(task =>
                task.id === taskId ? { ...task, status: newStatusOrDate as TaskStatus } : task
            ));
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(newStatusOrDate)) {
            updateTasksAndSave(prev => prev.map(task =>
                task.id === taskId ? { ...task, deadline: newStatusOrDate } : task
            ));
        } else if (/^\d{4}-\d{2}$/.test(newStatusOrDate)) {
            // Drop on a month in Year View: set to first day of that month
            const newDeadline = `${newStatusOrDate}-01`;
            updateTasksAndSave(prev => prev.map(task =>
                task.id === taskId ? { ...task, deadline: newDeadline } : task
            ));
        } else if (newStatusOrDate === 'backlog') {
            updateTasksAndSave(prev => prev.map(task =>
                task.id === taskId ? { ...task, deadline: undefined } : task
            ));
        }
    };

    const handleOpenCreateModal = () => {
        setEditingTask(null);
        setFormData({ title: '', description: '', deadline: '', priority: 'medium', estimation: '', dependencies: [], recurring: 'none' });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (task: Task) => {
        setEditingTask(task);
        setFormData({
            title: task.title,
            description: task.description,
            deadline: task.deadline || '',
            priority: task.priority || 'medium',
            estimation: task.estimation || '',
            dependencies: task.dependencies || [],
            recurring: task.recurring || 'none'
        });
        setIsModalOpen(true);
    };

    const getAISyncProvider = async () => {
        const allModels = await fetchModels(true);
        const accounts = await window.electron.auth.getLinkedAccounts();
        const providerPriority = ['antigravity', 'copilot', 'openai', 'anthropic', 'google'];

        for (const p of providerPriority) {
            const pModels = allModels.filter(m => getSelectableProviderId(m) === p);
            if (pModels.length > 0) {
                const acc = accounts.find(a => a.provider === p && a.isActive);
                const targetModel = pModels.find(m => 
                    ['haiku', 'flash', 'mini'].some(kw => m.id?.toLowerCase().includes(kw))
                ) || pModels[0];
                return { provider: p, accountId: acc?.id, modelId: targetModel.id || '' };
            }
        }
        return null;
    };

    const handleSyncTodoMd = async () => {
        if (!workspace?.path || isSyncing) return;
        setIsSyncing(true);

        try {
            const response = await window.electron.ipcRenderer.invoke('files:readFile', `${workspace.path}/TODO.md`);
            if (!response.success || !response.data) {
                pushNotification({ type: 'error', message: t('frontend.workspaceTodo.todoNotFound'), source: 'workspace' });
                return;
            }

            const aiProvider = await getAISyncProvider();
            if (!aiProvider) throw new Error("No AI available");

            const prompt = `Analyze the TODO.md and extract tasks as JSON:
            { "tasks": [{ "title": "...", "description": "...", "status": "upcoming"|"approved", "priority": "low"|"medium"|"high", "subtasks": ["..."] }] }
            
            Rules:
            - "[ ]" is upcoming, "[x]" or "[/]" is approved.
            - Nested points are subtasks.
            - Content:
            ${response.data}`;

            const aiRes = await window.electron.session.conversation.complete({
                messages: [{ role: 'user', content: prompt, id: 'todo-' + Date.now(), timestamp: new Date() }],
                model: aiProvider.modelId,
                provider: aiProvider.provider,
                accountId: aiProvider.accountId,
            });

            if (aiRes.content) {
                const parsed = JSON.parse(aiRes.content.replace(/```json|```/g, '').trim()) as { tasks: AITaskOutput[] };
                const newTasks: Task[] = parsed.tasks.map(t => ({
                    id: uuidv4(),
                    title: t.title,
                    description: t.description,
                    status: t.status || 'upcoming',
                    priority: t.priority || 'medium',
                    subtasks: (t.subtasks || []).map(st => ({ id: uuidv4(), title: st, completed: t.status === 'approved' })),
                    createdAt: Date.now(),
                    dependencies: [] as string[],
                    recurring: 'none' as const
                })).filter(nt => !tasks.some(t => t.title.toLowerCase() === nt.title.toLowerCase()));

                if (newTasks.length > 0) {
                    updateTasksAndSave(prev => [...prev, ...newTasks]);
                    pushNotification({ 
                        type: 'success', 
                        message: t('frontend.workspaceTodo.syncSuccess', { count: newTasks.length, subCount: newTasks.reduce((acc, t) => acc + t.subtasks.length, 0) }), 
                        source: 'workspace' 
                    });
                } else {
                    pushNotification({ type: 'info', message: t('frontend.workspaceTodo.syncNoNew'), source: 'workspace' });
                }
            }
        } catch (err) {
            appLogger.error('WorkspaceTodoTab', 'AI Sync failed', err as Error);
            pushNotification({ type: 'warning', message: t('frontend.workspaceTodo.syncError'), source: 'workspace' });
            await handleBasicSync(workspace.path);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleBasicSync = async (path: string) => {
        try {
            const response = await window.electron.ipcRenderer.invoke('files:readFile', `${path}/TODO.md`);
            if (!response.success || !response.data) return;
            
            const lines = (response.data as string).split('\n');
            const newTasks: Task[] = [];
            let cat = '';

            for (const line of lines) {
                const h = line.match(/^#+\s+(.*)/);
                if (h) { cat = h[1]; continue; }
                const t = line.match(/^-\s+\[( |x|\/|-)\]\s+(.*)/i);
                if (t) {
                    const title = t[2].match(/^\*\*(.*?)\*\*/) ? t[2].match(/^\*\*(.*?)\*\*/)?.[1] || t[2] : t[2];
                    if (!tasks.some(tk => tk.title.toLowerCase() === title.toLowerCase())) {
                        newTasks.push({ id: uuidv4(), title, description: `From ${cat || 'TODO.md'}`, status: (t[1].toLowerCase() === 'x' || t[1] === '/') ? 'approved' : 'upcoming', priority: 'medium', subtasks: [], createdAt: Date.now(), dependencies: [], recurring: 'none' });
                    }
                }
            }
            if (newTasks.length > 0) {
                updateTasksAndSave(prev => [...prev, ...newTasks]);
                pushNotification({ type: 'success', message: t('frontend.workspaceTodo.basicSyncSuccess', { count: newTasks.length }), source: 'workspace' });
            }
        } catch (e) {
            appLogger.error('WorkspaceTodoTab', 'Basic Sync failed', e as Error);
        }
    };

    const handleSaveTask = () => {
        if (!formData.title.trim()) {
            return;
        }

        if (editingTask) {
            updateTasksAndSave(prev => prev.map(t =>
                t.id === editingTask.id
                    ? {
                        ...t,
                        title: formData.title,
                        description: formData.description,
                        deadline: formData.deadline || undefined,
                        priority: formData.priority,
                        estimation: formData.estimation || undefined,
                        dependencies: formData.dependencies,
                        recurring: formData.recurring
                    }
                    : t
            ));
        } else {
            const newTask: Task = {
                id: uuidv4(),
                title: formData.title,
                description: formData.description,
                status: 'idea',
                deadline: formData.deadline || undefined,
                priority: formData.priority,
                estimation: formData.estimation || undefined,
                subtasks: [],
                createdAt: Date.now(),
                dependencies: formData.dependencies,
                recurring: formData.recurring
            };
            updateTasksAndSave(prev => [...prev, newTask]);
        }

        setIsModalOpen(false);
    };

    const handleDeleteTask = (id: string) => {
        setTaskToDelete(id);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteTask = () => {
        if (taskToDelete) {
            updateTasksAndSave(prev => prev.filter(t => t.id !== taskToDelete));
        }
        setIsDeleteConfirmOpen(false);
        setTaskToDelete(null);
    };

    const handleToggleSubtask = (taskId: string, subtaskId: string) => {
        updateTasksAndSave(prev => prev.map(task => {
            if (task.id !== taskId) {
                return task;
            }
            return {
                ...task,
                subtasks: task.subtasks.map(sub =>
                    sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
                )
            };
        }));
    };

    const handleAddSubtaskPrompt = (taskId: string) => {
        setSubtaskTaskTarget(taskId);
        setSubtaskTitle('');
        setIsSubtaskPromptOpen(true);
    };

    const confirmAddSubtask = () => {
        if (subtaskTaskTarget && subtaskTitle.trim()) {
            updateTasksAndSave(prev => prev.map(task => {
                if (task.id !== subtaskTaskTarget) {
                    return task;
                }
                return {
                    ...task,
                    subtasks: [...task.subtasks, { id: uuidv4(), title: subtaskTitle.trim(), completed: false }]
                };
            }));
        }
        setIsSubtaskPromptOpen(false);
        setSubtaskTaskTarget(null);
        setSubtaskTitle('');
    };

    const filteredTasks = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) {
            return tasks;
        }
        return tasks.filter(t =>
            t.title.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query)
        );
    }, [tasks, searchQuery]);

    const activeTask = useMemo(() =>
        tasks.find(t => t.id === activeId),
        [tasks, activeId]);

    const stats = useMemo(() => {
        const total = tasks.length;
        const completedCount = tasks.filter(t => t.status === 'approved').length;
        const bugsCount = tasks.filter(t => t.status === 'bug').length;
        return { total, completed: completedCount, bugs: bugsCount };
    }, [tasks]);

    if (isSyncing) {
        return (
            <div className="flex h-full items-center justify-center p-12 text-muted-foreground/30">
                <IconClock className="w-5 h-5 animate-spin mr-3" />
                <span className="text-sm font-semibold uppercase ">{t('frontend.workspaceTodo.boardSync')}</span>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background/30 select-none">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-border/40 bg-background/5 backdrop-blur-md">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-primary/5 border border-primary/10 shadow-sm">
                            <IconChecklist className="w-5 h-5 text-primary/60" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-sm font-semibold text-foreground/80">
                                {viewMode === 'kanban' ? 'Task Board' : 'Task Calendar'}
                            </h2>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="typo-overline text-muted-foreground/40 font-medium uppercase ">{stats.total} Tasks</span>
                                <div className="w-1 h-1 rounded-full bg-border/40" />
                                <span className="typo-overline text-emerald-500/50 font-medium uppercase ">{stats.completed} Done</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-border/20 mx-1" />

                    {/* View Switcher */}
                    <div className="flex items-center p-1 bg-muted/20 rounded-xl border border-border/10">
                        <Button
                            variant="ghost"
                            onClick={() => setViewMode('kanban')}
                            className={cn(
                                "h-8 px-3 rounded-lg text-xs font-semibold transition-all",
                                viewMode === 'kanban' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground/50 hover:text-foreground"
                            )}
                        >
                            <IconLayoutKanban className="w-3.5 h-3.5 mr-2" />
                            Board
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setViewMode('calendar')}
                            className={cn(
                                "h-8 px-3 rounded-lg text-xs font-semibold transition-all",
                                viewMode === 'calendar' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground/50 hover:text-foreground"
                            )}
                        >
                            <IconCalendarMonth className="w-3.5 h-3.5 mr-2" />
                            Calendar
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setViewMode('insights')}
                            className={cn(
                                "h-8 px-3 rounded-lg text-xs font-semibold transition-all",
                                viewMode === 'insights' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground/50 hover:text-foreground"
                            )}
                        >
                            <IconChartBar className="w-3.5 h-3.5 mr-2" />
                            {t('frontend.workspaceTodo.insights')}
                        </Button>
                    </div>

                    {viewMode === 'calendar' && (
                        <div className="flex items-center gap-4 ml-2">
                            {/* Granularity Switcher */}
                            <div className="flex items-center p-1 bg-muted/20 rounded-xl border border-border/10">
                                {(['week', 'month', 'year'] as const).map(g => (
                                    <Button
                                        key={g}
                                        variant="ghost"
                                        onClick={() => setCalendarGranularity(g)}
                                        className={cn(
                                            "h-7 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                            calendarGranularity === g ? "bg-background shadow-sm text-foreground" : "text-muted-foreground/40 hover:text-foreground"
                                        )}
                                    >
                                        {g}
                                    </Button>
                                ))}
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        if (calendarGranularity === 'week') setCurrentDate(prev => subMonths(prev, 0.25)); // Rough week jump
                                        else if (calendarGranularity === 'month') setCurrentDate(prev => subMonths(prev, 1));
                                        else setCurrentDate(prev => subYears(prev, 1));
                                    }}
                                    className="h-8 w-8 rounded-full hover:bg-muted"
                                >
                                    <IconChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="text-sm font-bold min-w-100 text-center text-foreground/70">
                                    {calendarGranularity === 'year'
                                        ? format(currentDate, 'yyyy')
                                        : calendarGranularity === 'month'
                                            ? format(currentDate, 'MMMM yyyy')
                                            : `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`
                                    }
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        if (calendarGranularity === 'week') setCurrentDate(prev => addMonths(prev, 0.25)); // Rough week jump
                                        else if (calendarGranularity === 'month') setCurrentDate(prev => addMonths(prev, 1));
                                        else setCurrentDate(prev => addYears(prev, 1));
                                    }}
                                    className="h-8 w-8 rounded-full hover:bg-muted"
                                >
                                    <IconChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="h-6 w-px bg-border/20 mx-1" />

                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            onClick={handleSyncTodoMd}
                            disabled={isSyncing}
                            aria-label={t('frontend.workspaceTodo.syncTodo')}
                            className={cn(
                                "h-10 px-3 rounded-xl transition-all flex items-center gap-2 border border-border/10",
                                isSyncing ? "bg-primary/5 text-primary animate-pulse" : "text-muted-foreground/50 hover:text-primary hover:bg-primary/5"
                            )}
                            title={t('frontend.workspaceTodo.syncTodo')}
                        >
                            {isSyncing ? (
                                <IconRefresh className="w-4 h-4 animate-spin" />
                            ) : (
                                <IconAnalyze className="w-4 h-4" />
                            )}
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {isSyncing ? t('frontend.workspaceTodo.syncingTodo') : t('frontend.workspaceTodo.syncTodo')}
                            </span>
                        </Button>

                        <div className="relative group">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30 group-focus-within:text-primary/50 transition-colors" />
                            <Input
                                placeholder={t('frontend.workspaceTodo.filterBoardPlaceholder')}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="h-10 w-64 pl-10 bg-muted/10 border-border/10 focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl transition-all"
                            />
                        </div>
                    </div>
                </div>

                <Button
                    onClick={handleOpenCreateModal}
                    aria-label={t('frontend.workspaceTodo.createTask')}
                    className="h-9 px-6 rounded-xl bg-primary/80 text-primary-foreground text-sm font-semibold hover:bg-primary shadow-lg shadow-primary/10 transition-all active:scale-95"
                >
                    <IconPlus className="w-4 h-4 mr-2" />
                    {t('frontend.workspaceTodo.createTask')}
                </Button>
            </div>

            {/* Board Container */}
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <ScrollArea className="flex-1 w-full border-none">
                    {viewMode === 'kanban' ? (
                        <div className="flex h-full p-10 gap-10 min-w-max">
                            {CATEGORIES.map((category) => (
                                <TaskColumn
                                    key={category.id}
                                    category={category}
                                    tasks={filteredTasks.filter(t => t.status === category.id)}
                                    allTasks={tasks}
                                    onEdit={handleOpenEditModal}
                                    onDelete={handleDeleteTask}
                                    onToggleSubtask={handleToggleSubtask}
                                    onAddSubtask={handleAddSubtaskPrompt}
                                />
                            ))}
                        </div>
                    ) : viewMode === 'calendar' ? (
                        <div className="flex h-full min-h-0">
                            {calendarGranularity === 'month' ? (
                                <CalendarView
                                    currentDate={currentDate}
                                    tasks={filteredTasks}
                                    onAddTask={(date) => {
                                        handleOpenCreateModal();
                                        setFormData(prev => ({ ...prev, deadline: date }));
                                    }}
                                    onEdit={handleOpenEditModal}
                                    onDelete={handleDeleteTask}
                                    onToggleSubtask={handleToggleSubtask}
                                    onAddSubtask={handleAddSubtaskPrompt}
                                />
                            ) : calendarGranularity === 'year' ? (
                                <YearView
                                    currentDate={currentDate}
                                    tasks={filteredTasks}
                                    onEdit={handleOpenEditModal}
                                    onAddTask={(date) => {
                                        handleOpenCreateModal();
                                        setFormData(prev => ({ ...prev, deadline: date }));
                                    }}
                                />
                            ) : (
                                <WeekView
                                    currentDate={currentDate}
                                    tasks={filteredTasks}
                                    allTasks={tasks}
                                    onEdit={handleOpenEditModal}
                                    onAddTask={(date) => {
                                        handleOpenCreateModal();
                                        setFormData(prev => ({ ...prev, deadline: date }));
                                    }}
                                    onDelete={handleDeleteTask}
                                    onToggleSubtask={handleToggleSubtask}
                                    onAddSubtask={handleAddSubtaskPrompt}
                                />
                            )}
                            {/* Calendar Backlog Sidebar */}
                            <CalendarBacklog
                                tasks={filteredTasks.filter(t => !t.deadline)}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteTask}
                                onToggleSubtask={handleToggleSubtask}
                                onAddSubtask={handleAddSubtaskPrompt}
                            />
                        </div>
                    ) : (
                        <WorkspaceTodoAnalytics tasks={tasks} />
                    )}
                </ScrollArea>

                <DragOverlay>
                    {activeTask ? (
                        <TaskCard
                            task={activeTask}
                            allTasks={tasks}
                            isOverlay
                            onEdit={() => { }}
                            onDelete={() => { }}
                            onToggleSubtask={() => { }}
                            onAddSubtask={() => { }}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Simple Modal with Priority Dropdown */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-md border-border/40 backdrop-blur-xl bg-background/80 shadow-2xl p-0 overflow-hidden">
                    <div className="p-7">
                        <DialogHeader className="mb-6">
                            <DialogTitle className="text-lg font-semibold text-foreground/80">
                                {editingTask ? 'Edit Task' : 'Create New Task'}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground/50">
                                Enter the basic details to finalize your task.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5">
                            <div className="grid gap-2">
                                <Label htmlFor="title" className="text-sm font-medium text-muted-foreground/70">Task Title</Label>
                                <Input
                                    id="title"
                                    placeholder={t('frontend.workspaceTodo.taskOverviewPlaceholder')}
                                    value={formData.title}
                                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    className="h-10 border-border/20 bg-background/40 focus-visible:ring-1 focus-visible:ring-primary/20 text-sm"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="desc" className="text-sm font-medium text-muted-foreground/70">Description</Label>
                                <Textarea
                                    id="desc"
                                    placeholder={t('frontend.workspaceTodo.taskContextPlaceholder')}
                                    value={formData.description}
                                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="min-h-32 border-border/20 bg-background/40 focus-visible:ring-1 focus-visible:ring-primary/20 resize-none typo-overline leading-relaxed"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium text-muted-foreground/70">Priority</Label>
                                    <Select
                                        value={formData.priority}
                                        onValueChange={(val: TaskPriority) => setFormData(prev => ({ ...prev, priority: val }))}
                                    >
                                        <SelectTrigger className="h-10 border-border/20 bg-background/40 focus:ring-primary/20 text-sm">
                                            <SelectValue placeholder={t('frontend.workspaceTodo.selectPriority')} />
                                        </SelectTrigger>
                                        <SelectContent className="border-border/40 backdrop-blur-xl bg-background/95">
                                            <SelectItem value="low" className="text-sm">Low</SelectItem>
                                            <SelectItem value="medium" className="text-sm">Medium</SelectItem>
                                            <SelectItem value="high" className="text-sm">High</SelectItem>
                                            <SelectItem value="urgent" className="text-sm text-rose-500 font-medium">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium text-muted-foreground/70">Estimate</Label>
                                    <Input
                                        placeholder="e.g. 2h, 5"
                                        value={formData.estimation}
                                        onChange={e => setFormData(prev => ({ ...prev, estimation: e.target.value }))}
                                        className="h-10 border-border/20 bg-background/40 focus-visible:ring-1 focus-visible:ring-primary/20 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium text-muted-foreground/70">Deadline</Label>
                                    <Input
                                        id="deadline"
                                        type="date"
                                        value={formData.deadline}
                                        onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                                        className="h-10 border-border/20 bg-background/40 focus-visible:ring-1 focus-visible:ring-primary/20 text-sm"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium text-muted-foreground/70">Recurrence</Label>
                                    <Select
                                        value={formData.recurring}
                                        onValueChange={(val: string) => setFormData(prev => ({ ...prev, recurring: val as Task['recurring'] }))}
                                    >
                                        <SelectTrigger className="h-10 border-border/20 bg-background/40 focus:ring-primary/20 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="border-border/40 backdrop-blur-xl bg-background/95">
                                            <SelectItem value="none">None</SelectItem>
                                            <SelectItem value="daily">Daily</SelectItem>
                                            <SelectItem value="weekly">Weekly</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-sm font-medium text-muted-foreground/70">Blocks (Dependencies)</Label>
                                <Select
                                    value={formData.dependencies[0] || ""}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, dependencies: val ? [val] : [] }))}
                                >
                                    <SelectTrigger className="h-10 border-border/20 bg-background/40 focus:ring-primary/20 text-sm">
                                        <SelectValue placeholder="Select a blocking task..." />
                                    </SelectTrigger>
                                    <SelectContent className="border-border/40 backdrop-blur-xl bg-background/95">
                                        <SelectItem value="none_dep">None</SelectItem>
                                        {tasks.filter(t => t.id !== editingTask?.id).map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="px-7 py-4 border-t border-border/10 bg-muted/5 flex justify-end gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setIsModalOpen(false)}
                            className="text-sm text-muted-foreground/50 hover:bg-transparent"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveTask}
                            disabled={!formData.title.trim()}
                            className="h-10 px-8 bg-primary/80 text-primary-foreground text-sm font-semibold hover:bg-primary shadow-lg shadow-primary/10 transition-all rounded-lg"
                        >
                            {editingTask ? 'Apply Changes' : 'Create Task'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteTask}
                title="Delete Task"
                message="Are you sure you want to delete this task? This action cannot be undone."
                variant="danger"
            />

            <Dialog open={isSubtaskPromptOpen} onOpenChange={setIsSubtaskPromptOpen}>
                <DialogContent className="sm:max-w-400 border-border/40 backdrop-blur-xl bg-background/80 shadow-2xl p-0 overflow-hidden">
                    <div className="p-7">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-lg font-semibold text-foreground/80">
                                Add Subtask
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground/50">
                                Enter a title for the new subtask.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="subtaskTitle" className="text-sm font-medium text-muted-foreground/70">Subtask Title</Label>
                                <Input
                                    id="subtaskTitle"
                                    autoFocus
                                    value={subtaskTitle}
                                    onChange={e => setSubtaskTitle(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            confirmAddSubtask();
                                        }
                                    }}
                                    className="h-10 border-border/20 bg-background/40 focus-visible:ring-1 focus-visible:ring-primary/20 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="px-7 py-4 border-t border-border/10 bg-muted/5 flex justify-end gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setIsSubtaskPromptOpen(false)}
                            className="text-sm text-muted-foreground/50 hover:bg-transparent"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmAddSubtask}
                            disabled={!subtaskTitle.trim()}
                            className="h-10 px-8 bg-primary/80 text-primary-foreground text-sm font-semibold hover:bg-primary shadow-lg shadow-primary/10 transition-all rounded-lg"
                        >
                            Add
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default WorkspaceTodoTab;

