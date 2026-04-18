/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { detectFileType } from '@shared/utils/file-type.util';
import { useState } from 'react';

import { useTranslation } from '@/i18n';
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
    if (mimeType.startsWith('audio/')) {
        return 'audio';
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

async function resolveMimeType(file: File): Promise<string> {
    const signatureType = await detectFileType(file);
    return (signatureType ?? detectMimeType(file)).toLowerCase();
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

function extractVideoFramePreview(file: File): Promise<string | undefined> {
    return new Promise(resolve => {
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        const cleanup = () => URL.revokeObjectURL(objectUrl);
        const fail = () => {
            cleanup();
            resolve(undefined);
        };

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.onloadeddata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.min(video.videoWidth || 640, MAX_IMAGE_DIMENSION));
            canvas.height = Math.max(1, Math.min(video.videoHeight || 360, MAX_IMAGE_DIMENSION));
            const context = canvas.getContext('2d');
            if (!context) {
                fail();
                return;
            }
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = canvas.toDataURL('image/jpeg', 0.8);
            cleanup();
            resolve(frame);
        };
        video.onerror = fail;
        video.src = objectUrl;
    });
}

function readAudioDurationSeconds(file: File): Promise<number | null> {
    return new Promise(resolve => {
        const objectUrl = URL.createObjectURL(file);
        const audio = document.createElement('audio');
        const cleanup = () => URL.revokeObjectURL(objectUrl);
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
            const duration = Number.isFinite(audio.duration) ? audio.duration : null;
            cleanup();
            resolve(duration);
        };
        audio.onerror = () => {
            cleanup();
            resolve(null);
        };
        audio.src = objectUrl;
    });
}

async function buildAttachmentContent(
    file: File,
    mimeType: string,
    attachmentType: Attachment['type'],
    resolveMessage: (key: string, options?: Record<string, string | number>) => string
): Promise<{ content: string; preview?: string }> {
    if (attachmentType === 'image') {
        const optimized = await optimizeImageContent(file, mimeType);
        return { content: optimized, preview: optimized };
    }

    if (attachmentType === 'video') {
        const preview = await extractVideoFramePreview(file);
        const header = resolveMessage('attachments.summary.videoHeader', { name: file.name, mimeType });
        const previewStatus = preview
            ? resolveMessage('attachments.summary.videoPreviewExtracted')
            : resolveMessage('attachments.summary.videoPreviewUnavailable');
        const content = `${header}\n${previewStatus}`;
        return { content, preview };
    }

    if (attachmentType === 'audio') {
        const durationSeconds = await readAudioDurationSeconds(file);
        const durationNote = durationSeconds !== null
            ? resolveMessage('attachments.summary.audioDuration', { seconds: durationSeconds.toFixed(1) })
            : resolveMessage('attachments.summary.audioDurationUnavailable');
        const header = resolveMessage('attachments.summary.audioHeader', { name: file.name, mimeType });
        const transcriptionNote = resolveMessage('attachments.summary.audioTranscriptionHint');
        const content = `${header}\n${durationNote}\n${transcriptionNote}`;
        return { content };
    }

    const isTextLikeMime = mimeType.startsWith('text/')
        || mimeType === 'application/json'
        || mimeType === 'application/xml'
        || mimeType === 'application/javascript';
    if (isTextLikeMime) {
        const rawText = await file.text();
        if (mimeType === 'application/json') {
            try {
                return { content: JSON.stringify(JSON.parse(rawText), null, 2) };
            } catch {
                return { content: rawText };
            }
        }
        return { content: rawText };
    }

    return { content: resolveMessage('attachments.summary.genericFile', { name: file.name, mimeType }) };
}

export async function validateDroppedFile(
    file: File,
    resolveMessage: (key: string, options?: Record<string, string | number>) => string
): Promise<DropValidationResult> {
    const signatureType = await detectFileType(file);
    const detectedMimeType = signatureType || detectMimeType(file);

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: resolveMessage(
                'attachments.validation.maxSizeExceeded',
                { name: file.name, maxSizeMb: 10 }
            ),
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
        const unknownType = resolveMessage('attachments.validation.unknownType');
        return {
            valid: false,
            error: resolveMessage(
                'attachments.validation.unsupportedType',
                { type: file.type || unknownType }
            ),
        };
    }

    // Additional check for potentially dangerous extensions
    const dangerousExtensions = ['.exe', '.bat', '.sh', '.cmd', '.ps1', '.vbs', '.scr'];
    const fileName = file.name.toLowerCase();
    const hasDangerousExtension = dangerousExtensions.some(ext => fileName.endsWith(ext));

    if (hasDangerousExtension) {
        return {
            valid: false,
            error: resolveMessage(
                'attachments.validation.unsupportedExtension',
                { name: file.name }
            ),
        };
    }

    return { valid: true };
}

export const useAttachments = () => {
    const { t } = useTranslation();
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const processFile = async (file: File): Promise<DropValidationResult> => {
        // Validate file before processing
        const validation = await validateDroppedFile(file, t);
        if (!validation.valid) {
            return validation;
        }

        const id = generateId();
        const mimeType = await resolveMimeType(file);
        const attachmentType = mapAttachmentType(mimeType);
        const newAttachment: Attachment = {
            id,
            name: file.name,
            type: attachmentType,
            size: file.size,
            mimeType,
            status: 'uploading'
        };
        setAttachments(prev => [...prev, newAttachment]);

        try {
            const { content, preview } = await buildAttachmentContent(file, mimeType, attachmentType, t);
            setAttachments(prev =>
                prev.map(a =>
                    a.id === id
                        ? { ...a, status: 'ready', content, preview, file }
                        : a
                )
            );
        } catch {
            const fallbackContent = t('attachments.summary.genericFile', { name: file.name, mimeType });
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
