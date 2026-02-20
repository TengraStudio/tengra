import { useCallback, useEffect, useRef, useState } from 'react';

import { AttachedFile, ModelOption } from '../components/agent/TaskInputForm';

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
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
    const [isInterruptModalOpen, setIsInterruptModalOpen] = useState(false);
    const [interruptReason, setInterruptReason] = useState('');
    const attachedFilesRef = useRef<AttachedFile[]>([]);

    const revokePreviewUrl = useCallback((file: AttachedFile) => {
        if (file.preview?.startsWith('blob:')) {
            URL.revokeObjectURL(file.preview);
        }
    }, []);

    const createAttachmentId = useCallback(() => {
        if (typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return Math.random().toString(36);
    }, []);

    const clearAttachedFiles = useCallback(() => {
        setAttachedFiles(prev => {
            prev.forEach(revokePreviewUrl);
            return [];
        });
    }, [revokePreviewUrl]);

    const removeAttachedFile = useCallback((id: string) => {
        setAttachedFiles(prev => {
            const fileToRemove = prev.find(file => file.id === id);
            if (fileToRemove) {
                revokePreviewUrl(fileToRemove);
            }
            return prev.filter(file => file.id !== id);
        });
    }, [revokePreviewUrl]);

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

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, fileInputRef: React.RefObject<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) {
            return;
        }

        const newFiles: AttachedFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isImage = file.type.startsWith('image/');
            newFiles.push({
                id: createAttachmentId(),
                name: file.name,
                path: (file as { path?: string }).path ?? '',
                type: isImage ? 'image' : 'file',
                size: file.size,
                preview: isImage ? URL.createObjectURL(file) : undefined
            });
        }
        setAttachedFiles(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [createAttachmentId]);

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
            await window.electron.batch.invoke([{
                channel: 'project-agent:select-model',
                args: [{ taskId: selectedTaskId, provider, model }]
            }]);
            setIsInterruptModalOpen(false);
        } catch (error) {
            window.electron.log.error('Failed to select model:', error as Error);
        }
    }, [selectedTaskId]);

    useEffect(() => {
        const unsubscribe = window.electron.onAgentEvent((payload: unknown) => {
            const typedPayload = payload as { type: string; data?: { taskId?: string; reason?: string } };
            if (typedPayload.type === 'agent:interrupt_required' && typedPayload.data?.taskId === selectedTaskId) {
                setInterruptReason(typedPayload.data.reason ?? 'Manual intervention required');
                setIsInterruptModalOpen(true);
            }
        });
        return () => {
            unsubscribe();
        };
    }, [selectedTaskId]);

    useEffect(() => {
        attachedFilesRef.current = attachedFiles;
    }, [attachedFiles]);

    useEffect(() => () => {
        attachedFilesRef.current.forEach(revokePreviewUrl);
    }, [revokePreviewUrl]);

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
