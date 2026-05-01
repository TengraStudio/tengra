/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconX } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

import type { ImageAttachment } from '../hooks/useImageAttachment';

/* Batch-02: Extracted Long Classes */
const C_IMAGEPREVIEWBAR_1 = "absolute top-0.5 right-0.5 p-0.5 rounded-full bg-background/80 text-muted-foreground hover:text-destructive hover:bg-background transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100";


interface ImagePreviewBarProps {
    images: ImageAttachment[];
    onRemove: (id: string) => void;
    className?: string;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Horizontal preview bar showing attached image thumbnails above the chat input.
 * Each thumbnail has a remove button and displays the file name and size.
 */
export const ImagePreviewBar: React.FC<ImagePreviewBarProps> = ({
    images,
    onRemove,
    className,
}) => {
    const { t } = useTranslation();

    if (images.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                'flex gap-2 overflow-x-auto px-2 py-2 scrollbar-thin scrollbar-thumb-border',
                className,
            )}
            role="list"
            aria-label={t('frontend.imageAttachment.attached', { count: images.length })}
        >
            <AnimatePresence initial={false}>
                {images.map(img => (
                    <motion.div
                        key={img.id}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className="group relative flex-shrink-0"
                        role="listitem"
                    >
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                            <img
                                src={img.previewUrl}
                                alt={img.name}
                                className="w-full h-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => onRemove(img.id)}
                                className={C_IMAGEPREVIEWBAR_1}
                                aria-label={t('frontend.imageAttachment.remove')}
                            >
                                <IconX size={12} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="mt-0.5 max-w-16 text-center">
                            <p className="text-sm text-muted-foreground truncate">
                                {img.name}
                            </p>
                            <p className="text-sm text-muted-foreground/60">
                                {formatFileSize(img.size)}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

ImagePreviewBar.displayName = 'ImagePreviewBar';
