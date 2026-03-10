import { AgentStartOptions } from '@shared/types/automation-workflow';

import { Workspace } from '@/types';

import { AttachedFile, ModelOption } from '../../components/agent/TaskInputForm';

const getAutomationBridge = () => window.electron.session.automation;

interface StartTaskResult {
    success: boolean;
    taskId?: string;
    error?: string;
}

interface StartTaskFile {
    path: string;
    name: string;
    type: string;
    content: string;
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
export const prepareTaskFiles = (attachedFiles: AttachedFile[]): StartTaskFile[] => {
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
    files: StartTaskFile[],
    selectedModel: ModelOption,
    workspace: Workspace
): Promise<StartTaskResult> => {
    try {
        window.electron.log.info('[useAgentTask] startTask called from UI', {
            promptLength: userPrompt.length,
            attachedFiles: files.length,
            selectedModel: selectedModel.model
        });

        window.electron.log.info('[useAgentTask] Invoking workspace task start');

        const options: AgentStartOptions = {
            task: userPrompt,
            workspaceId: workspace.id,
            model: {
                provider: selectedModel.provider,
                model: selectedModel.model
            },
            attachments: files.map(file => ({
                name: file.name,
                path: file.path,
                size: 0
            }))
        };

        const { taskId } = await getAutomationBridge().start(options);
        if (!taskId) {
            return {
                success: false,
                error: 'Task started but taskId was missing'
            };
        }

        return {
            success: true,
            taskId
        };
    } catch (error) {
        window.electron.log.error('Failed to start task:', error as Error);
        return {
            success: false,
            error: 'Failed to start task'
        };
    }
};


