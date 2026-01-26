import React from 'react';

import { AppSettings } from '@/types/settings';

type PersonaDraft = { name: string; description: string; prompt: string }

interface PersonasTabProps {
    settings: AppSettings | null
    editingPersonaId: string | null
    setEditingPersonaId: (id: string | null) => void
    personaDraft: PersonaDraft
    setPersonaDraft: (d: PersonaDraft) => void
    handleSavePersona: () => void
    handleDeletePersona: (id: string) => void
    t: (key: string) => string
}

export const PersonasTab: React.FC<PersonasTabProps> = ({
    settings, editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona, t
}) => {
    if (!settings) { return null; }
    const personas = settings.personas || [];

    return (
        <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                <div><h3 className="text-lg font-bold text-foreground">{t('settings.personas')}</h3><p className="text-xs text-muted-foreground">{t('personas.description')}</p></div>
                <div className="grid grid-cols-1 gap-3">
                    <input type="text" placeholder={t('personas.namePlaceholder')} value={personaDraft.name} onChange={e => setPersonaDraft({ ...personaDraft, name: e.target.value })} className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                    <input type="text" placeholder={t('personas.descriptionPlaceholder')} value={personaDraft.description} onChange={e => setPersonaDraft({ ...personaDraft, description: e.target.value })} className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
                    <textarea placeholder={t('personas.promptPlaceholder')} value={personaDraft.prompt} onChange={e => setPersonaDraft({ ...personaDraft, prompt: e.target.value })} className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground min-h-[120px]" />
                    <div className="flex items-center gap-2">
                        <button onClick={handleSavePersona} className="px-3 py-2 rounded-lg text-xs font-bold bg-primary/20 text-primary border border-border/50">{editingPersonaId ? t('common.update') : t('common.add')}</button>
                        {editingPersonaId && <button onClick={() => { setEditingPersonaId(null); setPersonaDraft({ name: '', description: '', prompt: '' }); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-accent/20 text-muted-foreground border border-border/50">{t('common.cancel')}</button>}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
                {personas.map(p => (
                    <div key={p.id} className="bg-card p-4 rounded-xl border border-border flex items-center justify-between gap-4">
                        <div><div className="text-sm font-bold text-foreground">{p.name}</div><div className="text-xs text-muted-foreground">{p.description}</div></div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { setEditingPersonaId(p.id); setPersonaDraft(p); }} className="px-3 py-1.5 rounded-md text-xs font-bold bg-accent/20 text-muted-foreground border border-border/50">{t('common.edit')}</button>
                            <button onClick={() => handleDeletePersona(p.id)} className="px-3 py-1.5 rounded-md text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">{t('common.delete')}</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


