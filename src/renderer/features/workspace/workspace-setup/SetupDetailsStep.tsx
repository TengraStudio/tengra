/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCheck } from '@tabler/icons-react';
import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_WIZARDDETAILSSTEP_1 = "bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm font-medium flex items-center gap-3 overflow-hidden sm:p-5 lg:p-6 sm:gap-4";


interface CATEGORY {
    id: string;
    nameKey: string;
    icon: React.ElementType;
    color: string;
    bg: string;
}

interface SetupDetailsStepProps {
    formData: {
        name: string;
        description: string;
        category: string;
        customPath: string;
    };
    setFormData: React.Dispatch<
        React.SetStateAction<{
            name: string;
            description: string;
            category: string;
            goal: string;
            customPath: string;
        }>
    >;
    categories: CATEGORY[];
    error: string | null;
}

export const SetupDetailsStep: React.FC<SetupDetailsStepProps> = ({
    formData,
    setFormData,
    categories,
    error,
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-7 flex-1 pt-1">
            <div className="space-y-5">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Label className="typo-caption font-bold text-muted-foreground mb-2 block ml-1">
                        {t('frontend.workspaceWizard.workspaceName')}
                    </Label>
                    <div className="relative group">
                        <Input
                            autoFocus
                            value={formData.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setFormData(p => ({ ...p, name: e.target.value }))
                            }
                            className="w-full px-5 py-4 text-lg font-semibold h-auto"
                            placeholder={t('frontend.workspaceWizard.namePlaceholder')}
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    <Label className="typo-caption font-bold text-muted-foreground mb-3 block ml-1">
                        {t('frontend.workspaces.categoryLabel')}
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {categories.map((cat, idx) => (
                            <motion.button
                                key={cat.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2, delay: 0.15 + idx * 0.05 }}
                                onClick={() => setFormData(p => ({ ...p, category: cat.id }))}
                                className={cn(
                                    'flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-3 group relative overflow-hidden h-32',
                                    formData.category === cat.id
                                        ? 'bg-primary/10 border-primary/70 shadow-primary-elevated'
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
                                                <IconCheck
                                                    className="w-3.5 h-3.5 text-primary-foreground"
                                                    stroke={3}
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div
                                    className={cn(
                                        'p-3 rounded-xl group-hover:scale-105 transition-all duration-300 shadow-sm',
                                        cat.bg,
                                        cat.color,
                                        formData.category === cat.id
                                            ? 'scale-105 shadow-md ring-2 ring-primary/20'
                                            : 'opacity-80'
                                    )}
                                >
                                    <cat.icon className="w-6 h-6" />
                                </div>

                                <div className="flex flex-col items-center gap-1">
                                    <span
                                        className={cn(
                                            'typo-overline font-semibold text-center',
                                            formData.category === cat.id
                                                ? 'text-primary'
                                                : 'text-muted-foreground'
                                        )}
                                    >
                                        {t(cat.nameKey)}
                                    </span>
                                </div>

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
                    <Label className="typo-caption font-bold text-muted-foreground mb-2 block ml-1">
                        {t('frontend.workspaceWizard.selectFolder')}
                    </Label>
                    <Input
                        value={formData.customPath}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(p => ({ ...p, customPath: e.target.value }))
                        }
                        className="w-full px-4 py-3"
                        placeholder={t('frontend.workspaceWizard.selectRootDesc')}
                    />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.25 }}
                >
                    <Label className="typo-caption font-bold text-muted-foreground mb-2 block ml-1">
                        {t('frontend.workspaceWizard.description')}
                    </Label>
                    <Textarea
                        value={formData.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setFormData(p => ({ ...p, description: e.target.value }))
                        }
                        className="w-full h-28 px-4 py-3 resize-none"
                        placeholder={t('frontend.workspaceWizard.descPlaceholder')}
                    />
                </motion.div>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={C_WIZARDDETAILSSTEP_1}
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

