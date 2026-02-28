import { useCallback, useEffect, useRef, useState } from 'react';

import { AttachedFile } from '../components/agent/TaskInputForm';

/**
 * Hook for managing file preview blob URLs and their lifecycle.
 * Handles creation, revocation, and cleanup of object URLs for image previews.
 */
export const useFilePreviewUrl = () => {
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
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

    useEffect(() => {
        attachedFilesRef.current = attachedFiles;
    }, [attachedFiles]);

    useEffect(() => () => {
        attachedFilesRef.current.forEach(revokePreviewUrl);
    }, [revokePreviewUrl]);

    return {
        attachedFiles,
        setAttachedFiles,
        removeAttachedFile,
        clearAttachedFiles,
        handleFileSelect
    };
};
