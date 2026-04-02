import { MemoryCategory } from '@shared/types/advanced-memory';
import { Plus } from 'lucide-react';
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

interface AddMemoryModalProps {
    content: string;
    category: MemoryCategory;
    tags: string;
    onContentChange: (content: string) => void;
    onCategoryChange: (category: MemoryCategory) => void;
    onTagsChange: (tags: string) => void;
    onAdd: () => void;
    onCancel: () => void;
}

export const AddMemoryModal: React.FC<AddMemoryModalProps> = ({
    content,
    category,
    tags,
    onContentChange,
    onCategoryChange,
    onTagsChange,
    onAdd,
    onCancel
}) => {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-border/50 shadow-2xl space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    {t('memory.addTitle')}
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-muted-foreground/60">{t('memory.contentLabel')}</label>
                        <textarea
                            value={content}
                            onChange={(e) => onContentChange(e.target.value)}
                            placeholder={t('memory.contentPlaceholder')}
                            className="w-full h-24 mt-1 bg-muted/50 border border-border/40 rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-muted-foreground/60">{t('memory.categoryLabel')}</label>
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
                            <label className="text-xs font-bold text-muted-foreground/60">{t('memory.tagsLabel')}</label>
                            <Input
                                value={tags}
                                onChange={(e) => onTagsChange(e.target.value)}
                                placeholder={t('memory.tagsPlaceholder')}
                                className="mt-1 bg-muted/50 border-border/40"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
                    <Button onClick={onAdd} disabled={!content.trim()}>{t('memory.addAction')}</Button>
                </div>
            </Card>
        </div>
    );
};
