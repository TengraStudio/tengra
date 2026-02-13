import { Project } from '@/types';

import { AttachedFile, ModelOption } from '../../components/agent/TaskInputForm';

interface StartTaskPayload {
    projectId: string;
    description: string;
    files: Array<{
        path: string;
        name: string;
        type: string;
        content: string;
    }>;
    provider: string;
    model: string;
}

interface StartTaskResult {
    success: boolean;
    taskId?: string;
    error?: string;
}

/**
 * Validate user input for starting a task
 */
export const validateTaskInput = (userPrompt: string, selectedModel: ModelOption | null): string | null => {
    if (!userPrompt.trim()) {
        window.electron.log.warn('[Renderer] startTask aborted: empty prompt');
        return 'Prompt is empty';
    }

    if (!selectedModel) {
        window.electron.log.error('[useAgentTask] ABORT: No model selected');
        return 'No model selected';
    }

    return null;
};

/**
 * Prepare files for task execution
 */
export const prepareTaskFiles = (attachedFiles: AttachedFile[]): StartTaskPayload['files'] => {
    return attachedFiles.map((f) => ({
        path: f.path,
        name: f.name,
        type: f.type,
        content: ''
    }));
};

/**
 * Invoke the start-task IPC command
 */
export const invokeStartTask = async (
    userPrompt: string,
    files: StartTaskPayload['files'],
    selectedModel: ModelOption,
    project: Project
): Promise<StartTaskResult> => {
    try {
        window.electron.log.info('[useAgentTask] startTask called from UI', {
            promptLength: userPrompt.length,
            attachedFiles: files.length,
            selectedModel: selectedModel.model
        });

        window.electron.log.info('[useAgentTask] Invoking project-agent:start-task');

        const result = (await window.electron.ipcRenderer.invoke('project-agent:start-task', {
            projectId: project.id,
            description: userPrompt,
            files,
            provider: selectedModel.provider,
            model: selectedModel.model
        })) as StartTaskResult;

        return result;
    } catch (error) {
        window.electron.log.error('Failed to start task:', error as Error);
        return {
            success: false,
            error: 'Failed to start task'
        };
    }
};

