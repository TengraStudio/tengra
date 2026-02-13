import { useState } from 'react';

import { generateId } from '@/lib/utils';
import { Attachment } from '@/types';

// Allowed file types for chat attachments
const ALLOWED_FILE_TYPES = [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/pdf',
    'application/zip',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
];

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface DropValidationResult {
    valid: boolean;
    error?: string;
}

export function validateDroppedFile(file: File): DropValidationResult {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File "${file.name}" exceeds maximum size of 10MB`,
        };
    }

    // Check file type
    const fileType = file.type.toLowerCase();
    const isAllowedType =
        ALLOWED_FILE_TYPES.some(type => type.toLowerCase() === fileType) ||
        fileType.startsWith('text/') ||
        fileType.startsWith('image/');

    if (!isAllowedType) {
        return {
            valid: false,
            error: `File type "${file.type || 'unknown'}" is not supported`,
        };
    }

    // Additional check for potentially dangerous extensions
    const dangerousExtensions = ['.exe', '.bat', '.sh', '.cmd', '.ps1', '.vbs', '.scr'];
    const fileName = file.name.toLowerCase();
    const hasDangerousExtension = dangerousExtensions.some(ext => fileName.endsWith(ext));

    if (hasDangerousExtension) {
        return {
            valid: false,
            error: `File "${file.name}" has an unsupported extension`,
        };
    }

    return { valid: true };
}

export const useAttachments = () => {
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const processFile = async (file: File): Promise<DropValidationResult> => {
        // Validate file before processing
        const validation = validateDroppedFile(file);
        if (!validation.valid) {
            return validation;
        }

        const id = generateId();
        const newAttachment: Attachment = {
            id,
            name: file.name,
            type: file.type.split('/')[0] as 'image' | 'file',
            size: file.size,
            status: 'uploading'
        };
        setAttachments(prev => [...prev, newAttachment]);

        try {
            const content = await file.text();
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'ready', content } : a));
        } catch {
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a));
        }

        return { valid: true };
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return {
        attachments,
        setAttachments,
        processFile,
        removeAttachment
    };
};
