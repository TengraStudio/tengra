import { Check, FolderOpen } from 'lucide-react';
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
        <div className={cn('space-y-5', className)}>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <label className="text-xs font-bold uppercase text-muted-foreground mb-2 block tracking-wider ml-1">
                    {t('workspaceWizard.projectName')}
                </label>
                <div className="relative group">
                    <input
                        autoFocus
                        value={formData.name}
                        onChange={e => onFormChange(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-background border border-border/60 rounded-xl px-5 py-4 focus:outline-none focus:border-primary/60 focus:bg-background transition-all text-lg font-semibold placeholder:text-muted-foreground/40"
                        placeholder={t('workspaceWizard.namePlaceholder')}
                    />
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
            >
                <label className="text-xs font-bold uppercase text-muted-foreground mb-3 block tracking-wider ml-1">
                    {t('projects.categoryLabel')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {categories.map((cat, idx) => (
                        <motion.button
                            key={cat.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2, delay: 0.15 + idx * 0.05 }}
                            onClick={() => onFormChange(p => ({ ...p, category: cat.id }))}
                            className={cn(
                                'flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-3 group relative overflow-hidden h-32',
                                formData.category === cat.id
                                    ? 'bg-primary/10 border-primary/70 shadow-[0_8px_24px_rgba(var(--primary),0.18)]'
                                    : 'bg-background border-border/50 hover:bg-muted/30 hover:border-border'
                            )}
                        >
                            <AnimatePresence>
                                {formData.category === cat.id && (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -45 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="absolute top-4 right-4 z-10"
                                    >
                                        <div className="bg-primary p-1.5 rounded-full shadow-lg shadow-primary/20">
                                            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className={cn(
                                'p-3 rounded-xl group-hover:scale-105 transition-all duration-300 shadow-sm',
                                cat.bg, cat.color,
                                formData.category === cat.id ? 'scale-105 shadow-md ring-2 ring-primary/20' : 'opacity-80'
                            )}>
                                <cat.icon className="w-6 h-6" />
                            </div>

                            <span className={cn(
                                'text-[11px] font-semibold tracking-wide text-center',
                                formData.category === cat.id ? 'text-primary' : 'text-muted-foreground'
                            )}>
                                {t(cat.nameKey)}
                            </span>

                            {formData.category === cat.id && (
                                <motion.div className="absolute inset-0 border border-primary/70 rounded-2xl" />
                            )}
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <label className="text-xs font-bold uppercase text-muted-foreground mb-2 block tracking-wider ml-1">
                    {t('workspaceWizard.selectFolder')}
                </label>
                <div className="relative group flex items-center">
                    <input
                        value={formData.customPath}
                        onChange={e => onFormChange(p => ({ ...p, customPath: e.target.value }))}
                        className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/60 transition-all text-foreground placeholder:text-muted-foreground/40 pr-12"
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
                        className="absolute right-2 p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
                        title={t('workspaceWizard.selectFolder')}
                    >
                        <FolderOpen className="w-5 h-5" />
                    </button>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
            >
                <label className="text-xs font-bold uppercase text-muted-foreground mb-2 block tracking-wider ml-1">
                    {t('workspaceWizard.description')}
                </label>
                <textarea
                    value={formData.description}
                    onChange={e => onFormChange(p => ({ ...p, description: e.target.value }))}
                    className="w-full h-28 bg-background border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/60 transition-all resize-none text-foreground placeholder:text-muted-foreground/40"
                    placeholder={t('workspaceWizard.descPlaceholder')}
                />
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm font-medium flex items-center gap-3 overflow-hidden"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export type CategoryConfig = WorkspaceCategoryConfig;
export type ProjectFormData = WorkspaceFormData;
export const ProjectDetailsForm = WorkspaceDetailsForm;
