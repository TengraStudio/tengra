/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCheck, IconFolderOpen } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';


/** Category configuration for workspace type selection */
export interface WorkspaceCategoryConfig {
    id: string;
    nameKey: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
}

/** Workspace details form data shape */
export interface WorkspaceFormData {
    name: string;
    description: string;
    category: string;
    customPath: string;
}

interface WorkspaceDetailsFormProps {
    formData: WorkspaceFormData;
    onFormChange: (updater: (prev: WorkspaceFormData) => WorkspaceFormData) => void;
    categories: WorkspaceCategoryConfig[];
    error?: string | null;
    /** Additional CSS class for the root container */
    className?: string;
}

/** Reusable workspace details form with name, category, path, and description fields */
export const WorkspaceDetailsForm: React.FC<WorkspaceDetailsFormProps> = ({
    formData,
    onFormChange,
    categories,
    error,
    className,
}) => {
    const { t } = useTranslation();

    return (
        <div className={cn('flex flex-col gap-6 font-sans', className)}>
            <motion.div
                className="flex flex-col gap-1.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <label className="text-sm font-semibold text-foreground/80 uppercase ">
                    {t('workspaceWizard.workspaceName')}
                </label>
                <div className="relative group">
                    <input
                        autoFocus
                        value={formData.name}
                        onChange={e => onFormChange(p => ({ ...p, name: e.target.value }))}
                        className="w-full h-11 px-4 text-base font-medium bg-muted/20 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
                        placeholder={t('workspaceWizard.namePlaceholder')}
                    />
                </div>
            </motion.div>

            <motion.div
                className="flex flex-col gap-1.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
            >
                <label className="text-sm font-semibold text-foreground/80 uppercase ">
                    {t('workspaces.categoryLabel')}
                </label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {categories.map((cat, idx) => (
                        <motion.button
                            key={cat.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2, delay: 0.15 + idx * 0.05 }}
                            onClick={() => onFormChange(p => ({ ...p, category: cat.id }))}
                            className={cn('relative flex flex-col items-center gap-2 p-3 bg-muted/20 border border-border/50 rounded-lg transition-all', formData.category === cat.id ? 'bg-primary/5 border-primary shadow-sm scale-102' : 'hover:scale-102 hover:bg-muted/40 cursor-pointer')}
                        >
                            <AnimatePresence>
                                {formData.category === cat.id && (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -45 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="absolute top-1.5 right-1.5"
                                    >
                                        <div className="flex items-center justify-center w-5 h-5 bg-primary rounded-full shadow-sm">
                                            <IconCheck className="w-3.5 h-3.5 text-primary-foreground" />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className={cn('flex items-center justify-center w-12 h-12 rounded-xl transition-all shadow-sm', cat.bg, cat.color, formData.category === cat.id ? 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background' : 'opacity-80')}>
                                <cat.icon className="w-6 h-6 drop-shadow-sm" />
                            </div>

                            <span className={cn('text-sm font-medium transition-colors', formData.category === cat.id ? 'text-foreground' : 'text-muted-foreground')}>
                                {t(cat.nameKey)}
                            </span>

                            {formData.category === cat.id && (
                                <motion.div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none" />
                            )}
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            <motion.div
                className="flex flex-col gap-1.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <label className="text-sm font-semibold text-foreground/80 uppercase ">
                    {t('workspaceWizard.selectFolder')}
                </label>
                <div className="flex gap-2">
                    <input
                        value={formData.customPath}
                        onChange={e => onFormChange(p => ({ ...p, customPath: e.target.value }))}
                        className="flex-1 min-w-0 h-9 px-3 text-sm font-mono bg-muted/20 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all custom-scrollbar"
                        placeholder={t('workspaceWizard.selectRootDesc')}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            void window.electron.ipcRenderer.invoke('dialog:selectDirectory').then(result => {
                                if (result.success && result.path) {
                                    onFormChange(p => ({ ...p, customPath: result.path }));
                                }
                            });
                        }}
                        className="flex items-center justify-center w-9 h-9 min-w-9 bg-muted/30 border border-border/50 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer shadow-sm"
                        title={t('workspaceWizard.selectFolder')}
                    >
                        <IconFolderOpen className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>

            <motion.div
                className="flex flex-col gap-1.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
            >
                <label className="text-sm font-semibold text-foreground/80 uppercase ">
                    {t('workspaceWizard.description')}
                </label>
                <textarea
                    value={formData.description}
                    onChange={e => onFormChange(p => ({ ...p, description: e.target.value }))}
                    className="w-full min-h-80 p-3 text-sm bg-muted/20 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-y custom-scrollbar"
                    placeholder={t('workspaceWizard.descPlaceholder')}
                />
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 p-3 mt-2 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md overflow-hidden"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0 animate-pulse" />
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export type CategoryConfig = WorkspaceCategoryConfig;
