import { useCallback, useEffect, useState } from 'react';

import { AttachedFile, ModelOption } from '../components/agent/TaskInputForm';

import { useFilePreviewUrl } from './useFilePreviewUrl';

const getWorkspaceAgentBridge = () => window.electron.projectAgent;

interface UseAgentHandlersProps {
    selectedTaskId: string | null;
    startTask: (userPrompt: string, attachedFiles: AttachedFile[], selectedModel: ModelOption | null) => Promise<string | null>;
}

/**
 * Hook for handling agent-related UI interactions
 *
 * @param props Configuration properties
 */
export const useAgentHandlers = ({
    selectedTaskId,
    startTask
}: UseAgentHandlersProps) => {
    const [userPrompt, setUserPrompt] = useState('');
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
    const [isInterruptModalOpen, setIsInterruptModalOpen] = useState(false);
    const [interruptReason, setInterruptReason] = useState('');

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

    const toggleProvider = useCallback((provider: string) => {
        setExpandedProviders(prev => {
            const next = new Set(prev);
            if (next.has(provider)) {
                next.delete(provider);
            } else {
                next.add(provider);
            }
            return next;
        });
    }, []);

    const handleModelSelectFromInterrupt = useCallback(async (provider: string, model: string) => {
        if (!selectedTaskId) {
            return;
        }
        try {
            const result = await getWorkspaceAgentBridge().selectModel({
                taskId: selectedTaskId,
                provider,
                model
            });
            if (result.success) {
                setIsInterruptModalOpen(false);
            }
        } catch (error) {
            window.electron.log.error('Failed to select model:', error as Error);
        }
    }, [selectedTaskId]);

    useEffect(() => {
        const unsubscribe = window.electron.onAgentEvent((payload: unknown) => {
            // SAFETY: We expect this specific shape from the agent event bus for interrupts.
            // If the payload doesn't match, the optional chaining will safely ignore it.
            const typedPayload = payload as { type?: string; data?: { taskId?: string; reason?: string } };
            if (typedPayload?.type === 'agent:interrupt_required' && typedPayload?.data?.taskId === selectedTaskId) {
                setInterruptReason(typedPayload.data.reason ?? 'Manual intervention required');
                setIsInterruptModalOpen(true);
            }
        });
        return () => {
            unsubscribe();
        };
    }, [selectedTaskId]);

    return {
        userPrompt, setUserPrompt,
        attachedFiles, setAttachedFiles,
        removeAttachedFile,
        showModelDropdown, setShowModelDropdown,
        expandedProviders,
        isInterruptModalOpen, setIsInterruptModalOpen,
        interruptReason,
        handleStart,
        handleFileSelect,
        toggleProvider,
        handleModelSelectFromInterrupt
    };
};
