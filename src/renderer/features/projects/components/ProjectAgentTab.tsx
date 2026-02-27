import { Bot, ChevronRight } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import type { GroupedModels } from '@/types';
import { Language } from '@/i18n';
import { AppSettings, CodexUsage, Project, QuotaResponse, WorkspaceDashboardTab } from '@/types';

import { useAgentEvents } from '../hooks/useAgentEvents';
import { useAgentHandlers } from '../hooks/useAgentHandlers';
import { useAgentHistory } from '../hooks/useAgentHistory';
import { useAgentTask } from '../hooks/useAgentTask';

import { ModelSelectionModal } from './agent/ModelSelectionModal';
import { StatusIndicators } from './agent/StatusIndicators';
import { TaskExecutionView } from './agent/TaskExecutionView';
import { TaskInputForm } from './agent/TaskInputForm';
import { TaskSidebar } from './agent/TaskSidebar';

interface ProjectAgentTabProps {
    project: Project;
    t: (key: string, options?: Record<string, string | number>) => string;
    activeTab: WorkspaceDashboardTab;
    language: Language;
    groupedModels?: GroupedModels;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    settings?: AppSettings | null;
    selectedProvider?: string;
    selectedModel?: string;
    onSelectModel?: (provider: string, model: string) => void;
}

const EmptyState: React.FC<{ t: (k: string, o?: Record<string, string | number>) => string }> = ({
    t,
}) => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4 opacity-50">
        <Bot className="w-16 h-16 text-primary/40 animate-pulse" />
        <div>
            <h2 className="text-lg font-black uppercase tracking-widest text-foreground">
                {t('agent.autonomousTitle')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t('agent.autonomousDesc')}
            </p>
        </div>
    </div>
);

const CollapsedSidebarButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        onClick={onClick}
        className="w-10 border-r border-border flex flex-col items-center py-4 bg-card/30 hover:bg-card/50 transition-colors group"
    >
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
    </button>
);

export const ProjectAgentTab: React.FC<ProjectAgentTabProps> = ({
    project,
    t,
    language,
    groupedModels,
    quotas,
    codexUsage,
    settings,
    selectedProvider,
    selectedModel: parentSelectedModel,
    onSelectModel,
}) => {
    const {
        status,
        setStatus,
        isLoading,
        setIsLoading,
        selectedTaskId,
        setSelectedTaskId,
        activityLogs,
        setActivityLogs,
        toolExecutions,
        setToolExecutions,
        currentPlan,
        setCurrentPlan,
        startTask,
        pauseTask,
        stopTask,
        saveSnapshot,
        resumeTask,
        resumeFromCheckpoint,
        approvePlan,
        rejectPlan,
        approveStep,
        skipStep,
        editStep,
        addStepComment,
        insertIntervention,
    } = useAgentTask(project);
    const { loadTaskHistory, deleteTask, getCheckpoints, groupedTasks } = useAgentHistory(project);
    const {
        userPrompt,
        setUserPrompt,
        attachedFiles,
        removeAttachedFile,
        expandedProviders,
        isInterruptModalOpen,
        setIsInterruptModalOpen,
        interruptReason,
        handleStart,
        handleFileSelect,
        toggleProvider,
        handleModelSelectFromInterrupt,
    } = useAgentHandlers({ selectedTaskId, startTask });

    useAgentEvents({
        selectedTaskId,
        setStatus,
        setActivityLogs,
        setToolExecutions,
        setCurrentPlan,
        loadTaskHistory,
        currentPlanStepsCount: currentPlan?.steps.length ?? 0,
        setIsLoading,
    });

    const [showHistory, setShowHistory] = useState(true);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    const resetToIdle = useCallback(() => {
        setSelectedTaskId(null);
        setStatus({ taskId: null, state: 'idle', progress: 0, currentStep: '', error: null });
        setActivityLogs([]);
        setToolExecutions([]);
        setCurrentPlan(null);
    }, [setSelectedTaskId, setStatus, setActivityLogs, setToolExecutions, setCurrentPlan]);

    const handleDeleteTask = useCallback(
        (id: string) => {
            setTaskToDelete(id);
        },
        []
    );

    const confirmDeleteTask = useCallback(() => {
        if (!taskToDelete) { return; }
        void (async () => {
            if ((await deleteTask(taskToDelete)) && taskToDelete === selectedTaskId) {
                resetToIdle();
            }
            setTaskToDelete(null);
        })();
    }, [taskToDelete, deleteTask, selectedTaskId, resetToIdle]);

    const selectedModel = useMemo(
        () =>
            selectedProvider && parentSelectedModel
                ? {
                    provider: selectedProvider,
                    model: parentSelectedModel,
                    displayName: parentSelectedModel,
                }
                : null,
        [selectedProvider, parentSelectedModel]
    );

    const handleModelSelect = useCallback(
        (m: { provider: string; model: string } | null) => {
            if (m && onSelectModel) {
                onSelectModel(m.provider, m.model);
            }
        },
        [onSelectModel]
    );

    const handleRollbackCheckpoint = useCallback(
        (checkpointId: string) => {
            void (async () => {
                try {
                    setIsLoading(true);
                    const result =
                        await window.electron.projectAgent.rollbackCheckpoint(checkpointId);
                    if (result.success) {
                        setSelectedTaskId(result.taskId);
                        await loadTaskHistory();
                    }
                } catch (error) {
                    window.electron.log.error('Failed to rollback checkpoint', error as Error);
                } finally {
                    setIsLoading(false);
                }
            })();
        },
        [loadTaskHistory, setIsLoading, setSelectedTaskId]
    );

    return (
        <div className="h-full flex bg-card/20 rounded-xl border border-border overflow-hidden">
            {showHistory ? (
                <TaskSidebar
                    groupedTasks={groupedTasks}
                    expandedProviders={expandedProviders}
                    toggleProvider={toggleProvider}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={setSelectedTaskId}
                    onDeleteTask={handleDeleteTask}
                    onResumeTask={id => {
                        void resumeTask(id);
                    }}
                    onResumeCheckpoint={id => {
                        void resumeFromCheckpoint(id);
                    }}
                    onRollbackCheckpoint={handleRollbackCheckpoint}
                    getCheckpoints={getCheckpoints}
                    onCloseSidebar={() => setShowHistory(false)}
                    onNewTask={resetToIdle}
                    t={t}
                />
            ) : (
                <CollapsedSidebarButton onClick={() => setShowHistory(true)} />
            )}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background/50">
                {selectedTaskId ? (
                    <>
                        <StatusIndicators
                            state={status.state}
                            progress={status.progress}
                            currentStep={status.currentStep}
                            error={status.error}
                            metrics={status.metrics}
                            t={t}
                        />
                        <div className="flex-1 min-h-0 p-4">
                            <TaskExecutionView
                                activityLogs={activityLogs}
                                toolExecutions={toolExecutions}
                                currentPlan={currentPlan}
                                scrollEndRef={scrollEndRef}
                                awaitingApproval={status.state === 'waiting_approval'}
                                onApprovePlan={() => {
                                    if (selectedTaskId) {
                                        void approvePlan(selectedTaskId);
                                    }
                                }}
                                onRejectPlan={() => {
                                    if (selectedTaskId) {
                                        void rejectPlan(selectedTaskId);
                                    }
                                }}
                                onApproveStep={stepId => {
                                    if (selectedTaskId) {
                                        void approveStep(selectedTaskId, stepId);
                                    }
                                }}
                                onSkipStep={stepId => {
                                    if (selectedTaskId) {
                                        void skipStep(selectedTaskId, stepId);
                                    }
                                }}
                                onEditStep={(stepId, text) => {
                                    if (selectedTaskId) {
                                        void editStep(selectedTaskId, stepId, text);
                                    }
                                }}
                                onAddComment={(stepId, comment) => {
                                    if (selectedTaskId) {
                                        void addStepComment(selectedTaskId, stepId, comment);
                                    }
                                }}
                                onInsertIntervention={afterStepId => {
                                    if (selectedTaskId) {
                                        void insertIntervention(selectedTaskId, afterStepId);
                                    }
                                }}
                                t={t}
                            />
                        </div>
                    </>
                ) : (
                    <EmptyState t={t} />
                )}
                <TaskInputForm
                    userPrompt={userPrompt}
                    setUserPrompt={setUserPrompt}
                    isLoading={isLoading}
                    attachedFiles={attachedFiles}
                    removeFile={removeAttachedFile}
                    onStartTask={() => {
                        void handleStart(selectedModel);
                    }}
                    onPauseTask={() => {
                        if (selectedTaskId) {
                            void pauseTask(selectedTaskId);
                        }
                    }}
                    onResumeTask={() => {
                        if (selectedTaskId) {
                            void resumeTask(selectedTaskId);
                        }
                    }}
                    onStopTask={() => {
                        if (selectedTaskId) {
                            void stopTask(selectedTaskId);
                        }
                    }}
                    onSaveSnapshot={() => {
                        if (selectedTaskId) {
                            void saveSnapshot(selectedTaskId);
                        }
                    }}
                    onFileSelect={e => handleFileSelect(e, fileInputRef)}
                    fileInputRef={fileInputRef}
                    selectedModel={selectedModel}
                    setSelectedModel={handleModelSelect}
                    modelDropdownRef={modelDropdownRef}
                    agentState={status.state}
                    taskId={selectedTaskId}
                    t={t}
                    groupedModels={groupedModels}
                    quotas={quotas}
                    codexUsage={codexUsage}
                    settings={settings}
                    selectedProvider={selectedProvider}
                    parentSelectedModel={parentSelectedModel}
                    onSelectModel={onSelectModel}
                />
            </div>
            <ModelSelectionModal
                isOpen={isInterruptModalOpen}
                onClose={() => setIsInterruptModalOpen(false)}
                reason={interruptReason}
                language={language}
                onSelect={(p, m) => {
                    void handleModelSelectFromInterrupt(p, m);
                }}
            />
            <ConfirmationModal
                isOpen={!!taskToDelete}
                onClose={() => setTaskToDelete(null)}
                onConfirm={confirmDeleteTask}
                title="Delete Task"
                message="Are you sure you want to delete this task? This action cannot be undone."
                confirmLabel="Delete"
                variant="danger"
            />
        </div>
    );
};
