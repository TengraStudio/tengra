/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Textarea } from '@renderer/components/ui/textarea';
import { Brain, Edit2, MessageSquare, Plus, Sparkles, Trash2, User, Users, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { AppSettings } from '@/types/settings';

type PersonaDraft = { name: string; description: string; prompt: string };

interface PersonasTabProps {
    settings: AppSettings | null;
    editingPersonaId: string | null;
    setEditingPersonaId: (id: string | null) => void;
    personaDraft: PersonaDraft;
    setPersonaDraft: (d: PersonaDraft) => void;
    handleSavePersona: () => void;
    handleDeletePersona: (id: string) => void;
    t: (key: string) => string;
}

function SummaryCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-border/20 bg-background/60 px-4 py-4">
            <div className="typo-body text-muted-foreground">{label}</div>
            <div className="mt-2 text-lg font-medium text-foreground">{value}</div>
        </div>
    );
}

export const PersonasTab: React.FC<PersonasTabProps> = ({
    settings,
    editingPersonaId,
    setEditingPersonaId,
    personaDraft,
    setPersonaDraft,
    handleSavePersona,
    handleDeletePersona,
    t,
}) => {
    const personas = settings?.personas ?? [];
    const promptLength = personaDraft.prompt.trim().length;
    const hasDraft = personaDraft.name.trim() !== '' || personaDraft.prompt.trim() !== '';
    const selectedPersona = personas.find(persona => persona.id === editingPersonaId) ?? null;

    if (!settings) {
        return null;
    }

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
            <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard label={t('settings.personas')} value={String(personas.length)} />
                <SummaryCard label={t('personas.summary.editing')} value={selectedPersona?.name ?? t('personas.summary.new')} />
                <SummaryCard label={t('personas.summary.promptChars')} value={String(promptLength)} />
            </div>

            <div className="grid gap-6 xl:grid-cols-80-main">
                <section className="rounded-3xl border border-border/20 bg-muted/5 p-4">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-medium text-foreground">{t('settings.personas')}</h3>
                        </div>
                        <Badge variant="outline" className="border-border/20 typo-body text-muted-foreground">
                            {personas.length}
                        </Badge>
                    </div>

                    <div className="space-y-2">
                        {personas.length > 0 ? personas.map(persona => {
                            const isActive = persona.id === editingPersonaId;
                            return (
                                <button
                                    key={persona.id}
                                    type="button"
                                    onClick={() => {
                                        setEditingPersonaId(persona.id);
                                        setPersonaDraft(persona);
                                    }}
                                    className={cn(
                                        'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                                        isActive
                                            ? 'border-foreground/15 bg-background text-foreground'
                                            : 'border-border/15 bg-background/40 text-foreground hover:bg-background/70'
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium">{persona.name}</div>
                                            <div className="mt-1 line-clamp-2 typo-caption leading-5 text-muted-foreground">
                                                {persona.description}
                                            </div>
                                        </div>
                                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
                                    </div>
                                </button>
                            );
                        }) : (
                            <div className="rounded-2xl border border-dashed border-border/30 px-4 py-8 text-center typo-caption text-muted-foreground">
                                {t('personas.empty')}
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-3xl border border-border/20 bg-muted/5 p-5 md:p-6">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                                <Brain className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-foreground">
                                    {editingPersonaId ? t('common.update') : t('common.add')}
                                </h3>
                                <p className="typo-caption text-muted-foreground">{t('personas.description')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {editingPersonaId && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setEditingPersonaId(null);
                                        setPersonaDraft({ name: '', description: '', prompt: '' });
                                    }}
                                    className="h-10 rounded-full border-border/20 px-4 typo-caption"
                                >
                                    <X className="mr-2 h-3.5 w-3.5" />
                                    {t('common.cancel')}
                                </Button>
                            )}
                            <Button
                                onClick={handleSavePersona}
                                className="h-10 rounded-full px-4 typo-caption"
                            >
                                {editingPersonaId ? (
                                    <Edit2 className="mr-2 h-3.5 w-3.5" />
                                ) : (
                                    <Plus className="mr-2 h-3.5 w-3.5" />
                                )}
                                {editingPersonaId ? t('common.update') : t('common.add')}
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 flex items-center gap-2 pl-1 typo-body text-muted-foreground">
                                    <User className="h-3.5 w-3.5 text-primary/60" />
                                    {t('personas.nameLabel')}
                                </label>
                                <Input
                                    type="text"
                                    placeholder={t('personas.namePlaceholder')}
                                    value={personaDraft.name}
                                    onChange={event => {
                                        setPersonaDraft({ ...personaDraft, name: event.target.value });
                                    }}
                                    className="h-11 rounded-2xl border-border/20 bg-background"
                                />
                            </div>

                            <div>
                                <label className="mb-2 flex items-center gap-2 pl-1 typo-body text-muted-foreground">
                                    <MessageSquare className="h-3.5 w-3.5 text-primary/60" />
                                    {t('personas.descriptionLabel')}
                                </label>
                                <Input
                                    type="text"
                                    placeholder={t('personas.descriptionPlaceholder')}
                                    value={personaDraft.description}
                                    onChange={event => {
                                        setPersonaDraft({
                                            ...personaDraft,
                                            description: event.target.value,
                                        });
                                    }}
                                    className="h-11 rounded-2xl border-border/20 bg-background"
                                />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <SummaryCard label={t('personas.summary.status')} value={hasDraft ? t('personas.summary.draft') : t('personas.summary.idle')} />
                                <SummaryCard label={t('personas.summary.selected')} value={selectedPersona?.name ?? t('personas.summary.none')} />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 flex items-center gap-2 pl-1 typo-body text-muted-foreground">
                                <Brain className="h-3.5 w-3.5 text-primary/60" />
                                {t('personas.promptLabel')}
                            </label>
                            <Textarea
                                placeholder={t('personas.promptPlaceholder')}
                                value={personaDraft.prompt}
                                onChange={event => {
                                    setPersonaDraft({ ...personaDraft, prompt: event.target.value });
                                }}
                                className="min-h-260 rounded-2xl border border-border/20 bg-background px-4 py-3 text-sm leading-6"
                            />
                        </div>
                    </div>

                    {editingPersonaId && (
                        <div className="mt-5 flex justify-end">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    handleDeletePersona(editingPersonaId);
                                }}
                                className="h-10 rounded-full px-4 typo-caption text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                {t('common.delete')}
                            </Button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
