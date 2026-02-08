import { useCallback, useEffect, useState } from 'react';

import { Project } from '@/types';

import { ActivityLog } from '../components/agent/ActivityStream';
import { ExecutionPlan } from '../components/agent/ExecutionPlanView';
import { AttachedFile, ModelOption } from '../components/agent/TaskInputForm';
import { ToolExecution } from '../components/agent/ToolTracking';

import {
    approvePlanHandler,
    fetchTaskDetailsHandler,
    pauseTaskHandler,
    rejectPlanHandler,
    resumeTaskHandler,
    resumeCheckpointHandler,
    saveSnapshotHandler,
    stopTaskHandler
} from './converters/asyncHandlers';
import { invokeStartTask, prepareTaskFiles, validateTaskInput } from './converters/startTaskHandler';
import {
    combineAndSortLogs,
    processEventResponse,
    processMessageResponse,
    processStatusResponse,
    processTelemetryResponse
} from './converters/taskDetailsProcessor';

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
 * @param {Project} project The active project
 * @returns {object} The agent task state and handlers
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
        // Validate input
        const validationError = validateTaskInput(userPrompt, selectedModel);
        if (validationError) {
            return null;
        }

        setIsLoading(true);
        try {
            // Prepare files
            const agentFiles = prepareTaskFiles(attachedFiles);

            // Clear previous state
            setStatus(prev => ({ ...prev, state: 'initializing' }));
            setActivityLogs([]);
            setToolExecutions([]);
            setCurrentPlan(null);

            // Invoke the start task command (selectedModel is validated above)
            const result = await invokeStartTask(userPrompt, agentFiles, selectedModel as ModelOption, project);

            if (result.success) {
                const taskId = result.taskId ?? null;
                setStatus(prev => ({ ...prev, taskId, state: 'initializing', error: null, progress: 0 }));
                setSelectedTaskId(taskId);
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
    }, [project]);

    const pauseTask = useCallback(async (taskId: string) => {
        try {
            await pauseTaskHandler(taskId);
            setStatus(prev => ({ ...prev, state: 'paused' }));
        } catch (error) {
            window.electron.log.error('Failed to pause task:', error as Error);
        }
    }, []);

    const stopTask = useCallback(async (taskId: string) => {
        try {
            await stopTaskHandler(taskId);
            // Don't clear selectedTaskId - keep task selected to show stopped state
            // The UI will update via events when task is stopped
            setStatus(prev => ({ ...prev, state: 'stopped', error: 'Task stopped by user' }));
        } catch (error) {
            window.electron.log.error('Failed to stop task:', error as Error);
        }
    }, []);

    const saveSnapshot = useCallback(async (taskId: string) => {
        try {
            return await saveSnapshotHandler(taskId);
        } catch (error) {
            window.electron.log.error('Failed to save snapshot:', error as Error);
            return false;
        }
    }, []);

    const loadTaskDetails = useCallback(async (taskId: string) => {
        setIsLoading(true);
        try {
            // Fetch all task details in parallel
            const { statusRes, messagesRes, eventsRes, telemetryRes } = await fetchTaskDetailsHandler(taskId);

            // Process status and get execution plan
            const statusData = processStatusResponse(statusRes);
            setStatus({
                taskId: statusData.taskId,
                state: statusData.state,
                progress: statusData.progress,
                currentStep: statusData.currentStep,
                error: statusData.error,
                metrics: statusData.metrics
            });

            if (statusData.currentPlan) {
                setCurrentPlan(statusData.currentPlan);
            }

            // Process events and messages into activity logs
            const eventLogs = processEventResponse(eventsRes);
            const messageLogs = processMessageResponse(messagesRes);
            const allLogs = combineAndSortLogs(eventLogs, messageLogs);
            setActivityLogs(allLogs);

            // Process telemetry into tool executions
            const executions = processTelemetryResponse(telemetryRes);
            setToolExecutions(executions);
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
            const result = await resumeTaskHandler(taskId);
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
        return await approvePlanHandler(taskId);
    }, []);

    const rejectPlan = useCallback(async (taskId: string, reason?: string) => {
        return await rejectPlanHandler(taskId, reason);
    }, []);

    const resumeFromCheckpoint = useCallback(async (checkpointId: string) => {
        setIsLoading(true);
        setStatus(prev => ({ ...prev, state: 'initializing', error: null }));
        try {
            const result = await resumeCheckpointHandler(checkpointId);
            if (result.success) {
                // TaskId will be updated by events, but we can't set it easily here without the task ID
                // The backend resumeFromCheckpoint sets the task as active, so we should receive events.
                return true;
            }
            setStatus(prev => ({ ...prev, state: 'failed', error: result.error ?? 'Failed to resume checkpoint' }));
            return false;
        } catch (error) {
            window.electron.log.error('Failed to resume checkpoint:', error as Error);
            setStatus(prev => ({ ...prev, state: 'failed', error: 'Failed to resume checkpoint' }));
            return false;
        } finally {
            setIsLoading(false);
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
        resumeFromCheckpoint,
        loadTaskDetails
    };
};
