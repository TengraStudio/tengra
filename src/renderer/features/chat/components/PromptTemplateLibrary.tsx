import { PromptTemplate } from '@shared/types/templates';
import { BookTemplate, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface PromptTemplateLibraryProps {
    /** Called when a template is selected for insertion into chat */
    onInsert: (text: string) => void
    /** Called to close the library panel */
    onClose: () => void
}

/**
 * Chat-integrated prompt template browser.
 * Allows searching, filtering by category, and inserting templates into chat input.
 */
export const PromptTemplateLibrary: React.FC<PromptTemplateLibraryProps> = ({ onInsert, onClose }) => {
    const { t } = useTranslation();
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [search, setSearch] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState('');

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

    const filtered = activeCategory
        ? templates.filter(tp => tp.category === activeCategory)
        : templates;

    /** Inserts the template text and closes the panel */
    const handleInsert = (template: PromptTemplate) => {
        onInsert(template.template);
        onClose();
    };

    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-30 max-h-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl flex flex-col">
            <div className="flex items-center gap-2 p-3 border-b border-border">
                <BookTemplate className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">{t('prompts.library.title')}</span>
                <div className="flex-1" />
                <button onClick={onClose} className="p-1 rounded hover:bg-muted/30">
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('prompts.library.searchPlaceholder')}
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
            </div>
            {categories.length > 0 && (
                <div className="flex gap-1 px-3 py-1.5 overflow-x-auto border-b border-border/50">
                    <button
                        onClick={() => setActiveCategory('')}
                        className={cn('px-2 py-0.5 rounded text-xs whitespace-nowrap', !activeCategory ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted/20')}
                    >
                        {t('prompts.library.all')}
                    </button>
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setActiveCategory(c)}
                            className={cn('px-2 py-0.5 rounded text-xs whitespace-nowrap', activeCategory === c ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted/20')}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filtered.map(tp => (
                    <button
                        key={tp.id}
                        onClick={() => handleInsert(tp)}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-muted/20 transition-colors group"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{tp.name}</span>
                            {tp.category && (
                                <span className="px-1.5 py-0.5 rounded text-xxs bg-primary/10 text-primary/70">{tp.category}</span>
                            )}
                        </div>
                        {tp.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tp.description}</p>
                        )}
                    </button>
                ))}
                {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">{t('prompts.library.empty')}</p>
                )}
            </div>
        </div>
    );
};
