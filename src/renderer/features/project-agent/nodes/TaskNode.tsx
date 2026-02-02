import { GroupedModels } from '@renderer/features/models/utils/model-fetcher';
import { Message } from '@shared/types/chat';
import { AgentStartOptions, ProjectStep } from '@shared/types/project-agent';
import { Handle, Node, NodeProps, Position, useReactFlow } from '@xyflow/react';
import { AlertCircle, Box, Brain, CheckCircle2, ChevronDown, Circle, FolderGit2, ListTodo, Loader2, Maximize, Paperclip, Play, Settings2, Sparkles, Square, Terminal, Trash2, X, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useModel } from '@/context/ModelContext';
import { ModelSelector } from '@/features/models/components/ModelSelector';
import { LogConsole } from '@/features/project-agent/components/LogConsole';
import { useProjectManager } from '@/features/projects/hooks/useProjectManager';
import { cn } from '@/lib/utils';
import { Project } from '@/types';

export type TaskNodeData = {
    label: string;
    taskType?: 'planner' | 'action';
    status?: 'idle' | 'planning' | 'waiting_for_approval' | 'running' | 'completed' | 'failed' | 'waiting' | 'error';
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
};

interface TaskNodeActionProps {
    id: string;
    data: TaskNodeData;
    updateNodeData: (id: string, data: Partial<TaskNodeData>) => void;
    currentProviderId: string;
    currentModelId: string;
    selectedProjectId?: string;
}

const useTaskNodeActions = ({ id, data, updateNodeData, currentProviderId, currentModelId, selectedProjectId }: TaskNodeActionProps) => {
    const handlePlan = useCallback(async () => {
        if (!data.title && !data.description) {
            return;
        }
        try {
            updateNodeData(id, { status: 'planning', isExpanded: true });
            const options: AgentStartOptions = {
                task: data.title ?? data.description ?? 'New Task',
                nodeId: id,
                model: { provider: currentProviderId, model: currentModelId },
                projectId: selectedProjectId,
                attachments: data.attachments,
                systemMode: data.systemMode
            };
            await window.electron.projectAgent.generatePlan(options);
        } catch (error) {
            console.error('Failed to generate plan:', error);
            updateNodeData(id, { status: 'failed' });
        }
    }, [data.title, data.description, data.attachments, data.systemMode, currentProviderId, currentModelId, selectedProjectId, id, updateNodeData]);

    const handleApprove = useCallback(async () => {
        if (!data.plan) {
            return;
        }
        try {
            updateNodeData(id, { status: 'running' });
            // Since approvePlan in preload takes string[], we might need to update preload or just pass it.
            // But the service now needs nodeId. Our current approvePlan in preload is: 
            // approvePlan: (plan) => ipcRenderer.invoke('project:approve', plan)
            // We should ideally pass { plan, nodeId } or similar.
            // For now, let's assume the backend will use the nodeId from the LAST generatePlan call.
            // OR we can update preload.
            await window.electron.projectAgent.approvePlan(data.plan.map(s => s.text));
        } catch (error) {
            console.error('Failed to approve plan:', error);
            updateNodeData(id, { status: 'failed' });
        }
    }, [data.plan, id, updateNodeData]);

    const handleExecute = useCallback(async () => {
        if (!data.title && !data.description) {
            return;
        }
        try {
            updateNodeData(id, { status: 'running', activeTab: 'logs' });
            const options: AgentStartOptions = {
                task: data.title ?? data.description ?? 'New Task',
                nodeId: id,
                model: { provider: currentProviderId, model: currentModelId },
                projectId: selectedProjectId,
                attachments: data.attachments,
                systemMode: data.systemMode
            };
            await window.electron.projectAgent.start(options);
        } catch (error) {
            console.error('Failed to start task:', error);
            updateNodeData(id, { status: 'failed' });
        }
    }, [data.title, data.description, data.attachments, data.systemMode, currentProviderId, currentModelId, selectedProjectId, id, updateNodeData]);

    const handleStop = useCallback(async () => {
        try {
            updateNodeData(id, { status: 'waiting' });
            await window.electron.projectAgent.stop();
        } catch (error) {
            console.error('Failed to stop task:', error);
        }
    }, [id, updateNodeData]);

    const handleRetryStep = useCallback(async (index: number) => {
        try {
            updateNodeData(id, { status: 'running', activeTab: 'logs' });
            await window.electron.projectAgent.retryStep(index);
        } catch (error) {
            console.error('Failed to retry step:', error);
            updateNodeData(id, { status: 'failed' });
        }
    }, [id, updateNodeData]);

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

const useTaskExpandedLogs = (id: string, status?: string, updateNodeData?: (id: string, data: Partial<TaskNodeData>) => void) => {
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
    updateNodeData
}: TaskNodeStateProps) => {
    const activeTab = data.activeTab ?? 'plan';
    const isExpanded = data.isExpanded ?? true;
    const isModelOpen = data.isModelOpen ?? false;

    useTaskExpandedLogs(id, data.status, updateNodeData);

    const isPlanner = data.taskType === 'planner';
    const isAction = data.taskType === 'action';
    const selectedProjectId = getSelectedProjectId(data, globalSelectedProject, projects);
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const currentModelId = data.model?.model ?? globalModelId;
    const currentProviderId = data.model?.provider ?? globalProviderId;

    return { activeTab, isExpanded, isModelOpen, isPlanner, isAction, selectedProjectId, selectedProject, currentModelId, currentProviderId };
};

// --- Sub-components ---

const TaskMetaInfo = ({ status }: { status: string }) => {
    if (status !== 'running' && status !== 'planning') {
        return null;
    }
    return (
        <div className="h-1 w-full bg-blue-950 rounded-full overflow-hidden">
            <div className={cn("h-full animate-shimmer w-[60%]", status === 'planning' ? "bg-purple-500" : "bg-blue-500")} />
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

const TaskTabs = ({ id, activeTab, updateNodeData, planCount, status }: TaskTabsProps) => (
    <div className="flex items-center gap-4 border-b border-white/5 pb-2">
        <button
            onClick={() => updateNodeData(id, { activeTab: 'plan' })}
            className={cn(
                "flex items-center gap-1.5 text-xs font-medium transition-colors pb-1 border-b-2",
                activeTab === 'plan' ? "text-foreground border-purple-500" : "text-muted-foreground border-transparent hover:text-foreground/80"
            )}
        >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Plan</span>
            {planCount ? <span className="text-[10px] bg-white/10 px-1 rounded-full">{planCount}</span> : null}
        </button>
        <button
            onClick={() => updateNodeData(id, { activeTab: 'logs' })}
            className={cn(
                "flex items-center gap-1.5 text-xs font-medium transition-colors pb-1 border-b-2",
                activeTab === 'logs' ? "text-foreground border-blue-500" : "text-muted-foreground border-transparent hover:text-foreground/80"
            )}
        >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console</span>
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground">
            {status === 'planning' ? 'Generating Plan...' : status === 'running' ? 'Executing Task...' : status === 'waiting_for_approval' ? 'Waiting for Approval' : ''}
        </span>
    </div>
);

interface PlanStageProps {
    plan: ProjectStep[];
    status: string;
    onUpdatePlan: (newPlan: ProjectStep[]) => void;
    onRetry: (index: number) => void | Promise<void>;
    planContainerRef: React.RefObject<HTMLDivElement>;
    activeStepRef: React.RefObject<HTMLDivElement>;
}

const PlanStage = ({ plan, status, onUpdatePlan, onRetry, planContainerRef, activeStepRef }: PlanStageProps) => {
    return (
        <div ref={planContainerRef} className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {plan.map((step, idx) => {
                const isRunning = step.status === 'running';
                return (
                    <div
                        key={step.id}
                        ref={isRunning ? activeStepRef : null}
                        className={cn(
                            "flex gap-2 items-start group/step p-1 rounded transition-all",
                            isRunning && "bg-blue-500/10 border border-blue-500/20 ring-1 ring-blue-500/10"
                        )}
                    >
                        <div className="mt-1.5 shrink-0">
                            {step.status === 'completed' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            ) : isRunning ? (
                                <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                            ) : step.status === 'failed' ? (
                                <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                            ) : (
                                <Circle className="w-3.5 h-3.5 text-muted-foreground/30" />
                            )}
                        </div>
                        <div className="flex-1">
                            <textarea
                                className={cn(
                                    "w-full bg-black/10 border border-transparent hover:border-white/10 focus:border-primary/30 rounded px-2 py-1 text-xs text-foreground resize-none focus:outline-none focus:bg-black/30 transition-colors nodrag",
                                    step.status === 'completed' && "text-muted-foreground line-through opacity-50",
                                    isRunning && "text-blue-100"
                                )}
                                value={step.text}
                                onChange={(e) => {
                                    const newPlan = [...plan];
                                    newPlan[idx] = { ...newPlan[idx], text: e.target.value };
                                    onUpdatePlan(newPlan);
                                }}
                                disabled={status === 'running' || step.status === 'completed'}
                            />
                        </div>
                        <button
                            onClick={() => {
                                const newPlan = [...plan];
                                newPlan.splice(idx, 1);
                                onUpdatePlan(newPlan);
                            }}
                            className="mt-1 opacity-0 group-hover/step:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            disabled={status === 'running'}
                        >
                            <X className="w-3 h-3" />
                        </button>
                        {step.status === 'failed' && (
                            <button
                                onClick={() => void onRetry(idx)}
                                className="ml-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                );
            })}
            {(status === 'waiting_for_approval' || status === 'idle') && (
                <button
                    onClick={() => {
                        const newPlan = [...plan];
                        newPlan.push({
                            id: Math.random().toString(36).substr(2, 9),
                            text: "New step",
                            status: 'pending'
                        });
                        onUpdatePlan(newPlan);
                    }}
                    className="w-full py-1 text-[10px] text-muted-foreground hover:text-primary border border-dashed border-white/10 hover:border-primary/30 rounded-md transition-colors"
                >
                    + Add Step
                </button>
            )}
            {!plan.length && status !== 'planning' && (
                <div className="text-center py-8 text-muted-foreground/40 text-xs italic">
                    No plan generated yet. Describe your task and click "Plan".
                </div>
            )}
        </div>
    );
};

const TaskExecutionDetails = ({
    id, data, activeTab, updateNodeData, onRetry, planContainerRef, activeStepRef
}: { id: string; data: TaskNodeData; activeTab: 'plan' | 'logs'; updateNodeData: (id: string, data: Partial<TaskNodeData>) => void; onRetry: (index: number) => void | Promise<void>; planContainerRef: React.RefObject<HTMLDivElement>; activeStepRef: React.RefObject<HTMLDivElement> }) => (
    <div className="pt-2 border-t border-white/5 space-y-2">
        <TaskTabs id={id} activeTab={activeTab} updateNodeData={updateNodeData} planCount={data.plan?.length} status={data.status} />
        {activeTab === 'plan' ? (
            <PlanStage
                plan={data.plan ?? []}
                status={data.status ?? 'idle'}
                onUpdatePlan={(newPlan) => updateNodeData(id, { plan: newPlan })}
                onRetry={onRetry}
                planContainerRef={planContainerRef}
                activeStepRef={activeStepRef}
            />
        ) : (
            <LogConsole logs={data.history ?? []} className="h-[300px]" />
        )}
    </div>
);

const ProgressBar = ({ plan }: { plan: ProjectStep[] }) => {
    const completed = plan.filter(s => s.status === 'completed').length;
    const total = plan.length;
    const percentage = Math.round((completed / Math.max(1, total)) * 100);

    return (
        <div className="px-4 py-2 bg-black/5 border-t border-white/5">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Overall Progress</span>
                <span className="text-[10px] font-mono text-primary">{percentage}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
};

const TaskHeader = ({
    isPlanner, isAction, label, selectedProject, projects,
    selectedProjectId, onProjectSelect, isExpanded, setIsExpanded, onDelete
}: { isPlanner: boolean; isAction: boolean; label: string; selectedProject?: { title: string }; projects: Array<{ id: string; title: string }>; selectedProjectId?: string; onProjectSelect: (id: string) => void; isExpanded: boolean; setIsExpanded: (expanded: boolean) => void; onDelete: () => void }) => (
    <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5 rounded-t-lg">
        <div className="flex items-center gap-2 overflow-hidden">
            <div className={cn(
                "p-1.5 rounded-lg shrink-0",
                isPlanner ? "bg-purple-500/20 text-purple-400" : isAction ? "bg-yellow-500/20 text-yellow-400" : "bg-primary/20 text-primary"
            )}>
                {isPlanner ? <Sparkles className="w-4 h-4" /> : isAction ? <Zap className="w-4 h-4" /> : <Box className="w-4 h-4" />}
            </div>
            {isPlanner ? (
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 text-xs font-medium hover:bg-white/10 px-2 py-1 rounded-md transition-colors truncate max-w-[120px]">
                            <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="truncate">{selectedProject?.title ?? 'Select Project'}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground opacity-50" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-48 p-1 bg-popover/95 backdrop-blur-xl">
                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {projects.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => onProjectSelect(p.id)}
                                    className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors", p.id === selectedProjectId ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-foreground")}
                                >
                                    <span className="truncate">{p.title}</span>
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            ) : <span className="font-semibold text-sm tracking-tight truncate">{label}</span>}
        </div>
        <div className="flex items-center gap-1">
            <button onClick={() => setIsExpanded(!isExpanded)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-white/10">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 rotate-180" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-white/10">
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    </div>
);

const TaskFooterButtons = ({
    status, isPlanner, canRun, onApprove, onStop, onPlan, onExecute
}: {
    status: string; isPlanner: boolean; canRun: boolean;
    onApprove: () => void; onStop: () => void; onPlan: () => void; onExecute: () => void;
}) => {
    if (status === 'waiting_for_approval') {
        return (
            <button onClick={onApprove} className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/30 rounded-lg font-medium transition-all ml-auto">
                <Play className="w-3 h-3 fill-current" />
                <span>Approve & Run</span>
            </button>
        );
    }
    if (status === 'planning' || status === 'running') {
        return (
            <button onClick={onStop} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg font-medium ml-auto transition-colors group/stop">
                <div className="relative">
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin group-hover/stop:opacity-0 transition-opacity absolute inset-0" />
                    <Square className="w-3 h-3 fill-current opacity-0 group-hover/stop:opacity-100 transition-opacity" />
                </div>
                <span>{status === 'planning' ? 'Planning...' : 'Running...'} (Stop)</span>
            </button>
        );
    }
    return (
        <div className="flex items-center gap-2 ml-auto">
            {isPlanner && (
                <button onClick={onPlan} disabled={!canRun} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/30 rounded-lg font-medium transition-all">
                    <Sparkles className="w-3 h-3" />
                    <span>Plan</span>
                </button>
            )}
            <button onClick={onExecute} disabled={!canRun} className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 hover:border-primary/30 rounded-lg font-medium transition-all">
                <Play className="w-3 h-3 fill-current" />
                {isPlanner ? '' : <span>Execute</span>}
            </button>
        </div>
    );
};

const TaskFooterControls = ({
    isPlanner, isModelOpen, systemMode, currentProviderId, currentModelId, groupedModels,
    onModelSelect, onOpenModelChange, onFileClick, onToggleThinking
}: {
    isPlanner: boolean; isModelOpen: boolean; systemMode?: string; currentProviderId: string; currentModelId: string; groupedModels?: GroupedModels;
    onModelSelect: (provider: string, model: string) => void; onOpenModelChange: (open: boolean) => void;
    onFileClick: () => void; onToggleThinking?: () => void;
}) => (
    <>
        {isPlanner ? (
            <div className="flex items-center gap-1">
                <button onClick={onFileClick} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-md transition-colors">
                    <Paperclip className="w-3.5 h-3.5" />
                </button>
                <div className={cn("scale-90 origin-left transition-all", isModelOpen ? "z-50" : "")}>
                    <ModelSelector selectedProvider={currentProviderId} selectedModel={currentModelId} onSelect={onModelSelect} groupedModels={groupedModels} onOpenChange={onOpenModelChange} isIconOnly={true} />
                </div>
            </div>
        ) : <div />}
        <div className="flex items-center gap-2">
            <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-white/10">
                <Settings2 className="w-3.5 h-3.5" />
            </button>
            {isPlanner && (
                <button
                    onClick={onToggleThinking}
                    className={cn(
                        "flex items-center justify-center p-1 rounded-md transition-colors",
                        systemMode === 'thinking' ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                    )}
                    title={systemMode === 'thinking' ? "Thinking Mode: On" : "Thinking Mode: Off"}
                >
                    <Brain className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    </>
);

const TaskFooter = ({
    status, isModelOpen, currentProviderId, currentModelId, groupedModels, onModelSelect, onOpenModelChange,
    onFileClick, onApprove, onStop, onPlan, onExecute, canRun, isPlanner, systemMode, onToggleThinking
}: {
    status: string; isModelOpen: boolean; currentProviderId: string; currentModelId: string; groupedModels?: GroupedModels;
    onModelSelect: (provider: string, model: string) => void; onOpenModelChange: (open: boolean) => void;
    onFileClick: () => void; onApprove: () => void; onStop: () => void; onPlan: () => void; onExecute: () => void;
    canRun: boolean; isPlanner: boolean; systemMode?: string; onToggleThinking?: () => void
}) => (
    <div className="px-3 py-2 bg-black/20 rounded-b-lg border-t border-white/5 flex justify-between items-center text-[10px]">
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
    id, data, updateNodeData
}: { id: string; data: TaskNodeData; updateNodeData: (id: string, data: Partial<TaskNodeData>) => void }) => {
    const removeAttachment = (index: number) => {
        const newAttachments = [...(data.attachments ?? [])];
        newAttachments.splice(index, 1);
        updateNodeData(id, { attachments: newAttachments });
    };

    return (
        <div className="space-y-2">
            <input
                className="w-full bg-transparent border-none p-0 text-sm font-semibold focus:outline-none focus:ring-0"
                placeholder="Task Title (Optional)"
                value={data.title ?? ''}
                onChange={(e) => updateNodeData(id, { title: e.target.value })}
            />
            {data.attachments && data.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {data.attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md text-[10px] text-muted-foreground border border-white/5 group/file">
                            <span className="truncate max-w-[100px]">{file.name}</span>
                            <button onClick={() => removeAttachment(idx)} className="hover:text-destructive opacity-0 group-hover/file:opacity-100 transition-opacity">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <textarea
                className="w-full bg-black/20 border border-white/10 rounded-md p-2 text-xs focus:outline-none focus:border-primary/50 resize-none nodrag"
                placeholder="Describe what you want to build..."
                rows={3}
                value={data.description ?? ''}
                onChange={(e) => updateNodeData(id, { description: e.target.value })}
            />
        </div>
    );
};

const TaskBody = ({
    id, data, isPlanner, isAction, isExpanded, activeTab, updateNodeData, onRetry, planContainerRef, activeStepRef
}: TaskBodyProps) => {
    return (
        <div className="p-4 space-y-3">
            {isPlanner ? (
                <TaskInput id={id} data={data} updateNodeData={updateNodeData} />
            ) : isAction ? (
                <div className="bg-black/20 border border-white/10 rounded-md p-2 text-xs text-muted-foreground">
                    Select an action to execute...
                </div>
            ) : (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {data.description ?? "No description provided."}
                </p>
            )}
            {isPlanner && data.plan && data.plan.length > 0 && <ProgressBar plan={data.plan} />}
            {isExpanded && isPlanner && (
                <TaskExecutionDetails
                    id={id}
                    data={data}
                    activeTab={activeTab}
                    updateNodeData={updateNodeData}
                    onRetry={onRetry}
                    planContainerRef={planContainerRef}
                    activeStepRef={activeStepRef}
                />
            )}
            <TaskMetaInfo status={data.status ?? 'idle'} />
        </div>
    );
};

const getTaskNodeClasses = (isExpanded: boolean, selected: boolean, status: string) => {
    return cn(
        "bg-card/90 backdrop-blur-xl border-2 rounded-xl transition-all duration-300 group shadow-lg",
        isExpanded ? "w-[500px]" : "w-72",
        selected ? "border-primary shadow-primary/20 scale-[1.02]" : "border-border/50 hover:border-primary/50",
        status === 'running' && "border-blue-500 shadow-blue-500/20 animate-pulse",
        status === 'planning' && "border-purple-500 shadow-purple-500/20 animate-pulse",
        status === 'waiting_for_approval' && "border-yellow-500 shadow-yellow-500/20",
        status === 'completed' && "border-green-500 shadow-green-500/20",
        status === 'failed' && "border-red-500 shadow-red-500/20"
    );
};

export const TaskNode = ({ id, data, selected }: NodeProps<Node<TaskNodeData>>) => {
    const { updateNodeData, deleteElements } = useReactFlow();
    const { projects, selectedProject: globalSelectedProject } = useProjectManager();
    const { groupedModels, selectedModel: globalModelId, selectedProvider: globalProviderId } = useModel();

    const {
        activeTab, isExpanded, isModelOpen, isPlanner, isAction,
        selectedProjectId, selectedProject, currentModelId, currentProviderId
    } = useTaskNodeState({ id, data, projects, globalSelectedProject, globalModelId, globalProviderId, updateNodeData });

    const { handlePlan, handleApprove, handleExecute, handleStop, handleRetryStep } = useTaskNodeActions({ id, data, updateNodeData, currentProviderId, currentModelId, selectedProjectId });

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
        const needsExpansion = ['planning', 'waiting_for_approval'].includes(data.status ?? 'idle');
        if (needsExpansion) {
            updateNodeData(id, { isExpanded: true });
        }
    }, [data.status, id, updateNodeData]);

    // Ensure ?? is used instead of || where appropriate for linting
    // Removed unused nodeStatus

    const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const newAttachments = files.map(f => ({
                name: f.name,
                path: (f as { path?: string }).path ?? f.name,
                size: f.size
            }));
            updateNodeData(id, { attachments: [...(data.attachments ?? []), ...newAttachments] });
        }
    }, [id, data.attachments, updateNodeData]);

    return (
        <div className={getTaskNodeClasses(isExpanded, !!selected, data.status ?? 'idle')}>
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background transition-colors hover:!bg-primary" />
            <TaskHeader isPlanner={isPlanner} isAction={isAction} label={data.label} selectedProject={selectedProject} projects={projects} selectedProjectId={selectedProjectId} onProjectSelect={(pid) => updateNodeData(id, { projectId: pid })} isExpanded={isExpanded} setIsExpanded={(expanded) => updateNodeData(id, { isExpanded: expanded })} onDelete={() => void deleteElements({ nodes: [{ id }] })} />

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
                onModelSelect={(provider, model) => void updateNodeData(id, { model: { provider, model } })}
                onOpenModelChange={(open) => void updateNodeData(id, { isModelOpen: open })}
                onFileClick={() => fileInputRef.current?.click()}
                onApprove={() => void handleApprove()}
                onStop={() => void handleStop()}
                onPlan={() => void handlePlan()}
                onExecute={() => void handleExecute()}
                canRun={!!(data.title ?? data.description)}
                systemMode={data.systemMode}
                onToggleThinking={() => updateNodeData(id, { systemMode: data.systemMode === 'thinking' ? 'fast' : 'thinking' })}
            />
            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={(e) => void onFileChange(e)} />
            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background transition-colors hover:!bg-primary" />
        </div>
    );
};
