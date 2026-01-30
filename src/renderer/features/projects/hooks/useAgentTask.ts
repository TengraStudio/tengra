import { AgentEventRecord } from '@shared/types/agent-state';
import { useCallback, useEffect, useState } from 'react';

import { Project } from '@/types';

import { ActivityLog } from '../components/agent/ActivityStream';
import { ExecutionPlan } from '../components/agent/ExecutionPlanView';
import { AttachedFile, ModelOption } from '../components/agent/TaskInputForm';
import { ToolExecution } from '../components/agent/ToolTracking';

/**
 * Convert AgentEventRecord to ActivityLog for UI display
 */
const convertEventToActivityLog = (event: AgentEventRecord): ActivityLog | null => {
    const baseLog = {
        id: event.id,
        timestamp: event.timestamp
    };

    // Type narrowing helper
    const getPayload = <T>(): T => event.payload as T;

    switch (event.type) {
        case 'LLM_REQUEST':
            return {
                ...baseLog,
                type: 'llm',
                message: `🤖 Sending request to ${getPayload<{ provider: string }>().provider || 'LLM'}...`
            };
        case 'LLM_RESPONSE': {
            const payload = getPayload<{ response: { content?: string; thoughts?: string } }>();
            return {
                ...baseLog,
                type: 'llm',
                message: payload.response?.content ?? 'Received response from LLM',
                details: payload.response?.thoughts
            };
        }
        case 'TOOL_START': {
            const payload = getPayload<{ toolCall: { toolName: string } }>();
            return {
                ...baseLog,
                type: 'tool',
                message: `🔧 Running tool: ${payload.toolCall?.toolName ?? 'unknown'}`
            };
        }
        case 'TOOL_COMPLETE': {
            const payload = getPayload<{ toolCallId: string; duration: number }>();
            return {
                ...baseLog,
                type: 'success',
                message: `✓ Tool completed`,
                details: payload.duration ? `Duration: ${payload.duration}ms` : undefined
            };
        }
        case 'TOOL_ERROR': {
            const payload = getPayload<{ toolCallId: string; error: { message?: string } }>();
            return {
                ...baseLog,
                type: 'error',
                message: `✗ Tool failed`,
                details: payload.error?.message
            };
        }
        case 'LLM_ERROR': {
            const payload = getPayload<{ error: { message?: string } }>();
            return {
                ...baseLog,
                type: 'error',
                message: `Error: ${payload.error?.message ?? 'Unknown error'}`
            };
        }
        case 'ROTATE_PROVIDER': {
            const payload = getPayload<{ fromProvider: string; toProvider: string }>();
            return {
                ...baseLog,
                type: 'info',
                message: `Switched provider: ${payload.fromProvider ?? '?'} → ${payload.toProvider ?? '?'}`
            };
        }
        case 'TASK_FAILED': {
            const payload = getPayload<{ error: string }>();
            return {
                ...baseLog,
                type: 'error',
                message: `Task failed: ${payload.error}`
            };
        }
        case 'TASK_COMPLETE': {
            const payload = getPayload<{ summary: string }>();
            return {
                ...baseLog,
                type: 'success',
                message: `Task completed: ${payload.summary}`
            };
        }
        case 'PLAN_READY':
            return {
                ...baseLog,
                type: 'success',
                message: '✓ Execution plan created'
            };
        default:
            // Don't log internal state transitions like TASK_VALIDATED, EXECUTE_STEP, etc.
            return null;
    }
};

export interface AgentTaskStatus {
    taskId: string | null;
    state: string;
    progress: number;
    currentStep?: string;
    error?: string | null;
    metrics?: {
        tokensUsed?: number;
        llmCalls?: number;
        toolCalls?: number;
        estimatedCost?: number;
    };
}

/**
 * Hook for managing agent task execution and state
 *
 * @param project The active project
 */
export const useAgentTask = (project: Project) => {
    const [status, setStatus] = useState<AgentTaskStatus>({
        taskId: null,
        state: 'idle',
        progress: 0,
        currentStep: '',
        error: null
    });
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
    const [currentPlan, setCurrentPlan] = useState<ExecutionPlan | null>(null);

    const startTask = useCallback(async (userPrompt: string, attachedFiles: AttachedFile[], selectedModel: ModelOption | null) => {
        window.electron.log.info('[useAgentTask] startTask called from UI', {
            promptLength: userPrompt.length,
            attachedFiles: attachedFiles.length,
            selectedModel: selectedModel?.model
        });

        if (!userPrompt.trim()) {
            console.warn('[Renderer] startTask aborted: empty prompt');
            return null;
        }

        if (!selectedModel) {
            window.electron.log.error('[useAgentTask] ABORT: No model selected');
            return null;
        }

        setIsLoading(true); // Keep this for now, as setAgentState is not defined in the original code
        try {
            const agentFiles = attachedFiles.map(f => ({
                path: f.path,
                name: f.name,
                type: f.type,
                content: ''
            }));

            // The instruction provided `setAgentState`, `setLogs`, `setTools`, `setFullPlan`
            // which are not defined in the original code.
            // Assuming these are intended to replace existing state setters,
            // I will map them to the existing ones for a syntactically correct result.
            // setAgentState('initializing'); // Replaced by setStatus
            // setLogs([]); // Replaced by setActivityLogs
            // setTools([]); // Replaced by setToolExecutions
            // setFullPlan([]); // Replaced by setCurrentPlan

            setStatus(prev => ({ ...prev, state: 'initializing' }));
            setActivityLogs([]);
            setToolExecutions([]);
            setCurrentPlan(null);

            window.electron.log.info('[useAgentTask] Invoking project-agent:start-task');

            const result = await window.electron.ipcRenderer.invoke('project-agent:start-task', {
                projectId: project.id,
                description: userPrompt,
                files: agentFiles,
                provider: selectedModel?.provider,
                model: selectedModel?.model
            }) as { success: boolean; taskId?: string; error?: string };
            // Result is already unwrapped from direct invoke
            if (result.success) {
                const taskId = result.taskId ?? null;
                setStatus(prev => ({ ...prev, taskId, state: 'initializing', error: null, progress: 0 }));
                setSelectedTaskId(taskId);
                setActivityLogs([]);
                setToolExecutions([]);
                setCurrentPlan(null);
                return taskId;
            } else {
                setStatus(prev => ({ ...prev, error: result.error ?? 'Failed to start task' }));
                return null;
            }
        } catch (error) {
            window.electron.log.error('Failed to start task:', error as Error);
            setStatus(prev => ({ ...prev, error: 'Failed to start task' }));
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [project.id]);

    const pauseTask = useCallback(async (taskId: string) => {
        try {
            await window.electron.ipcRenderer.invoke('project-agent:pause-task', { taskId });
            setStatus(prev => ({ ...prev, state: 'paused' }));
        } catch (error) {
            window.electron.log.error('Failed to pause task:', error as Error);
        }
    }, []);

    const stopTask = useCallback(async (taskId: string) => {
        try {
            await window.electron.ipcRenderer.invoke('project-agent:stop-task', { taskId });
            // Don't clear selectedTaskId - keep task selected to show stopped state
            // The UI will update via events when task is stopped
            setStatus(prev => ({ ...prev, state: 'stopped', error: 'Task stopped by user' }));
        } catch (error) {
            window.electron.log.error('Failed to stop task:', error as Error);
        }
    }, []);

    const saveSnapshot = useCallback(async (taskId: string) => {
        try {
            await window.electron.ipcRenderer.invoke('project-agent:save-snapshot', { taskId });
            return true;
        } catch (error) {
            window.electron.log.error('Failed to save snapshot:', error as Error);
            return false;
        }
    }, []);

    const loadTaskDetails = useCallback(async (taskId: string) => {
        setIsLoading(true);
        try {
            // Load status, messages, events, and telemetry in parallel
            const [statusRes, messagesRes, eventsRes, telemetryRes] = await Promise.all([
                window.electron.ipcRenderer.invoke('project-agent:get-status', { taskId }),
                window.electron.ipcRenderer.invoke('project-agent:get-messages', { taskId }),
                window.electron.ipcRenderer.invoke('project-agent:get-events', { taskId }),
                window.electron.ipcRenderer.invoke('project-agent:get-telemetry', { taskId })
            ]);

            if (statusRes.success && statusRes.status) {
                const s = statusRes.status;
                const currentStepIdx = s.currentStep ?? 0;
                const totalSteps = s.plan?.steps?.length ?? s.totalSteps ?? 1;
                setStatus({
                    taskId: s.taskId,
                    state: s.state,
                    progress: Math.round((currentStepIdx / totalSteps) * 100),
                    currentStep: s.plan?.steps?.[currentStepIdx]?.description ?? '',
                    error: s.error,
                    metrics: s.metrics
                });
                // Transform backend ExecutionPlan to UI ExecutionPlan format
                if (s.plan?.steps) {
                    const uiPlan: ExecutionPlan = {
                        id: taskId,
                        taskId: s.taskId,
                        planNumber: 1,
                        status: s.state === 'completed' ? 'completed' : s.state === 'failed' ? 'failed' : 'executing',
                        steps: s.plan.steps.map((step: { index?: number; description?: string; status?: string }, idx: number) => ({
                            id: String(step.index ?? idx),
                            description: step.description ?? `Step ${idx + 1}`,
                            status: (step.status || 'pending') as 'pending' | 'executing' | 'completed' | 'failed'
                        })),
                        currentStep: currentStepIdx,
                        createdAt: s.createdAt ? new Date(s.createdAt) : new Date()
                    };
                    setCurrentPlan(uiPlan);
                }
            }

            // Convert event history to activity logs
            const eventLogs: ActivityLog[] = [];
            if (eventsRes.success && eventsRes.events) {
                for (const event of eventsRes.events) {
                    const log = convertEventToActivityLog(event);
                    if (log) {
                        eventLogs.push(log);
                    }
                }
            }

            // Add message-based logs (for backwards compatibility)
            if (messagesRes.success && messagesRes.messages) {
                const messageLogs: ActivityLog[] = messagesRes.messages.map((m: { id: string; role: string; content: string; timestamp: Date | string }) => ({
                    id: m.id,
                    type: m.role === 'assistant' ? 'llm' : 'info',
                    message: m.content,
                    timestamp: new Date(m.timestamp)
                }));
                eventLogs.push(...messageLogs);
            }

            // Sort all logs by timestamp and set
            eventLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            setActivityLogs(eventLogs);

            if (telemetryRes.success && telemetryRes.telemetry) {
                const executions: ToolExecution[] = telemetryRes.telemetry.map((t: { toolCallId: string; toolName: string; success: boolean; startTime: Date | string; endTime: Date | string | null; duration: number; error?: string }) => ({
                    id: t.toolCallId,
                    name: t.toolName,
                    status: t.success ? 'completed' : 'error',
                    startTime: new Date(t.startTime),
                    endTime: t.endTime ? new Date(t.endTime) : undefined,
                    duration: t.duration,
                    error: t.error
                }));
                setToolExecutions(executions);
            }
        } catch (error) {
            window.electron.log.error('Failed to load task details:', error as Error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedTaskId) {
            void loadTaskDetails(selectedTaskId);
        }
    }, [selectedTaskId, loadTaskDetails]);

    const resumeTask = useCallback(async (taskId: string) => {
        setIsLoading(true);
        // Immediately update status to show we're resuming
        setStatus(prev => ({ ...prev, state: 'initializing', error: null }));
        try {
            const result = await window.electron.ipcRenderer.invoke('project-agent:resume-task', { taskId }) as { success: boolean; error?: string };
            if (result.success) {
                setSelectedTaskId(taskId);
                // Don't call loadTaskDetails - the event system will update the UI
                return true;
            }
            // If failed, revert to previous state
            setStatus(prev => ({ ...prev, state: 'failed', error: result.error ?? 'Failed to resume' }));
            return false;
        } catch (error) {
            window.electron.log.error('Failed to resume task:', error as Error);
            setStatus(prev => ({ ...prev, state: 'failed', error: 'Failed to resume task' }));
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const approvePlan = useCallback(async (taskId: string) => {
        try {
            const result = await window.electron.ipcRenderer.invoke('project-agent:approve-plan', { taskId }) as { success: boolean; error?: string };
            if (!result.success) {
                window.electron.log.error('Failed to approve plan:', result.error);
            }
            return result.success;
        } catch (error) {
            window.electron.log.error('Failed to approve plan:', error as Error);
            return false;
        }
    }, []);

    const rejectPlan = useCallback(async (taskId: string, reason?: string) => {
        try {
            const result = await window.electron.ipcRenderer.invoke('project-agent:reject-plan', { taskId, reason }) as { success: boolean; error?: string };
            if (!result.success) {
                window.electron.log.error('Failed to reject plan:', result.error);
            }
            return result.success;
        } catch (error) {
            window.electron.log.error('Failed to reject plan:', error as Error);
            return false;
        }
    }, []);

    return {
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
        approvePlan,
        rejectPlan,
        loadTaskDetails
    };
};
