/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AdvancedSemanticFragment, MemoryCategory } from '@shared/types/advanced-memory';
import { IconEdit, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';

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

interface EditMemoryModalProps {
    memory: AdvancedSemanticFragment;
    onClose: () => void;
    onSave: (data: { content: string; category: MemoryCategory; tags: string[]; importance: number }) => Promise<void>;
}

export const EditMemoryModal = ({ memory, onClose, onSave }: EditMemoryModalProps) => {
    const { t } = useTranslation();
    const [content, setContent] = useState(memory.content);
    const [category, setCategory] = useState<MemoryCategory>(memory.category);
    const [tags, setTags] = useState(memory.tags.join(', '));
    const [importance, setImportance] = useState(memory.importance);

    const categoryEntries = Object.entries(CATEGORY_CONFIG) as Array<[
        MemoryCategory,
        (typeof CATEGORY_CONFIG)[MemoryCategory]
    ]>;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-border/50 shadow-2xl space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <IconEdit className="w-5 h-5 text-primary" />
                    {t('frontend.memory.editTitle')}
                </h2>
                <div className="space-y-4">
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-24 bg-muted/50 border rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none" />
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
                            <SelectTrigger className="mt-1 bg-muted/50 border-border/40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {categoryEntries.map(([key, config]) => (
                                    <SelectItem key={key} value={key}>{t(config.labelKey)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <input type="range" min="0" max="1" step="0.05" value={importance} onChange={(e) => setImportance(parseFloat(e.target.value))} className="w-full mt-3" />
                    </div>
                    <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('frontend.memory.tagsPlaceholder')} className="mt-1 bg-muted/50 border-border/40" />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                    <Button onClick={() => void onSave({ content, category, tags: tags.split(',').map(tg => tg.trim()).filter(Boolean), importance })}>{t('frontend.memory.saveChanges')}</Button>
                </div>
            </Card>
        </div>
    );
};

interface AddMemoryModalProps {
    onClose: () => void;
    onAdd: (data: { content: string; category: MemoryCategory; tags: string[] }) => Promise<void>;
}

export const AddMemoryModal = ({ onClose, onAdd }: AddMemoryModalProps) => {
    const { t } = useTranslation();
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<MemoryCategory>('fact');
    const [tags, setTags] = useState('');

    const categoryEntries = Object.entries(CATEGORY_CONFIG) as Array<[
        MemoryCategory,
        (typeof CATEGORY_CONFIG)[MemoryCategory]
    ]>;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-border/50 shadow-2xl space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <IconPlus className="w-5 h-5 text-primary" />
                    {t('frontend.memory.addTitle')}
                </h2>
                <div className="space-y-4">
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('frontend.memory.contentPlaceholder')} className="w-full h-24 bg-muted/50 border rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none" />
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
                            <SelectTrigger className="mt-1 bg-muted/50 border-border/40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {categoryEntries.map(([key, config]) => (
                                    <SelectItem key={key} value={key}>{t(config.labelKey)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('frontend.memory.tagsPlaceholder')} className="mt-1 bg-muted/50 border-border/40" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                    <Button onClick={() => void onAdd({ content, category, tags: tags.split(',').map(tg => tg.trim()).filter(Boolean) })}>{t('frontend.memory.addAction')}</Button>
                </div>
            </Card>
        </div>
    );
};
