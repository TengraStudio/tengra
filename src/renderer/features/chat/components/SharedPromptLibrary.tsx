/**
 * SharedPromptLibrary component
 * Lists shared prompts with search/filter, create/edit, import/export, and insert into chat.
 */

import { BookOpen, Download, Edit2, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';

/** Shape of a shared prompt from the backend. */
interface SharedPrompt {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    author: string;
    createdAt: number;
    updatedAt: number;
}

/** Props for the SharedPromptLibrary component. */
interface SharedPromptLibraryProps {
    onInsertPrompt: (content: string) => void;
    language?: string;
}

/** Props for the prompt form sub-component. */
interface PromptFormData {
    title: string;
    content: string;
    category: string;
    tags: string;
    author: string;
}

const EMPTY_FORM: PromptFormData = { title: '', content: '', category: '', tags: '', author: '' };

/**
 * Shared Prompt Library - Browse, create, edit, import/export shared prompts.
 */
export const SharedPromptLibrary: React.FC<SharedPromptLibraryProps> = React.memo(({ onInsertPrompt }) => {
    const { t } = useTranslation();
    const [prompts, setPrompts] = useState<SharedPrompt[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<PromptFormData>(EMPTY_FORM);
    const sharedPromptsApi = window.electron.sharedPrompts;

    const loadPrompts = useCallback(async () => {
        const result = await sharedPromptsApi.list({ query: searchQuery || undefined }) as SharedPrompt[];
        setPrompts(Array.isArray(result) ? result : []);
    }, [searchQuery, sharedPromptsApi]);

    useEffect(() => { requestAnimationFrame(() => { void loadPrompts(); }); }, [loadPrompts]);

    const handleSave = useCallback(async () => {
        const input = {
            title: form.title,
            content: form.content,
            category: form.category,
            tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
            author: form.author,
        };
        if (editingId) {
            await sharedPromptsApi.update(editingId, input);
        } else {
            await sharedPromptsApi.create(input);
        }
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        await loadPrompts();
    }, [editingId, form, loadPrompts, sharedPromptsApi]);

    const handleDelete = useCallback(async (id: string) => {
        await sharedPromptsApi.delete(id);
        await loadPrompts();
    }, [loadPrompts, sharedPromptsApi]);

    const handleEdit = useCallback((prompt: SharedPrompt) => {
        setForm({
            title: prompt.title,
            content: prompt.content,
            category: prompt.category,
            tags: prompt.tags.join(', '),
            author: prompt.author,
        });
        setEditingId(prompt.id);
        setShowForm(true);
    }, []);

    const handleExport = useCallback(async () => {
        const result = await sharedPromptsApi.export();
        if (result?.data) {
            const blob = new Blob([result.data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'shared-prompts.json';
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [sharedPromptsApi]);

    const handleImport = useCallback(async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {return;}
            const text = await file.text();
            await sharedPromptsApi.import(text, false);
            await loadPrompts();
        };
        input.click();
    }, [loadPrompts, sharedPromptsApi]);

    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            <SharedPromptHeader
                t={t}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onAdd={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}
                onExport={() => void handleExport()}
                onImport={() => void handleImport()}
            />
            {showForm && (
                <SharedPromptForm
                    t={t}
                    form={form}
                    isEditing={!!editingId}
                    onFormChange={setForm}
                    onSave={() => void handleSave()}
                    onCancel={() => { setShowForm(false); setEditingId(null); }}
                />
            )}
            <SharedPromptList
                t={t}
                prompts={prompts}
                onInsert={onInsertPrompt}
                onEdit={handleEdit}
                onDelete={(id: string) => void handleDelete(id)}
            />
        </div>
    );
});

SharedPromptLibrary.displayName = 'SharedPromptLibrary';

/* ── Sub-components ── */

interface HeaderProps {
    t: (key: string) => string;
    searchQuery: string;
    onSearchChange: (val: string) => void;
    onAdd: () => void;
    onExport: () => void;
    onImport: () => void;
}

const SharedPromptHeader: React.FC<HeaderProps> = ({ t, searchQuery, onSearchChange, onAdd, onExport, onImport }) => (
    <div className="flex items-center gap-2 p-3 border-b border-border">
        <BookOpen size={18} />
        <span className="font-semibold text-sm">{t('sharedPrompts.title')}</span>
        <div className="flex-1 relative ml-2">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('sharedPrompts.searchPlaceholder')}
                className="w-full pl-7 pr-2 py-1 typo-caption rounded bg-muted/40 border border-border"
            />
        </div>
        <button onClick={onAdd} className="p-1.5 rounded hover:bg-accent/60" title={t('sharedPrompts.create')}>
            <Plus size={16} />
        </button>
        <button onClick={onImport} className="p-1.5 rounded hover:bg-accent/60" title={t('sharedPrompts.import')}>
            <Upload size={16} />
        </button>
        <button onClick={onExport} className="p-1.5 rounded hover:bg-accent/60" title={t('sharedPrompts.export')}>
            <Download size={16} />
        </button>
    </div>
);

interface FormProps {
    t: (key: string) => string;
    form: PromptFormData;
    isEditing: boolean;
    onFormChange: (form: PromptFormData) => void;
    onSave: () => void;
    onCancel: () => void;
}

const SharedPromptForm: React.FC<FormProps> = ({ t, form, isEditing, onFormChange, onSave, onCancel }) => (
    <div className="p-3 border-b border-border bg-muted/40">
        <div className="flex justify-between items-center mb-2">
            <span className="typo-caption font-semibold">
                {isEditing ? t('sharedPrompts.editPrompt') : t('sharedPrompts.createPrompt')}
            </span>
            <button onClick={onCancel} className="p-1 rounded hover:bg-accent/60">
                <X size={14} />
            </button>
        </div>
        <input
            value={form.title}
            onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            placeholder={t('sharedPrompts.titlePlaceholder')}
            className="w-full mb-2 px-2 py-1 typo-caption rounded bg-background border border-border"
        />
        <textarea
            value={form.content}
            onChange={(e) => onFormChange({ ...form, content: e.target.value })}
            placeholder={t('sharedPrompts.contentPlaceholder')}
            rows={3}
            className="w-full mb-2 px-2 py-1 typo-caption rounded bg-background border border-border resize-none"
        />
        <div className="flex gap-2 mb-2">
            <input
                value={form.category}
                onChange={(e) => onFormChange({ ...form, category: e.target.value })}
                placeholder={t('sharedPrompts.categoryPlaceholder')}
                className="flex-1 px-2 py-1 typo-caption rounded bg-background border border-border"
            />
            <input
                value={form.tags}
                onChange={(e) => onFormChange({ ...form, tags: e.target.value })}
                placeholder={t('sharedPrompts.tagsPlaceholder')}
                className="flex-1 px-2 py-1 typo-caption rounded bg-background border border-border"
            />
        </div>
        <button
            onClick={onSave}
            className="px-3 py-1 typo-caption rounded bg-primary text-foreground hover:opacity-90"
        >
            {isEditing ? t('common.save') : t('common.create')}
        </button>
    </div>
);

interface ListProps {
    t: (key: string) => string;
    prompts: SharedPrompt[];
    onInsert: (content: string) => void;
    onEdit: (prompt: SharedPrompt) => void;
    onDelete: (id: string) => void;
}

const SharedPromptList: React.FC<ListProps> = ({ t, prompts, onInsert, onEdit, onDelete }) => (
    <div className="flex-1 overflow-y-auto p-2">
        {prompts.length === 0 && (
            <div className="text-center typo-caption text-muted-foreground mt-8">
                {t('sharedPrompts.empty')}
            </div>
        )}
        {prompts.map((prompt) => (
            <div
                key={prompt.id}
                className="p-2 mb-1 rounded border border-border hover:bg-accent/60 cursor-pointer group"
                onClick={() => onInsert(prompt.content)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') {onInsert(prompt.content);} }}
            >
                <div className="flex justify-between items-start">
                    <span className="typo-caption font-medium">{prompt.title}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(prompt); }}
                            className="p-0.5 rounded hover:bg-accent"
                            title={t('common.edit')}
                        >
                            <Edit2 size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(prompt.id); }}
                            className="p-0.5 rounded hover:bg-accent text-destructive"
                            title={t('common.delete')}
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
                <p className="typo-caption text-muted-foreground mt-0.5 line-clamp-2">{prompt.content}</p>
                {prompt.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                        {prompt.tags.map((tag) => (
                            <span key={tag} className="text-xxxs px-1.5 py-0.5 rounded-full bg-muted">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        ))}
    </div>
);

