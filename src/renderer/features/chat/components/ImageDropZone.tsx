/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconPhotoPlus } from '@tabler/icons-react';
import React, { useCallback, useState } from 'react';

import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_IMAGEDROPZONE_1 = "absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm";


interface ImageDropZoneProps {
    onImageDrop: (files: File[]) => void;
    children: React.ReactNode;
    className?: string;
}

function isImageTransfer(dataTransfer: DataTransfer): boolean {
    return Array.from(dataTransfer.items).some(
        item => item.kind === 'file' && item.type.startsWith('image/'),
    );
}

/**
 * Drop zone overlay that activates when dragging image files over the chat area.
 * Wraps children and shows a visual overlay on drag-over.
 */
export const ImageDropZone: React.FC<ImageDropZoneProps> = ({
    onImageDrop,
    children,
    className,
}) => {
    const { t } = useTranslation();
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = React.useRef(0);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        if (e.dataTransfer && isImageTransfer(e.dataTransfer)) {
            setIsDragOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragOver(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current = 0;
            setIsDragOver(false);

            const files = Array.from(e.dataTransfer.files).filter(f =>
                f.type.startsWith('image/'),
            );
            if (files.length > 0) {
                onImageDrop(files);
            }
        },
        [onImageDrop],
    );

    return (
        <div
            className={cn('relative', className)}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {children}
            <AnimatePresence>
                {isDragOver && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className={C_IMAGEDROPZONE_1}
                        aria-label={t('frontend.imageAttachment.dropHere')}
                    >
                        <div className="flex flex-col items-center gap-2 text-primary">
                            <IconPhotoPlus size={32} aria-hidden="true" />
                            <span className="text-sm font-medium">
                                {t('frontend.imageAttachment.dropHere')}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

ImageDropZone.displayName = 'ImageDropZone';

