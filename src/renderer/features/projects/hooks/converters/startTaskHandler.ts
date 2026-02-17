import { Project } from '@/types';
import { invokeTypedIpc, type IpcContractMap } from '@renderer/lib/ipc-client';
import { z } from 'zod';

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

type StartTaskIpcContract = IpcContractMap & {
    'project-agent:start-task': {
        args: [StartTaskPayload];
        response: StartTaskResult;
    };
};

const startTaskPayloadSchema: z.ZodType<StartTaskPayload> = z.object({
    projectId: z.string().min(1),
    description: z.string().min(1),
    files: z.array(
        z.object({
            path: z.string(),
            name: z.string(),
            type: z.string(),
            content: z.string()
        })
    ),
    provider: z.string().min(1),
    model: z.string().min(1)
});

const startTaskResultSchema: z.ZodType<StartTaskResult> = z.object({
    success: z.boolean(),
    taskId: z.string().optional(),
    error: z.string().optional()
});

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

        const payload: StartTaskPayload = {
            projectId: project.id,
            description: userPrompt,
            files,
            provider: selectedModel.provider,
            model: selectedModel.model
        };

        const result = await invokeTypedIpc<StartTaskIpcContract, 'project-agent:start-task'>(
            'project-agent:start-task',
            [payload],
            {
                argsSchema: z.tuple([startTaskPayloadSchema]),
                responseSchema: startTaskResultSchema
            }
        );

        return result;
    } catch (error) {
        window.electron.log.error('Failed to start task:', error as Error);
        return {
            success: false,
            error: 'Failed to start task'
        };
    }
};

