/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useTranslation } from '@renderer/i18n';
import React, { useRef } from 'react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';


interface DragDropWrapperProps {
    isDragging: boolean;
    setIsDragging: (isDragging: boolean) => void;
    onFileDrop: (file: File) => void;
    children: React.ReactNode;
}

export const DragDropWrapper: React.FC<DragDropWrapperProps> = ({
    isDragging,
    setIsDragging,
    onFileDrop,
    children,
}) => {
    const { t } = useTranslation();
    const dragCounter = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) {
            dragCounter.current++;
            if (!isDragging) {
                setIsDragging(true);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files') && !isDragging) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        dragCounter.current--;
        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragging(false);
        Array.from(e.dataTransfer.files).forEach(onFileDrop);
    };

    return (
        <div
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {children}

            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                    >
                        <div className="absolute inset-0 animate-pulse bg-primary/5" />
                        <div className="relative space-y-4 text-center">
                            <div className="mb-4 text-6xl">🏮</div>
                            <div className="text-2xl font-bold text-foreground">
                                {t('dragDrop.title')}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground/60">
                                {t('dragDrop.description')}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

DragDropWrapper.displayName = 'DragDropWrapper';
