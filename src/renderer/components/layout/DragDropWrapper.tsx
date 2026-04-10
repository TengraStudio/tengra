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
            className="tengra-drag-drop-wrapper"
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
                        className="tengra-drag-drop-wrapper__overlay"
                    >
                        <div className="tengra-drag-drop-wrapper__pulse" />
                        <div className="tengra-drag-drop-wrapper__content space-y-4">
                            <div className="tengra-drag-drop-wrapper__emoji">🏮</div>
                            <div className="tengra-drag-drop-wrapper__title">
                                {t('dragDrop.title')}
                            </div>
                            <div className="tengra-drag-drop-wrapper__description">
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
