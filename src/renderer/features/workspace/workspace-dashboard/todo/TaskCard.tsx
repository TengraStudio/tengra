/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useDraggable } from '@dnd-kit/core';
import { 
    IconBolt, 
    IconCalendar as CalendarIcon,
    IconDots, 
    IconEdit, 
    IconHash, 
    IconLink, 
    IconListCheck, 
    IconRepeat, 
    IconSquareCheck, 
    IconTrash} from '@tabler/icons-react';
import { format } from 'date-fns';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { PRIORITY_CONFIG,Task } from './types';

export const TaskCard = ({
    task,
    isOverlay = false,
    onEdit,
    onDelete,
    onToggleSubtask,
    onAddSubtask
}: {
    task: Task;
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
    const isBlocked = Boolean(task.dependencies && task.dependencies.length > 0);

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

export const CompactTaskCard = ({
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
