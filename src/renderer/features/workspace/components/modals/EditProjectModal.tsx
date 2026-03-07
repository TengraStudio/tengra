import React from 'react';

import { Modal } from '@/components/ui/modal';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Project } from '@/types';

import { isValidProjectDescription, isValidProjectTitle } from './modalValidation';

interface EditProjectModalProps {
    project: Project | null;
    onClose: () => void;
    form: { title: string; description: string };
    setForm: (f: { title: string; description: string } | ((prev: { title: string; description: string }) => { title: string; description: string })) => void;
    onSubmit: () => Promise<boolean>;
    t: (key: string) => string;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
    project,
    onClose,
    form,
    setForm,
    onSubmit,
    t,
}) => {
    const hasValidTitle = isValidProjectTitle(form.title);
    const hasValidDescription = isValidProjectDescription(form.description);
    const [isSaving, setIsSaving] = React.useState(false);
    const rollbackRef = React.useRef(form);

    React.useEffect(() => {
        if (project) {
            rollbackRef.current = {
                title: project.title,
                description: project.description,
            };
            setIsSaving(false);
        }
    }, [project]);

    const handleSubmit = async () => {
        if (!hasValidTitle || isSaving) {
            return;
        }
        const optimisticSnapshot = { ...form };
        setIsSaving(true);
        const success = await onSubmit();
        if (!success) {
            setForm(rollbackRef.current);
        } else {
            rollbackRef.current = optimisticSnapshot;
        }
        setIsSaving(false);
    };

    return (
        <AnimatePresence>
            {project && (
                <Modal isOpen={!!project} onClose={onClose} title={t('workspaces.editWorkspace')}>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase">
                                {t('workspaces.nameLabel')}
                            </label>
                            <input
                                value={form.title}
                                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                aria-invalid={!hasValidTitle}
                                className={cn(
                                    'w-full bg-muted/30 border rounded-lg px-3 py-2 text-sm focus:outline-none',
                                    hasValidTitle
                                        ? 'border-border/50 focus:border-primary/50'
                                        : 'border-destructive/50 focus:border-destructive'
                                )}
                                placeholder={t('workspaces.namePlaceholder')}
                            />
                            {!hasValidTitle && (
                                <p className="text-xxs text-destructive">{t('common.invalidInput')}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase">
                                {t('workspaces.description')}
                            </label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                aria-invalid={!hasValidDescription}
                                className={cn(
                                    'w-full bg-muted/30 border rounded-lg px-3 py-2 text-sm focus:outline-none min-h-[80px] resize-none',
                                    hasValidDescription
                                        ? 'border-border/50 focus:border-primary/50'
                                        : 'border-destructive/50 focus:border-destructive'
                                )}
                                placeholder={t('workspaces.workspaceDescPlaceholder')}
                            />
                            {!hasValidDescription && (
                                <p className="text-xxs text-destructive">{t('common.invalidInput')}</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    void handleSubmit();
                                }}
                                disabled={!hasValidTitle || isSaving}
                                className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </AnimatePresence>
    );
};
