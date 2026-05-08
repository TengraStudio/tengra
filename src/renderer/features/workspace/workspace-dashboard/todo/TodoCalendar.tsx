/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useDroppable } from '@dnd-kit/core';
import {
    IconPlus
} from '@tabler/icons-react';
import {
    eachDayOfInterval,
    eachMonthOfInterval,
    endOfMonth,
    endOfWeek,
    endOfYear,
    format,
    isSameMonth,
    isToday,
    parseISO,
    startOfMonth,
    startOfWeek,
    startOfYear
} from 'date-fns';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CompactTaskCard, TaskCard } from './TaskCard';
import { Task } from './types';

export const CalendarDay = ({
    day,
    isCurrentMonth,
    tasks,
    onAddTask,
    onEdit
}: {
    day: Date;
    isCurrentMonth: boolean;
    tasks: Task[];
    onAddTask: (date: string) => void;
    onEdit: (task: Task) => void;
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

export const CalendarBacklog = ({
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

export const YearMonthCell = ({
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

export const YearView = ({
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

export const WeekView = ({
    currentDate,
    tasks,
    onEdit
}: {
    currentDate: Date;
    tasks: Task[];
    onEdit: (task: Task) => void;
}) => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(weekStart);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background/5 rounded-3xl border border-border/20 mx-10 mb-10 shadow-2xl backdrop-blur-xl">
            <div className="flex-1 grid grid-cols-7 h-full">
                {days.map(day => {
                    const dayTasks = tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day));
                    const isTodayDate = isToday(day);
                    return (
                        <div key={day.toString()} className={cn(
                            "flex flex-col border-r border-border/10 p-4 min-h-0",
                            isTodayDate && "bg-primary/2"
                        )}>
                            <div className="flex flex-col gap-1 mb-6">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">{format(day, 'EEE')}</span>
                                <span className={cn(
                                    "text-lg font-bold tracking-tight",
                                    isTodayDate ? "text-primary" : "text-muted-foreground/60"
                                )}>{format(day, 'd')}</span>
                            </div>
                            <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                                {dayTasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onEdit={onEdit}
                                        onDelete={() => { }} // Not needed in week view context usually or handle properly
                                        onToggleSubtask={() => { }}
                                        onAddSubtask={() => { }}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const TodoCalendar = ({
    currentDate,
    tasks,
    onEditTask
}: {
    currentDate: Date;
    tasks: Task[];
    onEditTask: (task: Task) => void;
    t: (key: string) => string;
}) => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
        <div className="flex h-full overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden bg-background/5 rounded-3xl border border-border/20 mx-10 mb-10 shadow-2xl backdrop-blur-xl">
                <div className="grid grid-cols-7 border-b border-border/20 bg-muted/10">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="py-3 text-[10px] font-bold uppercase tracking-widest text-center text-muted-foreground/40">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-y-auto">
                    {calendarDays.map(day => {
                        const dayTasks = tasks.filter(t => t.deadline && format(parseISO(t.deadline), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
                        return (
                            <CalendarDay
                                key={day.toString()}
                                day={day}
                                isCurrentMonth={isSameMonth(day, monthStart)}
                                tasks={dayTasks}
                                onAddTask={() => { }} // Handle appropriately if needed
                                onEdit={onEditTask}
                            />
                        );
                    })}
                </div>
            </div>
            <CalendarBacklog
                tasks={tasks.filter(t => !t.deadline)}
                onEdit={onEditTask}
                onDelete={() => { }}
                onToggleSubtask={() => { }}
                onAddSubtask={() => { }}
            />
        </div>
    );
};

function isSameDay(dateLeft: Date, dateRight: Date): boolean {
    return format(dateLeft, 'yyyy-MM-dd') === format(dateRight, 'yyyy-MM-dd');
}
