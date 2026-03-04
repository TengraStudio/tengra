/**
 * @fileoverview Hook for managing agent interrupt modal state and model selection
 * @description Provides state and handlers for the agent interrupt flow including
 * modal visibility, feedback input, model override selection, and interrupt submission.
 */
import { useCallback, useEffect, useState } from 'react';

interface UseAgentInterruptProps {
    selectedTaskId: string | null;
}

const getWorkspaceAgentBridge = () => window.electron.projectAgent;

/**
 * Hook for managing agent interrupt modal state and model selection during interrupts
 *
 * @param props Configuration with selectedTaskId
 */
export const useAgentInterrupt = ({ selectedTaskId }: UseAgentInterruptProps) => {
    const [isInterruptModalOpen, setIsInterruptModalOpen] = useState(false);
    const [interruptReason, setInterruptReason] = useState('');

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
        isInterruptModalOpen,
        setIsInterruptModalOpen,
        interruptReason,
        handleModelSelectFromInterrupt
    };
};
