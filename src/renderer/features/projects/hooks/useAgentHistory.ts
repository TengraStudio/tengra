import { useCallback, useEffect, useMemo, useState } from 'react';

import { Project } from '@/types';

import { ModelOption } from '../components/agent/TaskInputForm';
import { TaskHistoryItem } from '../components/agent/TaskSidebar';

// Helper to map agent state to UI status
const mapStateToStatus = (state: string): TaskHistoryItem['status'] => {
    switch (state) {
        case 'completed':
            return 'completed';
        case 'failed':
            return 'failed';
        case 'paused':
            return 'paused';
        case 'waiting_user':
            return 'paused'; // Interrupted looks like paused
        default:
            return 'running';
    }
};

export const useAgentHistory = (project: Project) => {
    const [taskHistory, setTaskHistory] = useState<TaskHistoryItem[]>([]);

    const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);

    const loadTaskHistory = useCallback(async () => {
        try {
            const result = await window.electron.batch.invoke([{
                channel: 'project-agent:get-task-history',
                args: [{ projectId: project.id }]
            }]);
            const data = result.results[0].data as {
                success: boolean; tasks?: Array<{
                    taskId: string;
                    description: string;
                    state: string;
                    currentStep: number;
                    totalSteps: number;
                    currentProvider: { provider: string; model: string };
                    createdAt: string;
                    updatedAt: string;
                    completedAt?: string;
                    metrics: {
                        tokensUsed: number;
                        llmCalls: number;
                        toolCalls: number;
                        estimatedCost: number;
                    };
                }>
            };
            if (data.success && data.tasks) {
                const history: TaskHistoryItem[] = data.tasks.map(task => ({
                    id: task.taskId,
                    description: task.description,
                    provider: task.currentProvider.provider,
                    model: task.currentProvider.model,
                    status: mapStateToStatus(task.state),
                    createdAt: new Date(task.createdAt),
                    updatedAt: new Date(task.updatedAt),
                    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
                    planCount: task.totalSteps,
                    currentPlan: task.currentStep,
                    metrics: task.metrics
                }));
                setTaskHistory(history);
            }
        } catch (error) {
            window.electron.log.error('Failed to load task history', { error: String(error) });
        }
    }, [project.id]);

    const deleteTask = useCallback(async (taskId: string) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm('Are you sure you want to delete this task?')) {
            return false;
        }
        try {
            const batchResult = await window.electron.batch.invoke([{
                channel: 'project-agent:delete-task',
                args: [{ taskId }]
            }]);
            const result = batchResult.results[0].data as { success: boolean; error?: string };
            if (result.success) {
                await loadTaskHistory();
                return true;
            }
            return false;
        } catch (error) {
            window.electron.log.error('Failed to delete task', { error: String(error) });
            return false;
        }
    }, [loadTaskHistory]);

    const groupedTasks = useMemo(() => {
        const grouped: Record<string, TaskHistoryItem[]> = {};
        taskHistory.forEach(task => {
            grouped[task.provider] ??= [];
            grouped[task.provider].push(task);
        });
        return grouped;
    }, [taskHistory]);

    useEffect(() => {
        const initialize = async () => {
            await loadTaskHistory();
        };
        void initialize();
    }, [loadTaskHistory]);

    return {
        selectedModel,
        setSelectedModel,
        loadTaskHistory,
        deleteTask,
        groupedTasks
    };
};
