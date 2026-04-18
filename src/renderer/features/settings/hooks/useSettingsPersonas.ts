/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useMemo, useState } from 'react';

import { AppSettings } from '@/types';

import { PersonaDraft } from '../types';

export function useSettingsPersonas(
    settings: AppSettings | null,
    updateSettings: (s: AppSettings, save: boolean) => Promise<void>
) {
    const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
    const [personaDraft, setPersonaDraft] = useState<PersonaDraft>({ name: '', description: '', prompt: '' });

    const handleSavePersona = useCallback(async () => {
        if (!settings || !personaDraft.name.trim()) { return; }
        const next = { ...settings };
        const personas = [...(settings.personas ?? [])];
        if (editingPersonaId) {
            const idx = personas.findIndex(p => p.id === editingPersonaId);
            if (idx >= 0) {
                const existingPersona = personas[idx];
                personas[idx] = { ...existingPersona, ...personaDraft };
            }
        } else {
            personas.push({ id: `${Date.now()}`, ...personaDraft });
        }
        next.personas = personas;
        await updateSettings(next, true);
        setPersonaDraft({ name: '', description: '', prompt: '' });
        setEditingPersonaId(null);
    }, [settings, personaDraft, editingPersonaId, updateSettings]);

    const handleDeletePersona = useCallback(async (personaId: string) => {
        if (!settings) { return; }
        const next = { ...settings };
        const personas = settings.personas ?? [];
        next.personas = personas.filter(p => p.id !== personaId);
        await updateSettings(next, true);
        if (editingPersonaId === personaId) {
            setEditingPersonaId(null);
            setPersonaDraft({ name: '', description: '', prompt: '' });
        }
    }, [settings, editingPersonaId, updateSettings]);

    return useMemo(() => ({
        editingPersonaId,
        setEditingPersonaId,
        personaDraft,
        setPersonaDraft,
        handleSavePersona,
        handleDeletePersona
    }), [editingPersonaId, personaDraft, handleSavePersona, handleDeletePersona]);
}
