/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDeviceFloppy, IconEdit, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Language, useTranslation } from '@/i18n';
import { Prompt } from '@/types';

/* Batch-02: Extracted Long Classes */
const C_PROMPTMANAGERMODAL_1 = "w-full bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors";
const C_PROMPTMANAGERMODAL_2 = "w-full flex-1 bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors resize-none font-mono";


interface PromptManagerModalProps {
    isOpen: boolean
    onClose: () => void
    prompts: Prompt[]
    onCreatePrompt: (title: string, content: string, tags?: string[]) => void
    onUpdatePrompt: (id: string, updates: Partial<Prompt>) => void
    onDeletePrompt: (id: string) => void
    language?: Language
}

export const PromptManagerModal: React.FC<PromptManagerModalProps> = ({
    isOpen,
    onClose,
    prompts,
    onCreatePrompt,
    onUpdatePrompt,
    onDeletePrompt,
    language
}) => {
    const { t } = useTranslation(language);
    const [isEditing, setIsEditing] = useState<string | 'new' | null>(null);
    const [editForm, setEditForm] = useState({ title: '', content: '' });

    const handleStartEdit = (prompt?: Prompt) => {
        if (prompt) {
            setIsEditing(prompt.id);
            setEditForm({ title: prompt.title, content: prompt.content });
        } else {
            setIsEditing('new');
            setEditForm({ title: '', content: '' });
        }
    };

    const handleSave = () => {
        if (!editForm.title.trim() || !editForm.content.trim()) { return; }

        if (isEditing === 'new') {
            onCreatePrompt(editForm.title, editForm.content);
        } else if (isEditing) {
            onUpdatePrompt(isEditing, editForm);
        }
        setIsEditing(null);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('frontend.ssh.promptManager.title')}>
            <div className="h-96 flex flex-col">
                {isEditing ? (
                    <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-200">
                        <div className="space-y-2">
                            <label className="typo-caption font-medium text-muted-foreground">{t('frontend.ssh.promptManager.labels.title')}</label>
                            <input
                                value={editForm.title}
                                onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                className={C_PROMPTMANAGERMODAL_1}
                                placeholder={t('frontend.ssh.promptManager.placeholders.title')}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2 flex-1 flex flex-col">
                            <label className="typo-caption font-medium text-muted-foreground">{t('frontend.ssh.promptManager.labels.content')}</label>
                            <textarea
                                value={editForm.content}
                                onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                                className={C_PROMPTMANAGERMODAL_2}
                                placeholder={t('frontend.ssh.promptManager.placeholders.content')}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" size="sm" onClick={() => setIsEditing(null)}>
                                <IconX className="w-4 h-4 mr-1" /> {t('common.cancel')}
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={!editForm.title || !editForm.content}>
                                <IconDeviceFloppy className="w-4 h-4 mr-1" /> {t('common.save')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-end mb-4">
                            <Button size="sm" onClick={() => handleStartEdit()}>
                                <IconPlus className="w-4 h-4 mr-2" /> {t('frontend.ssh.promptManager.newPrompt')}
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {prompts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm opacity-60">
                                    <p>{t('frontend.ssh.promptManager.empty.title')}</p>
                                    <p className="typo-caption">{t('frontend.ssh.promptManager.empty.subtitle')}</p>
                                </div>
                            ) : (
                                prompts.map(prompt => (
                                    <div
                                        key={prompt.id}
                                        className="group bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-lg p-3 transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h4 className="font-medium text-sm text-foreground">{prompt.title}</h4>
                                                <p className="typo-caption text-muted-foreground line-clamp-2 mt-1">{prompt.content}</p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 hover:text-primary"
                                                    onClick={() => handleStartEdit(prompt)}
                                                    aria-label={t('common.edit')}
                                                >
                                                    <IconEdit className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 hover:text-destructive"
                                                    onClick={() => onDeletePrompt(prompt.id)}
                                                    aria-label={t('common.delete')}
                                                >
                                                    <IconTrash className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

