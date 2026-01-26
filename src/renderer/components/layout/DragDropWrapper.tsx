import { useTranslation } from '@renderer/i18n';
import React, { useRef } from 'react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';

interface DragDropWrapperProps {
    isDragging: boolean
    setIsDragging: (isDragging: boolean) => void
    onFileDrop: (file: File) => void
    children: React.ReactNode
}

export const DragDropWrapper: React.FC<DragDropWrapperProps> = ({
    isDragging,
    setIsDragging,
    onFileDrop,
    children
}) => {
    const { t } = useTranslation();
    const dragCounter = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) {
            dragCounter.current++;
            if (!isDragging) { setIsDragging(true); }
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
            className="flex-1 min-h-0 flex flex-col relative overflow-hidden"
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
                        <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                        <div className="relative text-center space-y-4">
                            <div className="text-6xl mb-4">🏮</div>
                            <div className="text-2xl font-black tracking-tight text-foreground uppercase font-sans">
                                {t('dragDrop.title')}
                            </div>
                            <div className="text-muted-foreground/60 text-sm font-medium">
                                {t('dragDrop.description')}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
