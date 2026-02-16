import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GroupedModels } from '@renderer/features/models/utils/model-fetcher';
import { Message } from '@shared/types/chat';
import {
    AgentProfile,
    AgentStartOptions,
    ProjectState,
    ProjectStep,
} from '@shared/types/project-agent';
import { Handle, Node, NodeProps, Position, useReactFlow } from '@xyflow/react';
import {
    AlertCircle,
    Box,
    Brain,
    CheckCircle2,
    ChevronDown,
    Circle,
    Clock,
    Coins,
    FolderGit2,
    GripVertical,
    ListTodo,
    Loader2,
    Maximize,
    Paperclip,
    Play,
    Settings2,
    Sparkles,
    Square,
    Terminal,
    Trash2,
    User,
    X,
    Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useModel } from '@/context/ModelContext';
import { ModelSelector } from '@/features/models/components/ModelSelector';
import { LogConsole } from '@/features/project-agent/components/LogConsole';
import { useProjectManager } from '@/features/projects/hooks/useProjectManager';
import { useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { Project } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

// Interface definitions from old file
export type TaskNodeData = {
    label: string;
    taskId?: string;
    taskType?: 'planner' | 'action' | 'fork' | 'join' | 'create-pr';
    status?:
    | 'idle'
    | 'planning'
    | 'waiting_for_approval'
    | 'running'
    | 'completed'
    | 'failed'
    | 'waiting'
    | 'error';
    description?: string;
    title?: string;
    model?: { provider: string; model: string };
    projectId?: string;
    attachments?: Array<{ name: string; path: string; size: number }>;
    plan?: ProjectStep[];
    history?: Message[];
    activeTab?: 'plan' | 'logs';
    isExpanded?: boolean;
    isModelOpen?: boolean;
    systemMode?: 'thinking' | 'fast' | 'architect';
    agentProfileId?: string;
    /** Total token usage */
    totalTokens?: ProjectState['totalTokens'];
    /** Task timing */
    timing?: ProjectState['timing'];
};

interface TaskNodeActionProps {
    id: string;
    data: TaskNodeData;
    updateNodeData: (id: string, data: Partial<TaskNodeData>) => void;
    currentProviderId: string;
    currentModelId: string;
    selectedProjectId?: string;
}

const useTaskNodeActions = ({
    id,
    data,
    updateNodeData,
    currentProviderId,
    currentModelId,
    selectedProjectId,
}: TaskNodeActionProps) => {
    const { t, language } = useLanguage();
    const planInFlightRef = useRef(false);
    const executeInFlightRef = useRef(false);

    const handlePlan = useCallback(async () => {
        if (!data.title && !data.description) {
            return;
        }
        if (planInFlightRef.current) {
            appLogger.warn(
                'TaskNode',
                'Plan request ignored because a previous plan request is still in-flight'
            );
            return;
        }

        planInFlightRef.current = true;
        try {
            updateNodeData(id, { status: 'planning', isExpanded: true });
            const options: AgentStartOptions = {
                task: data.title ?? data.description ?? t('projectAgent.newTask'),
                nodeId: id,
                model: { provider: currentProviderId, model: currentModelId },
                projectId: selectedProjectId,
                attachments: data.attachments,
                systemMode: data.systemMode,
                agentProfileId: data.agentProfileId,
                locale: language,
            };
            await window.electron.projectAgent.generatePlan(options);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('Cannot start planning from current state: planning')) {
                appLogger.warn(
                    'TaskNode',
                    'Plan request blocked: another planning session is already active'
                );
                updateNodeData(id, { status: 'idle' });
                return;
            }
            appLogger.error('TaskNode', 'Failed to generate plan', error as Error);
            updateNodeData(id, { status: 'failed' });
        } finally {
            planInFlightRef.current = false;
        }
    }, [
        data.title,
        data.description,
        data.attachments,
        data.systemMode,
        data.agentProfileId,
        currentProviderId,
        currentModelId,
        selectedProjectId,
        id,
        updateNodeData,
        t,
        language,
        planInFlightRef,
    ]);

    const handleApprove = useCallback(async () => {
        if (!data.plan) {
            return;
        }
        try {
            updateNodeData(id, { status: 'running' });
            await window.electron.projectAgent.approvePlan(data.plan, data.taskId);
        } catch (error) {
            appLogger.error('TaskNode', 'Failed to approve plan', error as Error);
            updateNodeData(id, { status: 'failed' });
        }
    }, [data.plan, data.taskId, id, updateNodeData]);

    const handleExecute = useCallback(async () => {
        if (data.taskType !== 'create-pr' && !data.title && !data.description) {
            return;
        }
        if (executeInFlightRef.current) {
            appLogger.warn(
                'TaskNode',
                'Execute request ignored because a previous execute request is still in-flight'
            );
            return;
        }
        executeInFlightRef.current = true;
        try {
            if (data.taskType === 'create-pr') {
                updateNodeData(id, { status: 'running', activeTab: 'logs' });
                const result = await window.electron.projectAgent.createPullRequest(data.taskId);
                if (!result.success || !result.url) {
                    throw new Error(result.error ?? 'Failed to generate PR URL');
                }
                window.electron.openExternal(result.url);
                updateNodeData(id, {
                    status: 'completed',
                    description: `PR created: ${result.url}`,
                    title: data.title || 'Create Pull Request',
                });
                return;
            }
            updateNodeData(id, { status: 'running', activeTab: 'logs' });
            const options: AgentStartOptions = {
                task: data.title ?? data.description ?? t('projectAgent.newTask'),
                nodeId: id,
                model: { provider: currentProviderId, model: currentModelId },
                projectId: selectedProjectId,
                attachments: data.attachments,
                systemMode: data.systemMode,
                agentProfileId: data.agentProfileId,
                locale: language,
            };
            await window.electron.projectAgent.start(options);
        } catch (error) {
            appLogger.error('TaskNode', 'Failed to start task', error as Error);
            updateNodeData(id, { status: 'failed' });
        } finally {
            executeInFlightRef.current = false;
        }
    }, [
        data.title,
        data.description,
        data.attachments,
        data.systemMode,
        data.agentProfileId,
        data.taskType,
        data.taskId,
        currentProviderId,
        currentModelId,
        selectedProjectId,
        id,
        updateNodeData,
        t,
        language,
        executeInFlightRef,
    ]);

    const handleStop = useCallback(async () => {
        try {
            updateNodeData(id, { status: 'waiting' });
            await window.electron.projectAgent.stop(data.taskId);
        } catch (error) {
            appLogger.error('TaskNode', 'Failed to stop task', error as Error);
        }
    }, [data.taskId, id, updateNodeData]);

    const handleRetryStep = useCallback(
        async (index: number) => {
            try {
                updateNodeData(id, { status: 'running', activeTab: 'logs' });
                await window.electron.projectAgent.retryStep(index, data.taskId);
            } catch (error) {
                appLogger.error('TaskNode', 'Failed to retry step', error as Error);
                updateNodeData(id, { status: 'failed' });
            }
        },
        [data.taskId, id, updateNodeData]
    );

    return { handlePlan, handleApprove, handleExecute, handleStop, handleRetryStep };
};

interface TaskNodeStateProps {
    id: string;
    data: TaskNodeData;
    projects: Project[];
    globalSelectedProject: Project | null;
    globalModelId: string;
    globalProviderId: string;
    updateNodeData: (id: string, data: Partial<TaskNodeData>) => void;
}

const useTaskExpandedLogs = (
    id: string,
    status?: string,
    updateNodeData?: (id: string, data: Partial<TaskNodeData>) => void
) => {
    const hasSwitchedToLogs = useRef(false);

    useEffect(() => {
        if (status === 'running' && !hasSwitchedToLogs.current) {
            const timer = setTimeout(() => {
                updateNodeData?.(id, { activeTab: 'logs', isExpanded: true });
                hasSwitchedToLogs.current = true;
            }, 100);
            return () => clearTimeout(timer);
        } else if (status !== 'running') {
            hasSwitchedToLogs.current = false;
        }
        return undefined;
    }, [status, id, updateNodeData]);
};

const getSelectedProjectId = (
    data: TaskNodeData,
    globalSelectedProject: Project | null,
    projects: Project[]
) => {
    if (data.projectId) {
        return data.projectId;
    }
    if (globalSelectedProject?.id) {
        return globalSelectedProject.id;
    }
    return projects.length > 0 ? projects[0].id : undefined;
};

const useTaskNodeState = ({
    id,
    data,
    projects,
    globalSelectedProject,
    globalModelId,
    globalProviderId,
    updateNodeData,
}: TaskNodeStateProps) => {
    const activeTab = data.activeTab ?? 'plan';
    const isExpanded = data.isExpanded ?? true;
    const isModelOpen = data.isModelOpen ?? false;

    useTaskExpandedLogs(id, data.status, updateNodeData);

    const isPlanner = data.taskType === 'planner';
    const isAction = data.taskType === 'action' || data.taskType === 'fork' || data.taskType === 'join' || data.taskType === 'create-pr';
    const selectedProjectId = getSelectedProjectId(data, globalSelectedProject, projects);
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const currentModelId = data.model?.model ?? globalModelId;
    const currentProviderId = data.model?.provider ?? globalProviderId;

    return {
        activeTab,
        isExpanded,
        isModelOpen,
        isPlanner,
        isAction,
        selectedProjectId,
        selectedProject,
        currentModelId,
        currentProviderId,
    };
};

// --- Sub-components ---

const formatTokens = (count: number): string => {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
};

const TokenCounter = ({
    tokens,
    timing,
    className,
}: {
    tokens?: { prompt: number; completion?: number };
    timing?: { durationMs?: number };
    className?: string;
}) => {
    if (!tokens && !timing?.durationMs) {
        return null;
    }

    const total = (tokens?.prompt ?? 0) + (tokens?.completion ?? 0);

    return (
        <div className={cn('flex items-center gap-2 text-xxs text-muted-foreground', className)}>
            {tokens && total > 0 && (
                <span
                    className="flex items-center gap-1"
                    title={`${tokens.prompt} prompt + ${tokens.completion} completion`}
                >
                    <Coins className="w-3 h-3" />
                    {formatTokens(total)}
                </span>
            )}
            {timing?.durationMs && timing.durationMs > 0 && (
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(timing.durationMs)}
                </span>
            )}
        </div>
    );
};

const ProgressRing = ({
    progress,
    size = 32,
    strokeWidth = 2,
    className,
    children,
}: {
    progress: number;
    size?: number;
    strokeWidth?: number;
    className?: string;
    children: React.ReactNode;
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div
            className={cn('relative inline-flex items-center justify-center', className)}
            style={{ width: size, height: size }}
        >
            <svg className="absolute -rotate-90" width={size} height={size}>
                <circle
                    className="text-muted/30"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className="text-primary transition-all duration-500 ease-out"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="z-10">{children}</div>
        </div>
    );
};

const TaskMetaInfo = ({ status }: { status: string }) => {
    if (status !== 'running' && status !== 'planning') {
        return null;
    }
    return (
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
                className={cn(
                    'h-full animate-shimmer w-[60%]',
                    status === 'planning' ? 'bg-primary' : 'bg-info'
                )}
            />
        </div>
    );
};

interface TaskTabsProps {
    id: string;
    activeTab: 'plan' | 'logs';
    updateNodeData: (id: string, data: Partial<TaskNodeData>) => void;
    planCount?: number;
    status?: string;
}

const TaskTabs = ({
    id,
    activeTab,
    updateNodeData,
    planCount,
    status,
    t,
}: TaskTabsProps & { t: (key: string) => string }) => (
    <div className="flex items-center gap-4 border-b border-border/20 pb-2">
        <button
            onClick={() => updateNodeData(id, { activeTab: 'plan' })}
            className={cn(
                'flex items-center gap-1.5 text-xs font-medium transition-colors pb-1 border-b-2',
                activeTab === 'plan'
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground/80'
            )}
        >
            <ListTodo className="w-3.5 h-3.5" />
            <span>{t('projectAgent.planTab')}</span>
            {planCount ? (
                <span className="text-xxs bg-muted/20 px-1 rounded-full">{planCount}</span>
            ) : null}
        </button>
        <button
            onClick={() => updateNodeData(id, { activeTab: 'logs' })}
            className={cn(
                'flex items-center gap-1.5 text-xs font-medium transition-colors pb-1 border-b-2',
                activeTab === 'logs'
                    ? 'text-foreground border-info'
                    : 'text-muted-foreground border-transparent hover:text-foreground/80'
            )}
        >
            <Terminal className="w-3.5 h-3.5" />
            <span>{t('projectAgent.consoleTab')}</span>
        </button>
        <span className="ml-auto text-xxs text-muted-foreground">
            {status === 'planning'
                ? t('projectAgent.generatingPlan')
                : status === 'running'
                    ? t('projectAgent.executingTask')
                    : status === 'waiting_for_approval'
                        ? t('projectAgent.waitingApproval')
                        : ''}
        </span>
    </div>
);

// Locally defined definition of ProjectStep to support drag and drop grouping

interface PlanStageProps {
    plan: ProjectStep[];
    status: string;
    onUpdatePlan: (newPlan: ProjectStep[]) => void;
    onRetry: (index: number) => void | Promise<void>;
    planContainerRef: React.RefObject<HTMLDivElement>;
    activeStepRef: React.RefObject<HTMLDivElement>;
}

// DnD Draggable Item Component
const SortableStepItem = ({
    step,
    index: _index,
    status,
    onUpdate,
    onRemove,
    onRetry,
    t,
    isActive,
    activeRef,
}: {
    step: ProjectStep;
    index: number;
    status: string;
    onUpdate: (val: string) => void;
    onRemove: () => void;
    onRetry: () => void;
    t: (key: string) => string;
    isActive?: boolean;
    activeRef?: React.RefObject<HTMLDivElement>;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: step.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const isRunning = step.status === 'running';

    const setRef = (node: HTMLDivElement | null) => {
        setNodeRef(node);
        if (activeRef && node) {
            const mutableRef = activeRef as React.MutableRefObject<HTMLDivElement | null>;
            mutableRef.current = node;
        }
    };

    return (
        <div
            ref={setRef}
            style={style}
            className={cn(
                'flex gap-2 items-start group/step p-1 rounded transition-all bg-card/40 border border-transparent hover:border-border/40',
                isRunning && 'bg-info/10 border-info/20 ring-1 ring-info/10',
                isActive && 'opacity-50 ring-2 ring-primary bg-primary/10 z-50 relative'
            )}
        >
            <div
                {...attributes}
                {...listeners}
                className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-foreground transition-colors"
            >
                <GripVertical className="w-3.5 h-3.5" />
            </div>

            <div className="mt-1.5 shrink-0">
                {step.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                ) : isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 text-info animate-spin" />
                ) : step.status === 'failed' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                ) : (
                    <Circle className="w-3.5 h-3.5 text-muted-foreground/30" />
                )}
            </div>
            <div className="flex-1">
                <textarea
                    className={cn(
                        'w-full bg-transparent border-none p-0 text-xs focus:ring-0 resize-none overflow-hidden min-h-[20px]',
                        step.status === 'completed' &&
                        'text-muted-foreground line-through opacity-50',
                        isRunning && 'text-info'
                    )}
                    value={step.text}
                    onChange={e => onUpdate(e.target.value)}
                    disabled={status === 'running' || step.status === 'completed'}
                    rows={1}
                    style={{ height: 'auto', minHeight: '24px' }}
                    onInput={e => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                    }}
                />
            </div>
            <button
                onClick={onRemove}
                className="mt-1 opacity-0 group-hover/step:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                disabled={status === 'running'}
            >
                <X className="w-3 h-3" />
            </button>
            {step.status === 'failed' && (
                <button
                    onClick={onRetry}
                    className="ml-2 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                    {t('common.retry')}
                </button>
            )}
            {(step.status === 'completed' || step.status === 'running') && (
                <TokenCounter
                    tokens={step.tokens}
                    timing={step.timing}
                    className="ml-auto opacity-60"
                />
            )}
        </div>
    );
};

const GroupHeader = ({
    name,
    isExpanded,
    onToggle,
    t,
}: {
    name?: string;
    isExpanded: boolean;
    onToggle: () => void;
    t: (key: string) => string;
}) => (
    <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 bg-muted/10 hover:bg-muted/20 rounded-md transition-colors text-xs font-medium text-muted-foreground hover:text-foreground mt-2 mb-1"
    >
        {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
        ) : (
            <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
        )}
        <FolderGit2 className="w-3.5 h-3.5" />
        <span>{name || t('projectAgent.unnamedGroup')}</span>
    </button>
);

const PlanStage = ({
    plan,
    status,
    onUpdatePlan,
    onRetry,
    planContainerRef,
    activeStepRef,
    t,
}: PlanStageProps & { t: (key: string, options?: Record<string, string | number>) => string }) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
                delay: 250,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: { active: { id: string | number } }) => {
        setActiveId(String(event.active.id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            const oldIndex = plan.findIndex(item => item.id === active.id);
            const newIndex = plan.findIndex(item => item.id === over?.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newPlan = arrayMove(plan, oldIndex, newIndex);
                onUpdatePlan(newPlan);
            }
        }

        setActiveId(null);
    };

    const activeStep = plan.find(s => s.id === activeId);

    return (
        <div
            ref={planContainerRef}
            className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1 nodrag nowheel"
        >
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={plan.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {(() => {
                        const nodes: React.ReactNode[] = [];
                        let lastGroupId: string | undefined = undefined;

                        plan.forEach((step, idx) => {
                            if (step.groupId && step.groupId !== lastGroupId) {
                                const isExpanded = expandedGroups[step.groupId] ?? true;
                                nodes.push(
                                    <GroupHeader
                                        key={`group-${step.groupId}`}
                                        name={step.groupName}
                                        isExpanded={isExpanded}
                                        onToggle={() =>
                                            setExpandedGroups(prev => ({
                                                ...prev,
                                                [step.groupId ?? '']: !isExpanded,
                                            }))
                                        }
                                        t={t}
                                    />
                                );
                                lastGroupId = step.groupId;
                            } else if (!step.groupId) {
                                lastGroupId = undefined;
                            }

                            const show = !step.groupId || (expandedGroups[step.groupId] ?? true);

                            if (show) {
                                nodes.push(
                                    <SortableStepItem
                                        key={step.id}
                                        step={step}
                                        index={idx}
                                        status={status}
                                        onUpdate={val => {
                                            const newPlan = [...plan];
                                            newPlan[idx] = { ...newPlan[idx], text: val };
                                            onUpdatePlan(newPlan);
                                        }}
                                        onRemove={() => {
                                            const newPlan = [...plan];
                                            newPlan.splice(idx, 1);
                                            onUpdatePlan(newPlan);
                                        }}
                                        onRetry={() => void onRetry(idx)}
                                        t={t}
                                        activeRef={
                                            step.status === 'running' ? activeStepRef : undefined
                                        }
                                    />
                                );
                            }
                        });
                        return nodes;
                    })()}
                </SortableContext>
                <DragOverlay>
                    {activeId && activeStep ? (
                        <div className="opacity-80 scale-105 pointer-events-none">
                            <SortableStepItem
                                step={activeStep}
                                index={-1}
                                status={status}
                                isActive={true}
                                onUpdate={() => { }}
                                onRemove={() => { }}
                                onRetry={() => { }}
                                t={t}
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {(status === 'waiting_for_approval' || status === 'idle') && (
                <button
                    onClick={() => {
                        const newPlan = [...plan];
                        newPlan.push({
                            id: Math.random().toString(36).substr(2, 9),
                            text: t('projectAgent.newStep'),
                            status: 'pending',
                        });
                        onUpdatePlan(newPlan);
                    }}
                    className="w-full py-1 text-xxs text-muted-foreground hover:text-primary border border-dashed border-border/20 hover:border-primary/30 rounded-md transition-colors mt-2"
                >
                    {t('projectAgent.addStep')}
                </button>
            )}
            {!plan.length && status !== 'planning' && (
                <div className="text-center py-8 text-muted-foreground/40 text-xs italic">
                    {t('projectAgent.noPlan')}
                </div>
            )}
        </div>
    );
};

const TaskExecutionDetails = ({
    id,
    data,
    activeTab,
    updateNodeData,
    onRetry,
    planContainerRef,
    activeStepRef,
    t,
}: {
    id: string;
    data: TaskNodeData;
    activeTab: 'plan' | 'logs';
    updateNodeData: (id: string, data: Partial<TaskNodeData>) => void;
    onRetry: (index: number) => void | Promise<void>;
    planContainerRef: React.RefObject<HTMLDivElement>;
    activeStepRef: React.RefObject<HTMLDivElement>;
    t: (key: string, options?: Record<string, string | number>) => string;
}) => (
    <div className="pt-2 border-t border-border/20 space-y-2">
        <TaskTabs
            id={id}
            activeTab={activeTab}
            updateNodeData={updateNodeData}
            planCount={data.plan?.length}
            status={data.status}
            t={t}
        />
        {activeTab === 'plan' ? (
            <PlanStage
                plan={data.plan ?? []}
                status={data.status ?? 'idle'}
                onUpdatePlan={newPlan => updateNodeData(id, { plan: newPlan })}
                onRetry={onRetry}
                planContainerRef={planContainerRef}
                activeStepRef={activeStepRef}
                t={t}
            />
        ) : (
            <LogConsole logs={data.history ?? []} className="h-[300px]" />
        )}
    </div>
);

const ProgressBar = ({
    plan,
    totalTokens,
}: {
    plan: ProjectStep[];
    totalTokens?: { prompt: number; completion: number };
}) => {
    const { t } = useLanguage();
    const completed = plan.filter(s => s.status === 'completed').length;
    const total = plan.length;
    const percentage = Math.round((completed / Math.max(1, total)) * 100);

    // Calculate total duration from completed steps
    const totalDuration = plan.reduce((acc, step) => {
        return acc + (step.timing?.durationMs ?? 0);
    }, 0);

    return (
        <div className="px-4 py-2 bg-card/10 border-t border-border/20">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xxs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('projectAgent.overallProgress')}
                </span>
                <div className="flex items-center gap-3">
                    <TokenCounter
                        tokens={totalTokens}
                        timing={{ durationMs: totalDuration }}
                        className="opacity-80"
                    />
                    <span className="text-xxs font-mono text-primary">{percentage}%</span>
                </div>
            </div>
            <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

const AgentProfileSelector = ({
    profiles,
    selectedProfileId,
    onProfileSelect,
}: {
    profiles: AgentProfile[];
    selectedProfileId?: string;
    onProfileSelect?: (id: string) => void;
}) => {
    const { t } = useLanguage();
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        'flex items-center justify-center p-1.5 rounded-md transition-colors',
                        selectedProfile
                            ? 'bg-primary/20 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
                    )}
                    title={
                        selectedProfile
                            ? t('projectAgent.agentSelected', { name: selectedProfile.name })
                            : t('projectAgent.selectAgentProfile')
                    }
                >
                    <User className="w-3.5 h-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1 bg-popover/95 backdrop-blur-xl">
                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-0.5">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {t('projectAgent.selectAgentProfile')}
                    </div>
                    <button
                        onClick={() => onProfileSelect?.('')}
                        className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left',
                            !selectedProfileId
                                ? 'bg-primary/20 text-primary'
                                : 'hover:bg-muted/20 text-foreground'
                        )}
                    >
                        <div className="p-1 rounded bg-background/50">
                            <Sparkles className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium">{t('projectAgent.defaultAgent')}</span>
                            <span className="text-xxs text-muted-foreground opacity-70">
                                {t('projectAgent.defaultAgentDesc')}
                            </span>
                        </div>
                    </button>
                    {profiles.map(p => (
                        <button
                            key={p.id}
                            onClick={() => onProfileSelect?.(p.id)}
                            className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left',
                                p.id === selectedProfileId
                                    ? 'bg-primary/20 text-primary'
                                    : 'hover:bg-muted/20 text-foreground'
                            )}
                        >
                            <div className="p-1 rounded bg-background/50">
                                <User className="w-3 h-3" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-medium truncate">{p.name}</span>
                                <span className="text-xxs text-muted-foreground opacity-70 truncate max-w-[140px]">
                                    {p.role}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};

const TaskHeader = ({
    isPlanner,
    isAction,
    label,
    selectedProject,
    projects,
    selectedProjectId,
    onProjectSelect,
    isExpanded,
    setIsExpanded,
    onDelete,
    progress,
    status,
}: {
    isPlanner: boolean;
    isAction: boolean;
    label: string;
    selectedProject?: { title: string };
    projects: Array<{ id: string; title: string }>;
    selectedProjectId?: string;
    onProjectSelect: (id: string) => void;
    isExpanded: boolean;
    setIsExpanded: (expanded: boolean) => void;
    onDelete: () => void;
    progress?: number;
    status?: string;
}) => {
    const { t } = useLanguage();
    const showProgressRing = status === 'running' || status === 'planning';

    const iconContent = (
        <div
            className={cn(
                'p-1.5 rounded-lg shrink-0',
                isPlanner
                    ? 'bg-primary/20 text-primary'
                    : isAction
                        ? 'bg-warning/20 text-warning'
                        : 'bg-primary/20 text-primary'
            )}
        >
            {isPlanner ? (
                <Sparkles className="w-4 h-4" />
            ) : isAction ? (
                <Zap className="w-4 h-4" />
            ) : (
                <Box className="w-4 h-4" />
            )}
        </div>
    );

    return (
        <div className="p-3 border-b border-border/20 flex items-center justify-between bg-muted/10 rounded-t-lg">
            <div className="flex items-center gap-2 overflow-hidden">
                {showProgressRing ? (
                    <ProgressRing progress={progress ?? 0} size={32} strokeWidth={2}>
                        {iconContent}
                    </ProgressRing>
                ) : (
                    iconContent
                )}
                {isPlanner ? (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="flex items-center gap-1.5 text-xs font-medium hover:bg-muted/20 px-2 py-1 rounded-md transition-colors truncate max-w-[120px]">
                                <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="truncate">
                                    {selectedProject?.title ?? t('projectAgent.selectProject')}
                                </span>
                                <ChevronDown className="w-3 h-3 text-muted-foreground opacity-50" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="start"
                            className="w-48 p-1 bg-popover/95 backdrop-blur-xl"
                        >
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {projects.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => onProjectSelect(p.id)}
                                        className={cn(
                                            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                                            p.id === selectedProjectId
                                                ? 'bg-primary/20 text-primary'
                                                : 'hover:bg-muted/20 text-foreground'
                                        )}
                                    >
                                        <span className="truncate">{p.title}</span>
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                ) : (
                    <span className="font-semibold text-sm tracking-tight truncate">{label}</span>
                )}
            </div>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/20"
                >
                    {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                    ) : (
                        <Maximize className="w-3.5 h-3.5" />
                    )}
                </button>
                <button
                    onClick={onDelete}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-muted/20"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

const TaskFooterButtons = ({
    status,
    isPlanner,
    canRun,
    onApprove,
    onStop,
    onPlan,
    onExecute,
}: {
    status: string;
    isPlanner: boolean;
    canRun: boolean;
    onApprove: () => void;
    onStop: () => void;
    onPlan: () => void;
    onExecute: () => void;
}) => {
    const { t } = useLanguage();
    if (status === 'waiting_for_approval') {
        return (
            <button
                onClick={onApprove}
                className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success hover:bg-success/20 border border-success/20 hover:border-success/30 rounded-lg font-medium transition-all ml-auto"
            >
                <Play className="w-3 h-3 fill-current" />
                <span>{t('projectAgent.approveAndRun')}</span>
            </button>
        );
    }
    if (status === 'planning' || status === 'running') {
        return (
            <button
                onClick={onStop}
                className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 rounded-lg font-medium ml-auto transition-colors group/stop"
            >
                <div className="relative">
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin group-hover/stop:opacity-0 transition-opacity absolute inset-0" />
                    <Square className="w-3 h-3 fill-current opacity-0 group-hover/stop:opacity-100 transition-opacity" />
                </div>
                <span>
                    {status === 'planning' ? t('projectAgent.planning') : t('projectAgent.running')}{' '}
                    {t('projectAgent.stopLabel')}
                </span>
            </button>
        );
    }
    return (
        <div className="flex items-center gap-2 ml-auto">
            {isPlanner && (
                <button
                    onClick={onPlan}
                    disabled={!canRun}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 hover:border-primary/30 rounded-lg font-medium transition-all"
                >
                    <Sparkles className="w-3 h-3" />
                    <span>{t('projectAgent.planAction')}</span>
                </button>
            )}
            <button
                onClick={onExecute}
                disabled={!canRun}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 hover:border-primary/30 rounded-lg font-medium transition-all"
            >
                <Play className="w-3 h-3 fill-current" />
                {isPlanner ? '' : <span>{t('projectAgent.executeAction')}</span>}
            </button>
        </div>
    );
};

const TaskFooterControls = ({
    isPlanner,
    isModelOpen,
    systemMode,
    currentProviderId,
    currentModelId,
    groupedModels,
    onModelSelect,
    onOpenModelChange,
    onFileClick,
    onToggleThinking,
    profiles,
    selectedProfileId,
    onProfileSelect,
}: {
    isPlanner: boolean;
    isModelOpen: boolean;
    systemMode?: string;
    currentProviderId: string;
    currentModelId: string;
    groupedModels?: GroupedModels;
    onModelSelect: (provider: string, model: string) => void;
    onOpenModelChange: (open: boolean) => void;
    onFileClick: () => void;
    onToggleThinking?: () => void;
    profiles?: AgentProfile[];
    selectedProfileId?: string;
    onProfileSelect?: (id: string) => void;
}) => {
    const { t } = useLanguage();
    return (
        <>
            {isPlanner ? (
                <div className="flex items-center gap-1">
                    <button
                        onClick={onFileClick}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded-md transition-colors"
                    >
                        <Paperclip className="w-3.5 h-3.5" />
                    </button>
                    <div
                        className={cn(
                            'scale-90 origin-left transition-all',
                            isModelOpen ? 'z-50' : ''
                        )}
                    >
                        <ModelSelector
                            selectedProvider={currentProviderId}
                            selectedModel={currentModelId}
                            onSelect={onModelSelect}
                            groupedModels={groupedModels}
                            onOpenChange={onOpenModelChange}
                            isIconOnly={true}
                        />
                    </div>

                    {profiles && profiles.length > 0 && (
                        <AgentProfileSelector
                            profiles={profiles}
                            selectedProfileId={selectedProfileId}
                            onProfileSelect={onProfileSelect}
                        />
                    )}
                </div>
            ) : (
                <div />
            )}
            <div className="flex items-center gap-2">
                <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/20">
                    <Settings2 className="w-3.5 h-3.5" />
                </button>
                {isPlanner && (
                    <button
                        onClick={onToggleThinking}
                        className={cn(
                            'flex items-center justify-center p-1 rounded-md transition-colors',
                            systemMode === 'thinking'
                                ? 'bg-primary/20 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
                        )}
                        title={
                            systemMode === 'thinking'
                                ? t('projectAgent.thinkingOn')
                                : t('projectAgent.thinkingOff')
                        }
                    >
                        <Brain className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </>
    );
};

const TaskFooter = ({
    status,
    isModelOpen,
    currentProviderId,
    currentModelId,
    groupedModels,
    onModelSelect,
    onOpenModelChange,
    onFileClick,
    onApprove,
    onStop,
    onPlan,
    onExecute,
    canRun,
    isPlanner,
    systemMode,
    onToggleThinking,
    profiles,
    selectedProfileId,
    onProfileSelect,
}: {
    status: string;
    isModelOpen: boolean;
    currentProviderId: string;
    currentModelId: string;
    groupedModels?: GroupedModels;
    onModelSelect: (provider: string, model: string) => void;
    onOpenModelChange: (open: boolean) => void;
    onFileClick: () => void;
    onApprove: () => void;
    onStop: () => void;
    onPlan: () => void;
    onExecute: () => void;
    canRun: boolean;
    isPlanner: boolean;
    systemMode?: string;
    onToggleThinking?: () => void;
    profiles?: AgentProfile[];
    selectedProfileId?: string;
    onProfileSelect?: (id: string) => void;
}) => (
    <div className="px-3 py-2 bg-card/20 rounded-b-lg border-t border-border/20 flex justify-between items-center text-xxs">
        <div className="flex items-center gap-2">
            <TaskFooterControls
                isPlanner={isPlanner}
                isModelOpen={isModelOpen}
                systemMode={systemMode}
                currentProviderId={currentProviderId}
                currentModelId={currentModelId}
                groupedModels={groupedModels}
                onModelSelect={onModelSelect}
                onOpenModelChange={onOpenModelChange}
                onFileClick={onFileClick}
                onToggleThinking={onToggleThinking}
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                onProfileSelect={onProfileSelect}
            />
            <TaskFooterButtons
                status={status}
                isPlanner={isPlanner}
                canRun={canRun}
                onApprove={onApprove}
                onStop={onStop}
                onPlan={onPlan}
                onExecute={onExecute}
            />
        </div>
    </div>
);

interface TaskBodyProps {
    id: string;
    data: TaskNodeData;
    isPlanner: boolean;
    isAction: boolean;
    isExpanded: boolean;
    activeTab: 'plan' | 'logs';
    updateNodeData: (id: string, data: Partial<TaskNodeData>) => void;
    onRetry: (index: number) => void | Promise<void>;
    planContainerRef: React.RefObject<HTMLDivElement>;
    activeStepRef: React.RefObject<HTMLDivElement>;
}

const TaskInput = ({
    id,
    data,
    updateNodeData,
}: {
    id: string;
    data: TaskNodeData;
    updateNodeData: (id: string, data: Partial<TaskNodeData>) => void;
}) => {
    const { t } = useLanguage();
    const removeAttachment = (index: number) => {
        const newAttachments = [...(data.attachments ?? [])];
        newAttachments.splice(index, 1);
        updateNodeData(id, { attachments: newAttachments });
    };

    return (
        <div className="space-y-2">
            <input
                className="w-full bg-transparent border-none p-0 text-sm font-semibold focus:outline-none focus:ring-0"
                placeholder={t('tools.taskTitlePlaceholder')}
                value={data.title ?? ''}
                onChange={e => updateNodeData(id, { title: e.target.value })}
            />
            {data.attachments && data.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {data.attachments.map((file, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-1 bg-muted/20 px-2 py-1 rounded-md text-xxs text-muted-foreground border border-border/20 group/file"
                        >
                            <span className="truncate max-w-[100px]">{file.name}</span>
                            <button
                                onClick={() => removeAttachment(idx)}
                                className="hover:text-destructive opacity-0 group-hover/file:opacity-100 transition-opacity"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <textarea
                className="w-full bg-card/20 border border-border/20 rounded-md p-2 text-xs focus:outline-none focus:border-primary/50 resize-none nodrag"
                placeholder={t('tools.taskDescriptionPlaceholder')}
                rows={3}
                value={data.description ?? ''}
                onChange={e => updateNodeData(id, { description: e.target.value })}
            />
        </div>
    );
};

const TaskBody = ({
    id,
    data,
    isPlanner,
    isAction,
    isExpanded,
    activeTab,
    updateNodeData,
    onRetry,
    planContainerRef,
    activeStepRef,
}: TaskBodyProps) => {
    const { t } = useLanguage();
    const showExecutionPanel = Boolean(
        (data as TaskNodeData & { showInlineExecutionPanel?: boolean }).showInlineExecutionPanel
    );

    // Debug: Log render conditions
    appLogger.debug(
        'TaskBody',
        `Node ${id}: isExpanded=${isExpanded}, isPlanner=${isPlanner}, taskType=${data.taskType}, plan=${data.plan?.length ?? 0}, status=${data.status}`
    );

    return (
        <div className="p-4 space-y-3">
            {isPlanner ? (
                <TaskInput id={id} data={data} updateNodeData={updateNodeData} />
            ) : isAction ? (
                <div className="bg-card/20 border border-border/20 rounded-md p-2 text-xs text-muted-foreground">
                    {data.taskType === 'create-pr'
                        ? 'Create a GitHub pull request from the active agent branch'
                        : t('projectAgent.selectAction')}
                </div>
            ) : (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {data.description ?? t('projectAgent.noDescription')}
                </p>
            )}
            {isPlanner && data.plan && data.plan.length > 0 && (
                <ProgressBar plan={data.plan} totalTokens={data.totalTokens} />
            )}
            {showExecutionPanel && isExpanded && isPlanner && (
                <TaskExecutionDetails
                    id={id}
                    data={data}
                    activeTab={activeTab}
                    updateNodeData={updateNodeData}
                    onRetry={onRetry}
                    planContainerRef={planContainerRef}
                    activeStepRef={activeStepRef}
                    t={t}
                />
            )}
            <TaskMetaInfo status={data.status ?? 'idle'} />
        </div>
    );
};

const getTaskNodeClasses = (isExpanded: boolean, selected: boolean, status: string) => {
    return cn(
        'bg-card/90 backdrop-blur-xl border-2 rounded-xl transition-all duration-300 group shadow-lg',
        isExpanded ? 'w-[500px]' : 'w-72',
        selected
            ? 'border-primary shadow-primary/20 scale-[1.02]'
            : 'border-border/50 hover:border-primary/50',
        status === 'running' && 'border-info shadow-info/20 animate-pulse',
        status === 'planning' && 'border-primary shadow-primary/20 animate-pulse',
        status === 'waiting_for_approval' && 'border-warning shadow-warning/20',
        status === 'completed' && 'border-success shadow-success/20',
        status === 'failed' && 'border-destructive shadow-destructive/20'
    );
};

export const TaskNode = ({ id, data, selected }: NodeProps<Node<TaskNodeData>>) => {
    const { updateNodeData, deleteElements } = useReactFlow();
    const { projects, selectedProject: globalSelectedProject } = useProjectManager();
    const {
        groupedModels,
        selectedModel: globalModelId,
        selectedProvider: globalProviderId,
    } = useModel();
    const [profiles, setProfiles] = React.useState<AgentProfile[]>([]);

    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                const getProfilesFn = (
                    window.electron.projectAgent as
                    | { getProfiles?: () => Promise<AgentProfile[]> }
                    | undefined
                )?.getProfiles;
                if (typeof getProfilesFn !== 'function') {
                    appLogger.warn(
                        'TaskNode',
                        'projectAgent.getProfiles is unavailable in current preload bridge'
                    );
                    setProfiles([]);
                    return;
                }

                const fetched = await getProfilesFn();
                setProfiles(fetched);
            } catch (err) {
                appLogger.error('TaskNode', 'Failed to fetch agent profiles', err as Error);
            }
        };
        void fetchProfiles();
    }, []);

    const {
        activeTab,
        isExpanded,
        isModelOpen,
        isPlanner,
        isAction,
        selectedProjectId,
        selectedProject,
        currentModelId,
        currentProviderId,
    } = useTaskNodeState({
        id,
        data,
        projects,
        globalSelectedProject,
        globalModelId,
        globalProviderId,
        updateNodeData,
    });

    const { handlePlan, handleApprove, handleExecute, handleStop, handleRetryStep } =
        useTaskNodeActions({
            id,
            data,
            updateNodeData,
            currentProviderId,
            currentModelId,
            selectedProjectId,
        });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const planContainerRef = useRef<HTMLDivElement>(null);
    const activeStepRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const runningStepId = data.plan?.find(s => s.status === 'running')?.id;
        if (runningStepId && activeStepRef.current && planContainerRef.current) {
            activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [data.plan]);

    useEffect(() => {
        const status = data.status ?? 'idle';
        const needsExpansion = ['planning', 'waiting_for_approval'].includes(status);
        if (needsExpansion) {
            // When waiting for approval, expand the node and show plan tab
            const updates: Partial<TaskNodeData> = { isExpanded: true };
            if (status === 'waiting_for_approval') {
                updates.activeTab = 'plan';
            }
            updateNodeData(id, updates);
        }
    }, [data.status, id, updateNodeData]);

    const onFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                const files = Array.from(e.target.files);
                const newAttachments = files.map(f => ({
                    name: f.name,
                    path: (f as { path?: string }).path ?? f.name,
                    size: f.size,
                }));
                updateNodeData(id, {
                    attachments: [...(data.attachments ?? []), ...newAttachments],
                });
            }
        },
        [id, data.attachments, updateNodeData]
    );

    // Calculate plan progress percentage
    const planProgress = React.useMemo(() => {
        if (!data.plan || data.plan.length === 0) {
            return 0;
        }
        const completed = data.plan.filter(s => s.status === 'completed').length;
        return Math.round((completed / data.plan.length) * 100);
    }, [data.plan]);

    return (
        <div className={getTaskNodeClasses(isExpanded, !!selected, data.status ?? 'idle')}>
            <Handle
                type="target"
                position={Position.Top}
                className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background transition-colors hover:!bg-primary"
            />
            <TaskHeader
                isPlanner={isPlanner}
                isAction={isAction}
                label={data.label}
                selectedProject={selectedProject}
                projects={projects}
                selectedProjectId={selectedProjectId}
                onProjectSelect={pid => updateNodeData(id, { projectId: pid })}
                isExpanded={isExpanded}
                setIsExpanded={expanded => updateNodeData(id, { isExpanded: expanded })}
                onDelete={() => void deleteElements({ nodes: [{ id }] })}
                progress={planProgress}
                status={data.status}
            />

            <TaskBody
                id={id}
                data={data}
                isPlanner={isPlanner}
                isAction={isAction}
                isExpanded={isExpanded}
                activeTab={activeTab}
                updateNodeData={updateNodeData}
                onRetry={handleRetryStep}
                planContainerRef={planContainerRef}
                activeStepRef={activeStepRef}
            />

            <TaskFooter
                isPlanner={isPlanner}
                status={data.status ?? 'idle'}
                isModelOpen={isModelOpen}
                currentProviderId={currentProviderId}
                currentModelId={currentModelId}
                groupedModels={groupedModels ?? undefined}
                onModelSelect={(provider, model) =>
                    void updateNodeData(id, { model: { provider, model } })
                }
                onOpenModelChange={open => void updateNodeData(id, { isModelOpen: open })}
                onFileClick={() => fileInputRef.current?.click()}
                onApprove={() => void handleApprove()}
                onStop={() => void handleStop()}
                onPlan={() => void handlePlan()}
                onExecute={() => void handleExecute()}
                canRun={data.taskType === 'create-pr' ? true : !!(data.title ?? data.description)}
                systemMode={data.systemMode}
                onToggleThinking={() =>
                    updateNodeData(id, {
                        systemMode: data.systemMode === 'thinking' ? 'fast' : 'thinking',
                    })
                }
                profiles={profiles}
                selectedProfileId={data.agentProfileId}
                onProfileSelect={pid => updateNodeData(id, { agentProfileId: pid })}
            />
            <input
                type="file"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={e => void onFileChange(e)}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background transition-colors hover:!bg-primary"
            />
        </div>
    );
};
