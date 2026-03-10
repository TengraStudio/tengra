import { useCallback, useEffect, useMemo, useState } from 'react';

import { Workspace } from '@/types';

import { ModelOption } from '../components/agent/TaskInputForm';
import { TaskHistoryItem } from '../components/agent/TaskSidebar';

const getAutomationBridge = () => window.electron.session.automation;

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

export const useAgentHistory = (workspace: Workspace) => {
    const [taskHistory, setTaskHistory] = useState<TaskHistoryItem[]>([]);

    const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);

    const loadTaskHistory = useCallback(async () => {
        try {
            const tasks = await getAutomationBridge().getTaskHistory(workspace.path);

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
    }, [workspace.path]);

    const deleteTask = useCallback(
        async (taskId: string) => {
            try {
                const result = await getAutomationBridge().deleteTask(taskId);
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
            const result = await getAutomationBridge().getCheckpoints(taskId);
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
