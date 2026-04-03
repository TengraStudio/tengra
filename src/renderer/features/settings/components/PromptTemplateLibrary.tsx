import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Textarea } from '@renderer/components/ui/textarea';
import { useTranslation } from '@renderer/i18n';
import { PromptTemplate } from '@shared/types/templates';
import { BookOpen, Edit3, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface TemplateDraft {
    name: string;
    description: string;
    template: string;
    category: string;
}
const EMPTY_DRAFT: TemplateDraft = {
    name: '',
    description: '',
    template: '',
    category: '',
};

/**
 * Prompt template library browser and editor for settings panel.
 */
export const PromptTemplateLibrary: React.FC = () => {
    const { t } = useTranslation();
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<TemplateDraft>(EMPTY_DRAFT);
    const [categories, setCategories] = useState<string[]>([]);
    const [filterCategory, setFilterCategory] = useState('');

    const ptApi = window.electron.promptTemplates;

    const load = useCallback(async () => {
        const result = search.trim()
            ? await ptApi.search(search.trim())
            : await ptApi.getAll();
        setTemplates(result);
        const cats = await ptApi.getCategories();
        setCategories(cats);
    }, [search, ptApi]);

    useEffect(() => {
        requestAnimationFrame(() => {
            void load();
        });
    }, [load]);

    const filtered = filterCategory
        ? templates.filter(tp => tp.category === filterCategory)
        : templates;

    const selected = filtered.find(tp => tp.id === selectedId) ?? null;

    const startCreate = () => {
        setEditingId('__new__');
        setDraft(EMPTY_DRAFT);
        setSelectedId(null);
    };

    const startEdit = (tp: PromptTemplate) => {
        setEditingId(tp.id);
        setDraft({
            name: tp.name,
            description: tp.description ?? '',
            template: tp.template,
            category: tp.category ?? '',
        });
    };

    const handleSave = async () => {
        const payload = {
            name: draft.name,
            description: draft.description,
            template: draft.template,
            category: draft.category,
            variables: [],
            tags: [],
        };
        if (editingId === '__new__') {
            await ptApi.create(payload);
        } else if (editingId) {
            await ptApi.update(editingId, payload);
        }
        setEditingId(null);
        setDraft(EMPTY_DRAFT);
        await load();
    };

    const handleDelete = async (id: string) => {
        await ptApi.delete(id);
        if (selectedId === id) {
            setSelectedId(null);
        }
        await load();
    };

    const isEditing = editingId !== null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-card p-8 rounded-2xl border border-border/50 space-y-6 shadow-sm overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-12 -mr-6 -mt-6 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">
                                {t('prompts.library.title')}
                            </h3>
                            <p className="text-xs text-muted-foreground font-medium opacity-80">
                                {t('prompts.library.subtitle')}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={startCreate}
                        className="h-11 px-5 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <Plus className="w-4 h-4 mr-2" /> {t('prompts.library.newPrompt')}
                    </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                    <div className="relative group flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                        <Input
                            type="text"
                            placeholder={t('prompts.library.searchPlaceholder')}
                            value={search}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setSearch(e.target.value)
                            }
                            className="h-12 pl-11 pr-4 bg-background/50 border-border/40 rounded-2xl text-sm font-medium focus-visible:ring-primary/20"
                        />
                    </div>
                    {categories.length > 0 && (
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="h-12 w-full sm:w-[240px] bg-background/50 border-border/40 rounded-2xl text-xs font-bold px-4 focus:ring-primary/20">
                                <SelectValue placeholder={t('prompts.library.allCategories')} />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                                <SelectItem
                                    value="all"
                                    onClick={() => setFilterCategory('')}
                                    className="text-xs font-bold"
                                >
                                    {t('prompts.library.allCategories')}
                                </SelectItem>
                                {categories.map(c => (
                                    <SelectItem
                                        key={c}
                                        value={c}
                                        className="text-xs font-bold"
                                    >
                                        {c}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {isEditing && (
                <div className="bg-card p-8 rounded-2xl border border-primary/20 space-y-6 shadow-2xl shadow-primary/5 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-5 bg-primary rounded-full" />
                        <h4 className="text-sm font-bold text-foreground">
                            {editingId === '__new__'
                                ? t('prompts.library.createNew')
                                : t('prompts.library.editTemplate')}
                        </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground/70 ml-1">
                                {t('prompts.library.namePlaceholder')}
                            </label>
                            <Input
                                type="text"
                                placeholder={t('prompts.library.namePlaceholder')}
                                value={draft.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setDraft({ ...draft, name: e.target.value })
                                }
                                className="h-11 bg-background/50 border-border/40 rounded-xl font-medium focus-visible:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground/70 ml-1">
                                {t('prompts.library.categoryPlaceholder')}
                            </label>
                            <Input
                                type="text"
                                placeholder={t('prompts.library.categoryPlaceholder')}
                                value={draft.category}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setDraft({ ...draft, category: e.target.value })
                                }
                                className="h-11 bg-background/50 border-border/40 rounded-xl font-medium focus-visible:ring-primary/20"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground/70 ml-1">
                            {t('prompts.library.descriptionPlaceholder')}
                        </label>
                        <Input
                            type="text"
                            placeholder={t('prompts.library.descriptionPlaceholder')}
                            value={draft.description}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setDraft({ ...draft, description: e.target.value })
                            }
                            className="h-11 bg-background/50 border-border/40 rounded-xl font-medium focus-visible:ring-primary/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground/70 ml-1">
                            {t('prompts.library.templatePlaceholder')}
                        </label>
                        <Textarea
                            placeholder={t('prompts.library.templatePlaceholder')}
                            value={draft.template}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setDraft({ ...draft, template: e.target.value })
                            }
                            className="min-h-[160px] bg-background/50 border-border/40 rounded-xl font-mono text-sm p-4 focus-visible:ring-primary/20 custom-scrollbar"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                            onClick={() => void handleSave()}
                            className="flex-1 h-12 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/10 hover:scale-[1.01] active:scale-95 transition-all"
                        >
                            {t('common.save')}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setEditingId(null);
                                setDraft(EMPTY_DRAFT);
                            }}
                            className="flex-1 h-12 rounded-xl text-xs font-bold bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-border/40 transition-all"
                        >
                            <X className="w-4 h-4 mr-2" />
                            {t('common.cancel')}
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {filtered.map(tp => (
                    <div
                        key={tp.id}
                        className={cn(
                            'group/card bg-card p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden',
                            selectedId === tp.id
                                ? 'border-primary ring-1 ring-primary/20 shadow-xl shadow-primary/5 bg-primary/[0.02]'
                                : 'border-border/40 hover:border-border/80 hover:bg-muted/5 hover:shadow-md'
                        )}
                        onClick={() => setSelectedId(selectedId === tp.id ? null : tp.id)}
                    >
                        <div className="flex items-start justify-between gap-6 relative z-10">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="text-base font-bold text-foreground truncate">
                                        {tp.name}
                                    </div>
                                    {tp.category && (
                                        <Badge
                                            variant="secondary"
                                            className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/10 text-[9px] font-bold whitespace-nowrap"
                                        >
                                            <Tag className="w-2 h-2 mr-1" />
                                            {tp.category}
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground font-medium line-clamp-2 leading-relaxed opacity-80">
                                    {tp.description || t('prompts.library.noDescription')}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={e => {
                                        e.stopPropagation();
                                        startEdit(tp);
                                    }}
                                    className="h-9 w-9 p-0 rounded-xl bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-border/40 transition-all hover:scale-110 active:scale-90"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={e => {
                                        e.stopPropagation();
                                        void handleDelete(tp.id);
                                    }}
                                    className="h-9 w-9 p-0 rounded-xl bg-destructive/5 text-destructive hover:text-destructive hover:bg-destructive/10 border border-destructive/20 transition-all hover:scale-110 active:scale-90"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        {selectedId === tp.id && selected && (
                            <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="relative group/code">
                                    <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                                        <div className="px-2 py-1 rounded bg-background/80 border border-border/50 text-[8px] font-bold text-muted-foreground backdrop-blur-sm">
                                            MONO
                                        </div>
                                    </div>
                                    <pre className="p-5 bg-background shadow-inner rounded-xl text-xs text-foreground/90 font-mono whitespace-pre-wrap overflow-auto max-h-64 border border-border/40 custom-scrollbar leading-relaxed">
                                        {selected.template}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-muted/5 border border-dashed border-border/40 rounded-3xl opacity-40">
                        <BookOpen className="w-12 h-12 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-bold text-muted-foreground">
                                {t('prompts.library.empty')}
                            </p>
                            <p className="text-xxs font-medium mt-1">
                                {t('prompts.library.emptyHint')}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={startCreate}
                            className="rounded-full h-10 px-6 border-primary/30 text-primary hover:bg-primary/5 font-bold text-[10px]"
                        >
                            {t('prompts.library.createFirstPrompt')}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

