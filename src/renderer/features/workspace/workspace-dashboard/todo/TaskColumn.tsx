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
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { TaskCard } from './TaskCard';
import { CATEGORIES,Task } from './types';

export const TaskColumn = ({
    category,
    tasks,
    onEdit,
    onDelete,
    onToggleSubtask,
    onAddSubtask,
    customDroppableId
}: {
    category: typeof CATEGORIES[0];
    tasks: Task[];
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
