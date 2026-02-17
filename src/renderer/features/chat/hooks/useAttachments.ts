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
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'video/mp4',
    'video/webm',
    'video/quicktime',
];

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_OPTIMIZATION_THRESHOLD = 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;

const MIME_BY_EXTENSION: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    ts: 'text/plain',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    webm: 'video/webm',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    pdf: 'application/pdf',
};

export interface DropValidationResult {
    valid: boolean;
    error?: string;
}

function detectMimeType(file: File): string {
    const directMime = file.type.toLowerCase();
    if (directMime !== '') {
        return directMime;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}

function mapAttachmentType(mimeType: string): Attachment['type'] {
    if (mimeType.startsWith('image/')) {
        return 'image';
    }
    if (mimeType.startsWith('video/')) {
        return 'video';
    }
    if (mimeType.startsWith('text/')) {
        return 'text';
    }
    if (mimeType.startsWith('application/')) {
        return 'application';
    }
    return 'file';
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                resolve(result);
                return;
            }
            reject(new Error('Failed to convert file to data URL'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Unknown file read error'));
        reader.readAsDataURL(file);
    });
}

async function optimizeImageContent(file: File, mimeType: string): Promise<string> {
    const sourceDataUrl = await readFileAsDataUrl(file);
    if (file.size < IMAGE_OPTIMIZATION_THRESHOLD) {
        return sourceDataUrl;
    }

    return await new Promise(resolve => {
        const image = new Image();
        image.onload = () => {
            const maxDimension = Math.max(image.width, image.height);
            const scale = maxDimension > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / maxDimension : 1;
            const width = Math.max(1, Math.floor(image.width * scale));
            const height = Math.max(1, Math.floor(image.height * scale));

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) {
                resolve(sourceDataUrl);
                return;
            }

            context.drawImage(image, 0, 0, width, height);
            const targetMime = mimeType === 'image/jpeg' || mimeType === 'image/webp'
                ? mimeType
                : 'image/jpeg';
            const optimizedDataUrl = canvas.toDataURL(targetMime, 0.82);
            resolve(optimizedDataUrl.length < sourceDataUrl.length ? optimizedDataUrl : sourceDataUrl);
        };
        image.onerror = () => resolve(sourceDataUrl);
        image.src = sourceDataUrl;
    });
}

export function validateDroppedFile(file: File): DropValidationResult {
    const detectedMimeType = detectMimeType(file);

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File "${file.name}" exceeds maximum size of 10MB`,
        };
    }

    // Check file type
    const fileType = detectedMimeType;
    const isAllowedType =
        ALLOWED_FILE_TYPES.some(type => type.toLowerCase() === fileType) ||
        fileType.startsWith('text/') ||
        fileType.startsWith('image/') ||
        fileType.startsWith('audio/') ||
        fileType.startsWith('video/');

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
        const mimeType = detectMimeType(file);
        const attachmentType = mapAttachmentType(mimeType);
        const newAttachment: Attachment = {
            id,
            name: file.name,
            type: attachmentType,
            size: file.size,
            status: 'uploading'
        };
        setAttachments(prev => [...prev, newAttachment]);

        try {
            const content = attachmentType === 'image'
                ? await optimizeImageContent(file, mimeType)
                : await file.text();
            setAttachments(prev =>
                prev.map(a =>
                    a.id === id
                        ? { ...a, status: 'ready', content, preview: attachmentType === 'image' ? content : undefined, file }
                        : a
                )
            );
        } catch {
            const fallbackContent = `[Attached file: ${file.name} (${mimeType})]`;
            setAttachments(prev =>
                prev.map(a =>
                    a.id === id
                        ? { ...a, status: 'ready', content: fallbackContent, file }
                        : a
                )
            );
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
