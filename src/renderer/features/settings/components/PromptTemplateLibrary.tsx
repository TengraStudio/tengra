import { PromptTemplate } from '@shared/types/templates';
import { Plus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';

interface TemplateDraft { name: string; description: string; template: string; category: string }
const EMPTY_DRAFT: TemplateDraft = { name: '', description: '', template: '', category: '' };

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

    useEffect(() => { requestAnimationFrame(() => { void load(); }); }, [load]);

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
        setDraft({ name: tp.name, description: tp.description ?? '', template: tp.template, category: tp.category ?? '' });
    };

    const handleSave = async () => {
        const payload = { name: draft.name, description: draft.description, template: draft.template, category: draft.category, variables: [], tags: [] };
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
        if (selectedId === id) { setSelectedId(null); }
        await load();
    };

    const isEditing = editingId !== null;

    return (
        <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                <div className="flex items-center justify-between">
                    <div><h3 className="text-lg font-bold text-foreground">{t('prompts.library.title')}</h3><p className="text-xs text-muted-foreground">{t('prompts.library.subtitle')}</p></div>
                    <button onClick={startCreate} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20"><Plus className="w-3.5 h-3.5" /> {t('prompts.library.newPrompt')}</button>
                </div>
                <div className="flex gap-2">
                    <input type="text" placeholder={t('prompts.library.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
                        className="flex-1 bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                    {categories.length > 0 && (
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                            className="bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground">
                            <option value="">{t('prompts.library.allCategories')}</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {isEditing && (
                <div className="bg-card p-6 rounded-xl border border-border space-y-3">
                    <h4 className="text-sm font-bold text-foreground">{editingId === '__new__' ? t('prompts.library.createNew') : t('prompts.library.editTemplate')}</h4>
                    <input type="text" placeholder={t('prompts.library.namePlaceholder')} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                    <input type="text" placeholder={t('prompts.library.categoryPlaceholder')} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}
                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                    <input type="text" placeholder={t('prompts.library.descriptionPlaceholder')} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}
                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                    <textarea placeholder={t('prompts.library.templatePlaceholder')} value={draft.template} onChange={e => setDraft({ ...draft, template: e.target.value })}
                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground tw-min-h-120 font-mono" />
                    <div className="flex gap-2">
                        <button onClick={() => void handleSave()} className="px-3 py-2 rounded-lg text-xs font-bold bg-primary/20 text-primary border border-border/50">{t('common.save')}</button>
                        <button onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-accent/20 text-muted-foreground border border-border/50">{t('common.cancel')}</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {filtered.map(tp => (
                    <div key={tp.id} className={`bg-card p-4 rounded-xl border cursor-pointer transition-colors ${selectedId === tp.id ? 'border-primary' : 'border-border'}`}
                        onClick={() => setSelectedId(selectedId === tp.id ? null : tp.id)}>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-foreground">{tp.name}</div>
                                <div className="text-xs text-muted-foreground">{tp.description}</div>
                                {tp.category && <span className="text-xs text-primary/70 mt-1 inline-block">{tp.category}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={e => { e.stopPropagation(); startEdit(tp); }} className="px-3 py-1.5 rounded-md text-xs font-bold bg-accent/20 text-muted-foreground border border-border/50">{t('common.edit')}</button>
                                <button onClick={e => { e.stopPropagation(); void handleDelete(tp.id); }} className="px-3 py-1.5 rounded-md text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20">{t('common.delete')}</button>
                            </div>
                        </div>
                        {selectedId === tp.id && selected && (
                            <pre className="mt-3 p-3 bg-muted/20 rounded-lg text-xs text-foreground/80 font-mono whitespace-pre-wrap overflow-auto max-h-48">{selected.template}</pre>
                        )}
                    </div>
                ))}
                {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{t('prompts.library.empty')}</p>}
            </div>
        </div>
    );
};
