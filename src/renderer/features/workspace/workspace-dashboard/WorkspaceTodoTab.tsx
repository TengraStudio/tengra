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
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Card } from '@renderer/components/ui/card';
import { Checkbox } from '@renderer/components/ui/checkbox';
import {
    ConfirmationModal
} from '@renderer/components/ui/ConfirmationModal';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@renderer/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Textarea } from '@renderer/components/ui/textarea';
import { cn } from '@renderer/lib/utils';
import { JsonValue } from '@shared/types/common';
import { format } from 'date-fns';
import {
    AlertCircle,
    Calendar as CalendarIcon,
    CheckCircle2,
    CheckSquare,
    Circle,
    Clock,
    Edit3,
    Flag,
    Hash,
    Lightbulb,
    ListTodo,
    MoreHorizontal,
    Plus,
    Search,
    Trash2,
    Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useTranslation } from '@/i18n';
import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

// Types
type TaskStatus = 'idea' | 'in_progress' | 'approved' | 'upcoming' | 'bug';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface SubTask {
    id: string;
    title: string;
    completed: boolean;
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
}

interface WorkspaceTodoTabProps {
    workspace: Workspace;
    onUpdate?: (updates: Partial<Workspace>) => Promise<void>;
    t?: (key: string) => string;
}

const CATEGORIES: { id: TaskStatus; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'idea', label: 'Ideas / Tasks', icon: Lightbulb, color: 'text-amber-500' },
    { id: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-500' },
    { id: 'approved', label: 'Approved', icon: CheckCircle2, color: 'text-emerald-500' },
    { id: 'upcoming', label: 'Upcoming', icon: Circle, color: 'text-slate-500' },
    { id: 'bug', label: 'Errors & Bugs', icon: AlertCircle, color: 'text-rose-500' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { icon: React.ElementType; color: string; label: string }> = {
    low: { icon: Flag, color: 'text-slate-400', label: 'Low' },
    medium: { icon: Flag, color: 'text-blue-400', label: 'Medium' },
    high: { icon: Flag, color: 'text-amber-400', label: 'High' },
    urgent: { icon: AlertCircle, color: 'text-rose-500', label: 'Urgent' },
};

// Draggable Task Card Component
const TaskCard = ({ 
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
                            <span className={cn("text-10 font-medium uppercase tracking-tight", priority.color)}>
                                {priority.label}
                            </span>
                            {task.estimation && (
                                <Badge variant="outline" className="h-4 px-1.5 text-9 border-border/10 bg-muted/20 text-muted-foreground/60 rounded-sm font-medium">
                                    <Zap className="w-2.5 h-2.5 mr-1 text-primary/40" />
                                    {task.estimation}
                                </Badge>
                            )}
                        </div>
                        <h4 className="text-sm font-medium text-foreground leading-tight tracking-tight pr-4 break-words">
                            {task.title}
                        </h4>
                    </div>
                    <div onPointerDown={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-muted">
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 border-border/40 backdrop-blur-xl">
                                <DropdownMenuItem onClick={() => onEdit(task)} className="text-xs py-2">
                                    <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAddSubtask(task.id)} className="text-xs py-2">
                                    <ListTodo className="mr-2 h-3.5 w-3.5" /> Add Subtask
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-xs py-2 text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Task
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {task.description && (
                    <p className="text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed">
                        {task.description}
                    </p>
                )}

                {task.subtasks.length > 0 && (
                    <div className="space-y-2 py-1">
                        <div className="flex items-center justify-between text-10 text-muted-foreground/40 font-medium">
                            <span className="flex items-center gap-1.5">
                                <CheckSquare className="w-3 h-3" />
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
                                        "text-xs transition-colors cursor-default",
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
                    {task.deadline ? (
                        <div className="flex items-center gap-1.5 text-10 text-muted-foreground/40 font-medium">
                            <CalendarIcon className="w-3 h-3 text-muted-foreground/20" />
                            {format(new Date(task.deadline), 'MMM d, yyyy')}
                        </div>
                    ) : <div />}
                    
                    <div className="flex items-center gap-1 text-9 text-muted-foreground/20 font-medium opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pl-2">
                        <Hash className="w-2.5 h-2.5" />
                        {task.id.slice(0, 4)}
                    </div>
                </div>
            </div>
        </Card>
    );
};

// Droppable Column Component
const TaskColumn = ({ 
    category, 
    tasks,
    onEdit,
    onDelete,
    onToggleSubtask,
    onAddSubtask
}: { 
    category: typeof CATEGORIES[0]; 
    tasks: Task[];
    onEdit: (task: Task) => void;
    onDelete: (id: string) => void;
    onToggleSubtask: (taskId: string, subtaskId: string) => void;
    onAddSubtask: (taskId: string) => void;
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: category.id,
    });

    return (
        <div className="flex flex-col w-80 shrink-0">
            <div className="flex items-center gap-2.5 mb-5 px-1.5">
                <category.icon className={cn("w-4 h-4", category.color)} />
                <h3 className="text-sm font-semibold text-foreground/80 tracking-tight pt-0.5">
                    {category.label}
                </h3>
                <Badge variant="secondary" className="ml-auto bg-muted/40 text-muted-foreground/50 border-none font-medium text-10 px-2 h-5 rounded-md">
                    {tasks.length}
                </Badge>
            </div>

            <div 
                ref={setNodeRef}
                className={cn(
                    "flex-1 p-2.5 rounded-2xl transition-all min-h-400",
                    isOver ? "bg-primary/5 ring-1 ring-inset ring-primary/10 shadow-lg" : "bg-muted/5 border border-dashed border-border/10"
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
                
                {tasks.length === 0 && !isOver && (
                    <div className="h-full flex flex-col items-center justify-center py-24 grayscale opacity-20 transition-opacity hover:opacity-30">
                        <category.icon className="w-12 h-12 mb-4" />
                        <span className="text-11 font-medium tracking-200 uppercase">Empty</span>
                    </div>
                )}
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
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [loading] = useState(false);
    
    // Custom modal states
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
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        deadline: '',
        priority: 'medium' as TaskPriority,
        estimation: ''
    });

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
            const next = updater(prev);
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
        const newStatus = over.id as TaskStatus;

        if (CATEGORIES.some(cat => cat.id === newStatus)) {
            updateTasksAndSave(prev => prev.map(task => 
                task.id === taskId ? { ...task, status: newStatus } : task
            ));
        }
    };

    const handleOpenCreateModal = () => {
        setEditingTask(null);
        setFormData({ title: '', description: '', deadline: '', priority: 'medium', estimation: '' });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (task: Task) => {
        setEditingTask(task);
        setFormData({
            title: task.title,
            description: task.description,
            deadline: task.deadline || '',
            priority: task.priority || 'medium',
            estimation: task.estimation || ''
        });
        setIsModalOpen(true);
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
                        estimation: formData.estimation || undefined
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

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-12 text-muted-foreground/30">
                <Clock className="w-5 h-5 animate-spin mr-3" />
                <span className="text-xs font-semibold tracking-wider uppercase tracking-widest">Board Sync...</span>
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
                            <CheckSquare className="w-5 h-5 text-primary/60" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-sm font-semibold tracking-tight text-foreground/80">Project Workspace</h2>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-10 text-muted-foreground/40 font-medium uppercase tracking-widest">{stats.total} Tasks</span>
                                <div className="w-1 h-1 rounded-full bg-border/40" />
                                <span className="text-10 text-emerald-500/50 font-medium uppercase tracking-widest">{stats.completed} Done</span>
                                {stats.bugs > 0 && (
                                    <>
                                        <div className="w-1 h-1 rounded-full bg-border/40" />
                                        <span className="text-10 text-rose-500/50 font-medium uppercase tracking-widest">{stats.bugs} Bugs</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="h-6 w-px bg-border/20 mx-1" />
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/20 group-focus-within:text-primary/40 transition-colors" />
                        <Input 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t('workspaceTodo.filterBoardPlaceholder')} 
                            className="h-9 w-64 pl-9 pr-4 rounded-xl border-border/10 bg-background/20 text-xs focus-visible:ring-1 focus-visible:ring-primary/20 shadow-sm"
                        />
                    </div>
                </div>
                
                <Button 
                    onClick={handleOpenCreateModal}
                    className="h-9 px-6 rounded-xl bg-primary/80 text-primary-foreground text-xs font-semibold hover:bg-primary shadow-lg shadow-primary/10 transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                </Button>
            </div>

            {/* Board Container */}
            <DndContext 
                sensors={sensors} 
                onDragStart={handleDragStart} 
                onDragEnd={handleDragEnd}
            >
                <ScrollArea className="flex-1 w-full border-none">
                    <div className="flex h-full p-10 gap-10 min-w-max">
                        {CATEGORIES.map((category) => (
                            <TaskColumn 
                                key={category.id} 
                                category={category} 
                                tasks={filteredTasks.filter(t => t.status === category.id)}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteTask}
                                onToggleSubtask={handleToggleSubtask}
                                onAddSubtask={handleAddSubtaskPrompt}
                            />
                        ))}
                    </div>
                </ScrollArea>

                <DragOverlay>
                    {activeTask ? (
                        <TaskCard 
                            task={activeTask} 
                            isOverlay 
                            onEdit={() => {}} 
                            onDelete={() => {}} 
                            onToggleSubtask={() => {}}
                            onAddSubtask={() => {}}
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
                            <DialogDescription className="text-xs text-muted-foreground/50">
                                Enter the basic details to finalize your task.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5">
                            <div className="grid gap-2">
                                <Label htmlFor="title" className="text-xs font-medium text-muted-foreground/70">Task Title</Label>
                                <Input
                                    id="title"
                                    placeholder={t('workspaceTodo.taskOverviewPlaceholder')}
                                    value={formData.title}
                                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    className="h-10 border-border/20 bg-background/40 focus-visible:ring-1 focus-visible:ring-primary/20 text-sm"
                                />
                            </div>
                            
                            <div className="grid gap-2">
                                <Label htmlFor="desc" className="text-xs font-medium text-muted-foreground/70">Description</Label>
                                <Textarea
                                    id="desc"
                                    placeholder={t('workspaceTodo.taskContextPlaceholder')}
                                    value={formData.description}
                                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="min-h-32 border-border/20 bg-background/40 focus-visible:ring-1 focus-visible:ring-primary/20 resize-none text-13 leading-relaxed"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-xs font-medium text-muted-foreground/70">Priority</Label>
                                    <Select 
                                        value={formData.priority} 
                                        onValueChange={(val: TaskPriority) => setFormData(prev => ({ ...prev, priority: val }))}
                                    >
                                        <SelectTrigger className="h-10 border-border/20 bg-background/40 focus:ring-primary/20 text-xs">
                                            <SelectValue placeholder={t('workspaceTodo.selectPriority')} />
                                        </SelectTrigger>
                                        <SelectContent className="border-border/40 backdrop-blur-xl bg-background/95">
                                            <SelectItem value="low" className="text-xs">Low</SelectItem>
                                            <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                                            <SelectItem value="high" className="text-xs">High</SelectItem>
                                            <SelectItem value="urgent" className="text-xs text-rose-500 font-medium">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-xs font-medium text-muted-foreground/70">Estimate</Label>
                                    <Input
                                        placeholder="e.g. 2h, 5"
                                        value={formData.estimation}
                                        onChange={e => setFormData(prev => ({ ...prev, estimation: e.target.value }))}
                                        className="h-10 border-border/20 bg-background/40 focus-visible:ring-1 focus-visible:ring-primary/20 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="deadline" className="text-xs font-medium text-muted-foreground/70">Deadline</Label>
                                <Input
                                    id="deadline"
                                    type="date"
                                    value={formData.deadline}
                                    onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                                    className="h-10 border-border/20 bg-background/40 focus-visible:ring-1 focus-visible:ring-primary/20 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="px-7 py-4 border-t border-border/10 bg-muted/5 flex justify-end gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsModalOpen(false)}
                            className="text-xs text-muted-foreground/50 hover:bg-transparent"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleSaveTask}
                            disabled={!formData.title.trim()}
                            className="h-10 px-8 bg-primary/80 text-primary-foreground text-xs font-semibold hover:bg-primary shadow-lg shadow-primary/10 transition-all rounded-lg"
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
                            <DialogDescription className="text-xs text-muted-foreground/50">
                                Enter a title for the new subtask.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="subtaskTitle" className="text-xs font-medium text-muted-foreground/70">Subtask Title</Label>
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
                            className="text-xs text-muted-foreground/50 hover:bg-transparent"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={confirmAddSubtask}
                            disabled={!subtaskTitle.trim()}
                            className="h-10 px-8 bg-primary/80 text-primary-foreground text-xs font-semibold hover:bg-primary shadow-lg shadow-primary/10 transition-all rounded-lg"
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
