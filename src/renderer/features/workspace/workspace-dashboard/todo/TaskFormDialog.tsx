/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { CATEGORIES, PRIORITY_CONFIG, Task, TaskPriority, TaskStatus } from './types';

interface TaskFormDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editingTask: Task | null;
    taskTitle: string;
    setTaskTitle: (val: string) => void;
    taskDescription: string;
    setTaskDescription: (val: string) => void;
    taskStatus: TaskStatus;
    setTaskStatus: (val: TaskStatus) => void;
    taskPriority: TaskPriority;
    setTaskPriority: (val: TaskPriority) => void;
    taskDeadline: string;
    setTaskDeadline: (val: string) => void;
    taskEstimation: string;
    setTaskEstimation: (val: string) => void;
    handleSaveTask: () => void;
    t: (key: string) => string;
}

export const TaskFormDialog: React.FC<TaskFormDialogProps> = ({
    isOpen,
    onOpenChange,
    editingTask,
    taskTitle,
    setTaskTitle,
    taskDescription,
    setTaskDescription,
    taskStatus,
    setTaskStatus,
    taskPriority,
    setTaskPriority,
    taskDeadline,
    setTaskDeadline,
    taskEstimation,
    setTaskEstimation,
    handleSaveTask,
    t
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl border-border/40 bg-background/80 backdrop-blur-3xl rounded-3xl p-8">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold tracking-tight">
                        {editingTask ? t('frontend.workspaceTodo.editTask') : t('frontend.workspaceTodo.createNewTask')}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground/60">
                        {editingTask ? t('frontend.workspaceTodo.editTaskDesc') : t('frontend.workspaceTodo.createTaskDesc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-8 py-6">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('frontend.workspaceTodo.title')}</Label>
                            <Input
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                placeholder={t('frontend.workspaceTodo.placeholders.title')}
                                className="bg-muted/20 border-transparent focus:bg-background rounded-xl h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('frontend.workspaceTodo.description')}</Label>
                            <Textarea
                                value={taskDescription}
                                onChange={(e) => setTaskDescription(e.target.value)}
                                placeholder={t('frontend.workspaceTodo.placeholders.description')}
                                className="bg-muted/20 border-transparent focus:bg-background rounded-2xl min-h-32 resize-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('frontend.workspaceTodo.status')}</Label>
                                <Select value={taskStatus} onValueChange={(v: TaskStatus) => setTaskStatus(v)}>
                                    <SelectTrigger className="bg-muted/20 border-transparent focus:bg-background rounded-xl h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="backdrop-blur-3xl border-border/40">
                                        {CATEGORIES.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                <div className="flex items-center gap-2">
                                                    <cat.icon className={cn("w-4 h-4", cat.color)} />
                                                    {t(`frontend.workspaceTodo.${cat.labelKey}`)}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('frontend.workspaceTodo.priority')}</Label>
                                <Select value={taskPriority} onValueChange={(v: TaskPriority) => setTaskPriority(v)}>
                                    <SelectTrigger className="bg-muted/20 border-transparent focus:bg-background rounded-xl h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="backdrop-blur-3xl border-border/40">
                                        {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                                            <SelectItem key={key} value={key}>
                                                <div className="flex items-center gap-2">
                                                    <config.icon className={cn("w-4 h-4", config.color)} />
                                                    {t(`frontend.workspaceTodo.${config.labelKey}`)}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('frontend.workspaceTodo.deadline')}</Label>
                            <Input
                                type="date"
                                value={taskDeadline}
                                onChange={(e) => setTaskDeadline(e.target.value)}
                                className="bg-muted/20 border-transparent focus:bg-background rounded-xl h-10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('frontend.workspaceTodo.estimation')}</Label>
                            <Input
                                value={taskEstimation}
                                onChange={(e) => setTaskEstimation(e.target.value)}
                                placeholder="e.g. 2 hours"
                                className="bg-muted/20 border-transparent focus:bg-background rounded-xl h-10"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border/10">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl px-6">
                        {t('frontend.workspaceTodo.cancel')}
                    </Button>
                    <Button onClick={() => { void handleSaveTask(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 rounded-xl shadow-lg shadow-primary/20">
                        {editingTask ? t('frontend.workspaceTodo.saveChanges') : t('frontend.workspaceTodo.createTask')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
