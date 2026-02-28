/**
 * @fileoverview Hook for managing agent task form state and file attachments
 * @description Provides state management for the agent task input form including
 * prompt text, model selection, file attachments with preview URLs, and form submission.
 */
import { useCallback, useState } from 'react';

import { AttachedFile, ModelOption } from '../components/agent/TaskInputForm';

import { useFilePreviewUrl } from './useFilePreviewUrl';

interface UseAgentTaskFormProps {
    startTask: (userPrompt: string, attachedFiles: AttachedFile[], selectedModel: ModelOption | null) => Promise<string | null>;
}

/**
 * Hook for managing agent task form state and file attachments
 *
 * @param props Configuration with startTask callback
 */
export const useAgentTaskForm = ({ startTask }: UseAgentTaskFormProps) => {
    const [userPrompt, setUserPrompt] = useState('');

    const {
        attachedFiles,
        setAttachedFiles,
        removeAttachedFile,
        clearAttachedFiles,
        handleFileSelect
    } = useFilePreviewUrl();

    const handleStart = useCallback(async (selectedModel: ModelOption | null) => {
        if (!selectedModel) {
            return;
        }

        const taskId = await startTask(userPrompt, attachedFiles, selectedModel);
        if (taskId) {
            setUserPrompt('');
            clearAttachedFiles();
        }
    }, [userPrompt, attachedFiles, startTask, clearAttachedFiles]);

    return {
        userPrompt,
        setUserPrompt,
        attachedFiles,
        setAttachedFiles,
        removeAttachedFile,
        handleStart,
        handleFileSelect
    };
};
