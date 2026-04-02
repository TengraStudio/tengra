import { Check, FolderOpen } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

import './workspace-details-form.css';

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
        <div className={cn('tengra-ws-form', className)}>
            <motion.div
                className="tengra-ws-form__field"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <label className="tengra-ws-form__label">
                    {t('workspaceWizard.workspaceName')}
                </label>
                <div className="relative group">
                    <input
                        autoFocus
                        value={formData.name}
                        onChange={e => onFormChange(p => ({ ...p, name: e.target.value }))}
                        className="tengra-ws-form__name-input"
                        placeholder={t('workspaceWizard.namePlaceholder')}
                    />
                </div>
            </motion.div>

            <motion.div
                className="tengra-ws-form__field"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
            >
                <label className="tengra-ws-form__label">
                    {t('workspaces.categoryLabel')}
                </label>
                <div className="tengra-ws-form__category-grid">
                    {categories.map((cat, idx) => (
                        <motion.button
                            key={cat.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2, delay: 0.15 + idx * 0.05 }}
                            onClick={() => onFormChange(p => ({ ...p, category: cat.id }))}
                            className={cn(
                                'tengra-ws-form__cat-btn',
                                formData.category === cat.id && 'tengra-ws-form__cat-btn--selected'
                            )}
                        >
                            <AnimatePresence>
                                {formData.category === cat.id && (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -45 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="tengra-ws-form__check"
                                    >
                                        <div className="tengra-ws-form__check-inner">
                                            <Check className="tengra-ws-form__check-icon" />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className={cn(
                                'tengra-ws-form__cat-icon-wrap',
                                cat.bg, cat.color,
                                formData.category === cat.id
                                    ? 'tengra-ws-form__cat-icon-wrap--selected'
                                    : 'tengra-ws-form__cat-icon-wrap--inactive'
                            )}>
                                <cat.icon className="tengra-ws-form__cat-icon" />
                            </div>

                            <span className={cn(
                                'tengra-ws-form__cat-label',
                                formData.category === cat.id && 'tengra-ws-form__cat-label--selected'
                            )}>
                                {t(cat.nameKey)}
                            </span>

                            {formData.category === cat.id && (
                                <motion.div className="tengra-ws-form__cat-selected-border" />
                            )}
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            <motion.div
                className="tengra-ws-form__field"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <label className="tengra-ws-form__label">
                    {t('workspaceWizard.selectFolder')}
                </label>
                <div className="tengra-ws-form__path-wrap">
                    <input
                        value={formData.customPath}
                        onChange={e => onFormChange(p => ({ ...p, customPath: e.target.value }))}
                        className="tengra-ws-form__path-input"
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
                        className="tengra-ws-form__folder-btn"
                        title={t('workspaceWizard.selectFolder')}
                    >
                        <FolderOpen className="tengra-ws-form__folder-icon" />
                    </button>
                </div>
            </motion.div>

            <motion.div
                className="tengra-ws-form__field"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
            >
                <label className="tengra-ws-form__label">
                    {t('workspaceWizard.description')}
                </label>
                <textarea
                    value={formData.description}
                    onChange={e => onFormChange(p => ({ ...p, description: e.target.value }))}
                    className="tengra-ws-form__desc-textarea"
                    placeholder={t('workspaceWizard.descPlaceholder')}
                />
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="tengra-ws-form__error"
                    >
                        <div className="tengra-ws-form__error-dot" />
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export type CategoryConfig = WorkspaceCategoryConfig;
