/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MemoryCategory } from '@shared/types/advanced-memory';
import { IconEdit } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useTranslation } from '@/i18n';

import { CATEGORY_CONFIG } from './constants';

/* Batch-02: Extracted Long Classes */
const C_EDITMEMORYMODAL_1 = "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200";
const C_EDITMEMORYMODAL_2 = "w-full h-24 mt-1 bg-muted/50 border border-border/40 rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none transition-colors";


interface EditMemoryModalProps {
    content: string;
    category: MemoryCategory;
    tags: string;
    importance: number;
    expiresAt: string;
    onContentChange: (content: string) => void;
    onCategoryChange: (category: MemoryCategory) => void;
    onTagsChange: (tags: string) => void;
    onImportanceChange: (importance: number) => void;
    onExpiresAtChange: (expiresAt: string) => void;
    onSave: () => void;
    onCancel: () => void;
}

export const EditMemoryModal: React.FC<EditMemoryModalProps> = ({
    content,
    category,
    tags,
    importance,
    expiresAt,
    onContentChange,
    onCategoryChange,
    onTagsChange,
    onImportanceChange,
    onExpiresAtChange,
    onSave,
    onCancel
}) => {
    const { t } = useTranslation();
    return (
        <div className={C_EDITMEMORYMODAL_1}>
            <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-border/50 shadow-2xl space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <IconEdit className="w-5 h-5 text-primary" />
                    {t('frontend.memory.editTitle')}
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="typo-caption font-bold text-muted-foreground/60">{t('frontend.memory.contentLabel')}</label>
                        <textarea
                            value={content}
                            onChange={(e) => onContentChange(e.target.value)}
                            className={C_EDITMEMORYMODAL_2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="typo-caption font-bold text-muted-foreground/60">{t('frontend.memory.categoryLabel')}</label>
                            <Select value={category} onValueChange={(v) => onCategoryChange(v as MemoryCategory)}>
                                <SelectTrigger className="mt-1 bg-muted/50 border-border/40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                            <span className="flex items-center gap-2">
                                                <config.icon className="w-4 h-4" />
                                                {t(config.labelKey)}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="typo-caption font-bold text-muted-foreground/60">
                                {t('frontend.memory.importanceLabel', { percent: Math.round(importance * 100) })}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={importance}
                                onChange={(e) => onImportanceChange(parseFloat(e.target.value))}
                                className="w-full mt-3"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="typo-caption font-bold text-muted-foreground/60">{t('frontend.memory.tagsLabel')}</label>
                            <Input
                                value={tags}
                                onChange={(e) => onTagsChange(e.target.value)}
                                placeholder={t('frontend.memory.tagsPlaceholderFull')}
                                className="mt-1 bg-muted/50 border-border/40"
                            />
                        </div>

                        <div>
                            <label className="typo-caption font-bold text-muted-foreground/60">{t('frontend.memory.expirationLabel')}</label>
                            <Input
                                type="date"
                                value={expiresAt}
                                onChange={(e) => onExpiresAtChange(e.target.value)}
                                className="mt-1 bg-muted/50 border-border/40"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
                    <Button onClick={onSave} disabled={!content.trim()}>{t('frontend.memory.saveChanges')}</Button>
                </div>
            </Card>
        </div>
    );
};

