import { useCallback, useEffect, useMemo, useState } from 'react';

import { Project } from '@/types';

import { ModelOption } from '../components/agent/TaskInputForm';
import { TaskHistoryItem } from '../components/agent/TaskSidebar';

export interface CheckpointItem {
    id: string;
    stepIndex: number;
    trigger?: string;
    createdAt: Date;
}

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
            const result = await window.electron.batch.invoke([
                {
                    channel: 'project-agent:get-task-history',
                    args: [{ projectId: project.path }], // Use project.path instead of project.id
                },
            ]);
            const tasks = result.results[0]
                .data as import('@shared/types/project-agent').AgentTaskHistoryItem[];

            if (Array.isArray(tasks)) {
                const history: TaskHistoryItem[] = tasks.map(task => ({
                    id: task.id,
                    description: task.description,
                    provider: task.provider || 'unknown',
                    model: task.model || 'unknown',
                    status: mapStateToStatus(task.status),
                    createdAt: new Date(task.createdAt),
                    updatedAt: new Date(task.updatedAt),
                    // completedAt is not in AgentTaskHistoryItem yet, need to add or infer
                    completedAt: ['completed', 'failed', 'error'].includes(task.status)
                        ? new Date(task.updatedAt)
                        : undefined,
                    planCount: 0, // Not available in current history item
                    currentPlan: 0, // Not available
                    latestCheckpointId: task.latestCheckpointId,
                    // metrics deliberately omitted for now as they are not in history item
                }));
                setTaskHistory(history);
            }
        } catch (error) {
            window.electron.log.error('Failed to load task history', { error: String(error) });
        }
    }, [project.path]);

    const deleteTask = useCallback(
        async (taskId: string) => {
            try {
                const batchResult = await window.electron.batch.invoke([
                    {
                        channel: 'project-agent:delete-task',
                        args: [{ taskId }],
                    },
                ]);
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
        },
        [loadTaskHistory]
    );

    const getCheckpoints = useCallback(async (taskId: string): Promise<CheckpointItem[]> => {
        try {
            const result = await window.electron.projectAgent.getCheckpoints(taskId);
            return result.map(cp => ({
                ...cp,
                createdAt: new Date(cp.createdAt),
            }));
        } catch (error) {
            window.electron.log.error('Failed to load checkpoints', { error: String(error) });
            return [];
        }
    }, []);

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
        getCheckpoints,
        groupedTasks,
    };
};
