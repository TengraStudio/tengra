/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { generateId } from '@/lib/utils';
import { ImageContent, MessageContentPart, TextContent } from '@/types';

/** Supported image MIME types */
const SUPPORTED_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
]);

/** Maximum image size in bytes (10 MB) */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export interface ImageAttachment {
    id: string;
    file: File;
    previewUrl: string;
    name: string;
    size: number;
}

export interface ImageValidationError {
    type: 'too_large' | 'unsupported_format';
    fileName: string;
}

export interface UseImageAttachmentReturn {
    attachedImages: ImageAttachment[];
    lastError: ImageValidationError | null;
    addImage: (file: File) => void;
    addImageFromClipboard: () => Promise<void>;
    removeImage: (id: string) => void;
    clearImages: () => void;
    clearError: () => void;
    toContentParts: (text: string) => MessageContentPart[];
}

function isImageFile(file: File): boolean {
    return SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase());
}

/**
 * Custom hook for managing image attachments in chat input.
 * Handles validation, preview generation, and conversion to LLM content parts.
 */
export function useImageAttachment(): UseImageAttachmentReturn {
    const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
    const [lastError, setLastError] = useState<ImageValidationError | null>(null);
    const previewUrlsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const urls = previewUrlsRef.current;
        return () => {
            for (const url of urls) {
                URL.revokeObjectURL(url);
            }
            urls.clear();
        };
    }, []);

    const addImage = useCallback((file: File) => {
        if (!isImageFile(file)) {
            setLastError({ type: 'unsupported_format', fileName: file.name });
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            setLastError({ type: 'too_large', fileName: file.name });
            return;
        }

        setLastError(null);
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.add(previewUrl);

        const attachment: ImageAttachment = {
            id: generateId(),
            file,
            previewUrl,
            name: file.name,
            size: file.size,
        };

        setAttachedImages(prev => [...prev, attachment]);
    }, []);

    const addImageFromClipboard = useCallback(async () => {
        const items = await navigator.clipboard.read();
        for (const item of items) {
            const imageType = item.types.find(t => SUPPORTED_IMAGE_TYPES.has(t));
            if (imageType) {
                const blob = await item.getType(imageType);
                const ext = imageType.split('/')[1] ?? 'png';
                const file = new File([blob], `clipboard-image.${ext}`, { type: imageType });
                addImage(file);
                return;
            }
        }
    }, [addImage]);

    const removeImage = useCallback((id: string) => {
        setAttachedImages(prev => {
            const target = prev.find(img => img.id === id);
            if (target) {
                URL.revokeObjectURL(target.previewUrl);
                previewUrlsRef.current.delete(target.previewUrl);
            }
            return prev.filter(img => img.id !== id);
        });
    }, []);

    const clearImages = useCallback(() => {
        setAttachedImages(prev => {
            for (const img of prev) {
                URL.revokeObjectURL(img.previewUrl);
                previewUrlsRef.current.delete(img.previewUrl);
            }
            return [];
        });
    }, []);

    const clearError = useCallback(() => {
        setLastError(null);
    }, []);

    const toContentParts = useCallback(
        (text: string): MessageContentPart[] => {
            const parts: MessageContentPart[] = [];

            if (text.trim().length > 0) {
                const textPart: TextContent = { type: 'text', text };
                parts.push(textPart);
            }

            for (const img of attachedImages) {
                const imagePart: ImageContent = {
                    type: 'image_url',
                    image_url: { url: img.previewUrl, detail: 'auto' },
                };
                parts.push(imagePart);
            }

            return parts;
        },
        [attachedImages],
    );

    return {
        attachedImages,
        lastError,
        addImage,
        addImageFromClipboard,
        removeImage,
        clearImages,
        clearError,
        toContentParts,
    };
}
