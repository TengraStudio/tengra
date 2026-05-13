/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { JsonValue } from '@shared/types/common';
import { IconCalendarMonth } from '@tabler/icons-react';
import {
    addDays,
    format,
    parseISO,
    startOfWeek,
} from 'date-fns';
import React, { useCallback, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Badge } from '@/components/ui/badge';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { fetchModels, getSelectableProviderId } from '@/features/models/utils/model-fetcher';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { pushNotification } from '@/store/notification-center.store';
import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { PromptModal } from './todo/PromptModal';
import { TaskCard } from './todo/TaskCard';
import { TaskColumn } from './todo/TaskColumn';
import { TaskFormDialog } from './todo/TaskFormDialog';
import { TodoAnalytics } from './todo/TodoAnalytics';
import { TodoCalendar } from './todo/TodoCalendar';
import { TodoHeader } from './todo/TodoHeader';
import { CATEGORIES, PRIORITY_CONFIG, Task, TaskPriority, TaskStatus } from './todo/types';

interface AITaskOutput {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    subtasks: string[];
}

interface WorkspaceTodoTabProps {
    workspace: Workspace;
    onUpdate?: (updates: Partial<Workspace>) => Promise<void>;
    t?: (key: string) => string;
}

export const WorkspaceTodoTab: React.FC<WorkspaceTodoTabProps> = ({ workspace, onUpdate, t: _t }) => {
    const { t } = useTranslation();
    const [view, setView] = useState<'kanban' | 'calendar' | 'week' | 'year' | 'analytics'>('kanban');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isDeletingTask, setIsDeletingTask] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

    // Form state
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskStatus, setTaskStatus] = useState<TaskStatus>('idea');
    const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
    const [taskDeadline, setTaskDeadline] = useState('');
    const [taskEstimation, setTaskEstimation] = useState('');


    const tasks = useMemo(() => {
        try {
            const todos = workspace.metadata?.todos;
            return (Array.isArray(todos) ? todos as unknown as Task[] : []) || [];
        } catch (e) {
            appLogger.error('Failed to parse workspace todos', String(e));
            return [];
        }
    }, [workspace.metadata]);

    const filteredTasks = useMemo(() => {
        if (!searchQuery.trim()) { return tasks; }
        const query = searchQuery.toLowerCase();
        return tasks.filter(task =>
            task.title.toLowerCase().includes(query) ||
            task.description.toLowerCase().includes(query) ||
            task.subtasks.some(s => s.title.toLowerCase().includes(query))
        );
    }, [tasks, searchQuery]);

    const updateTasks = useCallback(async (newTasks: Task[]) => {
        if (!onUpdate) { return; }
        await onUpdate({
            metadata: {
                ...workspace.metadata,
                todos: newTasks as unknown as JsonValue
            }
        });
    }, [onUpdate, workspace.metadata]);

    const handleAddTask = (initialDate?: string) => {
        setTaskTitle('');
        setTaskDescription('');
        setTaskStatus('idea');
        setTaskPriority('medium');
        setTaskDeadline(initialDate || '');
        setTaskEstimation('');
        setEditingTask(null);
        setIsAddingTask(true);
    };

    const handleEditTask = (task: Task) => {
        setEditingTask(task);
        setTaskTitle(task.title);
        setTaskDescription(task.description);
        setTaskStatus(task.status);
        setTaskPriority(task.priority);
        setTaskDeadline(task.deadline || '');
        setTaskEstimation(task.estimation || '');
        setIsAddingTask(true);
    };

    const handleDeleteTask = async (id: string) => {
        const newTasks = tasks.filter(t => t.id !== id);
        await updateTasks(newTasks);
        setIsDeletingTask(null);
    };

    const handleSaveTask = async () => {
        if (!taskTitle.trim()) { return; }

        if (editingTask) {
            const newTasks = tasks.map(t =>
                t.id === editingTask.id
                    ? {
                        ...t,
                        title: taskTitle,
                        description: taskDescription,
                        status: taskStatus,
                        priority: taskPriority,
                        deadline: taskDeadline || undefined,
                        estimation: taskEstimation || undefined,
                    }
                    : t
            );
            await updateTasks(newTasks);
        } else {
            const newTask: Task = {
                id: uuidv4(),
                title: taskTitle,
                description: taskDescription,
                status: taskStatus,
                priority: taskPriority,
                deadline: taskDeadline || undefined,
                estimation: taskEstimation || undefined,
                subtasks: [],
                createdAt: Date.now(),
            };
            await updateTasks([newTask, ...tasks]);
        }

        setIsAddingTask(false);
        setEditingTask(null);
    };

    const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
        const newTasks = tasks.map(t => {
            if (t.id === taskId) {
                return {
                    ...t,
                    subtasks: t.subtasks.map(s =>
                        s.id === subtaskId ? { ...s, completed: !s.completed } : s
                    )
                };
            }
            return t;
        });
        await updateTasks(newTasks);
    };

    const handleAddSubtask = (taskId: string) => {
        setActiveTaskId(taskId);
        setIsSubtaskModalOpen(true);
    };

    const confirmAddSubtask = async (title: string) => {
        if (!activeTaskId || !title.trim()) { return; }

        const newTasks = tasks.map(t => {
            if (t.id === activeTaskId) {
                return {
                    ...t,
                    subtasks: [...t.subtasks, { id: uuidv4(), title, completed: false }]
                };
            }
            return t;
        });
        await updateTasks(newTasks);
        setActiveTaskId(null);
    };


    const handleAIAnalyze = async () => {
        if (!aiPrompt.trim()) { return; }
        setIsAnalyzing(true);

        try {
            const models = await fetchModels(); 
            const providerId = models
                .map(model => getSelectableProviderId(model))
                .find(Boolean) ?? '';   

            if (!providerId) {
                pushNotification({
                    type: 'error',
                    title: 'No AI Provider',
                    message: 'Please configure an AI provider in settings.'
                });
                return;
            }

            const prompt = `Based on this request: "${aiPrompt}", generate a structured task for a developer todo list.
            Return ONLY a JSON object with this structure:
            {
                "title": "Short title",
                "description": "Detailed description",
                "status": "idea" | "upcoming" | "in_progress" | "approved" | "bug",
                "priority": "low" | "medium" | "high" | "urgent",
                "subtasks": ["subtask 1", "subtask 2"]
            }`;

            const response = await window.electron.llama.chat(prompt);

            if (response.success && response.response) {
                const cleanedJson = response.response.replace(/```json|```/g, '').trim();
                const output = JSON.parse(cleanedJson) as AITaskOutput;

                const newTask: Task = {
                    id: uuidv4(),
                    title: output.title,
                    description: output.description,
                    status: output.status || 'idea',
                    priority: output.priority || 'medium',
                    subtasks: output.subtasks.map(s => ({ id: uuidv4(), title: s, completed: false })),
                    createdAt: Date.now(),
                };

                await updateTasks([newTask, ...tasks]);
                setAiPrompt('');
                pushNotification({
                    type: 'success',
                    title: 'Task Generated',
                    message: `AI has generated: ${output.title}`
                });
            }
        } catch (e) {
            appLogger.error('AI Task Generation failed', String(e));
            pushNotification({
                type: 'error',
                title: 'Generation Failed',
                message: 'Failed to generate task with AI. Check your connection or provider settings.'
            });
        } finally {
            setIsAnalyzing(false);
        }
    };


    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            <TodoHeader
                view={view}
                setView={setView}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleAddTask={() => { void handleAddTask(); }}
                t={t}
            /> 

            <div className="flex-1 overflow-hidden relative">
                {view === 'kanban' && (
                    <div className="h-full overflow-x-auto p-8 CustomScrollbar">
                        <div className="flex h-full gap-8 min-w-fit">
                            {CATEGORIES.map(category => (
                                <TaskColumn
                                    key={category.id}
                                    category={category}
                                    tasks={filteredTasks.filter(t => t.status === category.id)}
                                    onEdit={handleEditTask}
                                    onDelete={setIsDeletingTask}
                                    onToggleSubtask={(taskId, subtaskId) => { void handleToggleSubtask(taskId, subtaskId); }}
                                    onAddSubtask={(taskId) => { void handleAddSubtask(taskId); }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {view === 'calendar' && (
                    <div className="h-full p-8 overflow-y-auto CustomScrollbar">
                        <TodoCalendar
                            currentDate={currentDate}
                            tasks={filteredTasks}
                            onEditTask={handleEditTask}
                            t={t}
                        />
                    </div>
                )}

                {view === 'week' && (
                    <div className="h-full p-8 overflow-y-auto CustomScrollbar">
                        <div className="max-w-7xl mx-auto space-y-12">
                            {Array.from({ length: 7 }).map((_, i) => {
                                const date = addDays(startOfWeek(currentDate), i);
                                const dayTasks = filteredTasks.filter(task => {
                                    if (!task.deadline) { return false; }
                                    const deadline = parseISO(task.deadline);
                                    return format(deadline, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
                                });

                                return (
                                    <div key={i} className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-muted/20 border border-border/10">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground/40">{format(date, 'EEE')}</span>
                                                <span className="text-xl font-bold">{format(date, 'd')}</span>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold uppercase tracking-wider">{format(date, 'EEEE, MMMM do')}</h3>
                                                <p className="text-xs text-muted-foreground/60">{dayTasks.length} {t('frontend.workspaceTodo.tasksScheduled')}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {dayTasks.map(task => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    onEdit={handleEditTask}
                                                    onDelete={(id) => { void handleDeleteTask(id); }}
                                                    onAddSubtask={handleAddSubtask}
                                                    onToggleSubtask={(tid, sid) => { void handleToggleSubtask(tid, sid); }}
                                                />
                                            ))}
                                            {dayTasks.length === 0 && (
                                                <div className="col-span-full py-8 flex items-center justify-center rounded-3xl border border-dashed border-border/10 text-muted-foreground/20 uppercase font-bold text-[10px] tracking-widest">
                                                    {t('frontend.workspaceTodo.noTasksForThisDay')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {view === 'year' && (
                    <div className="h-full p-8 overflow-y-auto CustomScrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 max-w-[1600px] mx-auto">
                            {Array.from({ length: 12 }).map((_, i) => {
                                const monthDate = new Date(currentDate.getFullYear(), i, 1);
                                const monthTasks = filteredTasks.filter(task => {
                                    if (!task.deadline) { return false; }
                                    const deadline = parseISO(task.deadline);
                                    return deadline.getMonth() === i && deadline.getFullYear() === currentDate.getFullYear();
                                });

                                return (
                                    <div key={i} className="flex flex-col gap-4 p-6 rounded-3xl bg-muted/5 border border-border/10 hover:bg-muted/10 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold uppercase tracking-widest text-primary">{format(monthDate, 'MMMM')}</h3>
                                            <Badge variant="secondary" className="rounded-lg font-mono text-[10px] px-2">{monthTasks.length}</Badge>
                                        </div>
                                        <div className="flex-1 min-h-32 flex flex-col gap-2">
                                            {monthTasks.slice(0, 3).map(task => (
                                                <div key={task.id} className="flex items-center gap-2 group cursor-pointer" onClick={() => handleEditTask(task)}>
                                                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_CONFIG[task.priority].color.replace('text-', 'bg-'))} />
                                                    <span className="text-[10px] font-bold truncate group-hover:text-primary transition-colors">{task.title}</span>
                                                </div>
                                            ))}
                                            {monthTasks.length > 3 && (
                                                <span className="text-[9px] font-black uppercase text-muted-foreground/30 pl-3.5">+{monthTasks.length - 3} more tasks</span>
                                            )}
                                            {monthTasks.length === 0 && (
                                                <div className="flex-1 flex items-center justify-center grayscale opacity-10">
                                                    <IconCalendarMonth className="w-8 h-8" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {view === 'analytics' && (
                    <div className="h-full p-8 overflow-y-auto CustomScrollbar">
                        <TodoAnalytics tasks={tasks} />
                    </div>
                )}
            </div>

            <TaskFormDialog
                isOpen={isAddingTask}
                onOpenChange={setIsAddingTask}
                editingTask={editingTask}
                taskTitle={taskTitle}
                setTaskTitle={setTaskTitle}
                taskDescription={taskDescription}
                setTaskDescription={setTaskDescription}
                taskStatus={taskStatus}
                setTaskStatus={setTaskStatus}
                taskPriority={taskPriority}
                setTaskPriority={setTaskPriority}
                taskDeadline={taskDeadline}
                setTaskDeadline={setTaskDeadline}
                taskEstimation={taskEstimation}
                setTaskEstimation={setTaskEstimation}
                handleSaveTask={() => { void handleSaveTask(); }}
                t={t}
            />

            <ConfirmationModal
                isOpen={!!isDeletingTask}
                onClose={() => setIsDeletingTask(null)}
                onConfirm={() => { if (isDeletingTask) { void handleDeleteTask(isDeletingTask); } }}
                title={t('frontend.workspaceTodo.deleteTask')}
                message={t('frontend.workspaceTodo.deleteTaskConfirm')}
                confirmLabel={t('frontend.workspaceTodo.delete')}
                variant="danger"
            />

            <PromptModal
                key={activeTaskId || 'none'}
                isOpen={isSubtaskModalOpen}
                onClose={() => setIsSubtaskModalOpen(false)}
                onConfirm={(val) => { void confirmAddSubtask(val); }}
                title={t('frontend.workspaceTodo.newSubtask')}
                message={t('frontend.workspaceTodo.enterSubtaskTitle')}
                placeholder={t('frontend.workspaceTodo.subtaskPlaceholder')}
            />
        </div>
    );
};
