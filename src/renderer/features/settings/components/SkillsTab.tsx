/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MarketplaceSkill } from '@shared/types/marketplace';
import type { ProxySkill } from '@shared/types/skill';
import { IconRefresh, IconSparkles, IconTrash } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { marketplaceStore, useMarketplaceStore } from '@/store/marketplace.store';
import { pushNotification } from '@/store/notification-center.store';

import type { SettingsSharedProps } from '../types';

import { SettingsPanel } from './SettingsPrimitives';

/* Batch-02: Extracted Long Classes */
const C_SKILLSTAB_1 = "flex items-center gap-3 bg-muted/40 px-3 py-1.5 rounded-xl border border-border/10 ring-1 ring-inset ring-border/20 shadow-sm sm:gap-4";
const C_SKILLSTAB_2 = "h-9 gap-2 px-4 rounded-xl font-bold uppercase text-sm shadow-lg shadow-destructive/20 active:scale-95";
const C_SKILLSTAB_3 = "h-9 w-9 rounded-xl border-destructive/20 text-destructive/60 hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40 transition-all active:scale-90 shadow-sm";


type SkillsTabProps = Pick<SettingsSharedProps, 't'>;

function normalizeTranslation(value: string, fallback: string): string {
    return value.includes('.') ? fallback : value;
}

export const SkillsTab: React.FC<SkillsTabProps> = ({ t }) => {
    const [skills, setSkills] = useState<ProxySkill[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const registry = useMarketplaceStore(s => s.registry);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            setSkills(await window.electron.auth.listSkills());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadData();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadData]);

    const handleToggle = useCallback(async (skill: ProxySkill, enabled: boolean) => {
        await window.electron.auth.toggleSkill(skill.id, enabled);
        await loadData();
    }, [loadData]);

    const handleUninstall = useCallback(async (skillId: string) => {
        setRemovingId(skillId);
        try {
            await window.electron.auth.deleteSkill(skillId);
            await loadData();
        } finally {
            setRemovingId(null);
        }
    }, [loadData]);

    const handleUpdate = useCallback(async (skillId: string) => {
        setUpdatingId(skillId);
        try {
            const mItem = (registry?.skills || []).find((m: MarketplaceSkill) => m.id === skillId);
            if (!mItem) {
                throw new Error('Skill not found in registry');
            }

            const result = await window.electron.marketplace.install({
                type: 'skill',
                id: skillId,
                downloadUrl: mItem.downloadUrl,
                name: mItem.name,
                description: mItem.description,
                author: mItem.author,
                version: mItem.version,
            });
            if (result.success) {
                pushNotification({ type: 'success', message: t('frontend.settings.extensions.plugins.updateSuccess') });
                void marketplaceStore.checkLiveUpdates();
                await loadData();
            }
        } finally {
            setUpdatingId(null);
        }
    }, [loadData, registry?.skills, t]);

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
            <header className="space-y-2 px-1">
                <h2 className="text-2xl font-semibold ">
                    {normalizeTranslation(t('frontend.settings.tabs.skills'), 'Skills')}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {normalizeTranslation(t('frontend.settings.skills.description'), 'Manage installed skills. Install new ones from Marketplace > Skills.')}
                </p>
            </header>

            <SettingsPanel
                title={normalizeTranslation(t('frontend.settings.skills.libraryTitle'), 'Installed Skills')}
                description={normalizeTranslation(t('frontend.settings.skills.libraryDescription'), 'Enable, disable, or uninstall installed skills.')}
                icon={IconSparkles}
            >
                {loading ? (
                    <div className="py-4 typo-caption text-muted-foreground">
                        {normalizeTranslation(t('common.loading'), 'Loading...')}
                    </div>
                ) : skills.length === 0 ? (
                    <div className="rounded-xl border border-border/25 bg-background/40 p-3 typo-caption text-muted-foreground">
                        {normalizeTranslation(t('frontend.settings.skills.empty'), 'No installed skills yet.')}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {skills.map(skill => {
                            const isRemoving = removingId === skill.id;
                            const isActive = skill.enabled;
                            
                            return (
                                <div 
                                    key={skill.id} 
                                    className={cn(
                                        "group relative flex items-center justify-between gap-5 rounded-2xl border p-5 transition-all duration-300",
                                        isActive
                                            ? "border-primary/40 bg-card/10 shadow-glow-primary-ring ring-1 ring-primary/20"
                                            : "border-border/30 bg-muted/20 hover:border-border/60"
                                    )}
                                >
                                    <div className="flex flex-1 items-center gap-5">
                                        <div className={cn(
                                            "rounded-xl p-3 transition-all duration-300 shadow-inner",
                                            isActive
                                                ? "bg-primary/20 text-primary ring-1 ring-inset ring-primary/30 group-hover:scale-110"
                                                : "bg-muted/40 text-muted-foreground/40 opacity-50"
                                        )}>
                                            <IconSparkles className="h-6 w-6" />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-bold text-foreground leading-none">{skill.name}</h3>
                                                <Badge variant="outline" className={cn(
                                                    "text-sm h-4 font-bold uppercase px-2",
                                                    isActive ? "border-primary/30 text-primary bg-primary/5" : "bg-muted/20 text-muted-foreground/40"
                                                )}>
                                                    {skill.provider}
                                                </Badge>
                                            </div>
                                            <p className="mt-2 text-sm font-medium text-muted-foreground/70 line-clamp-1 leading-relaxed">
                                                {skill.description || normalizeTranslation(t('frontend.settings.skills.noDescription'), 'No description')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className={C_SKILLSTAB_1}>
                                            <span className={cn(
                                                "text-sm font-bold uppercase ",
                                                isActive ? "text-primary shadow-glow-primary-rgb" : "text-muted-foreground/30"
                                            )}>
                                                {isActive ? t('common.active') : t('common.disabled')}
                                            </span>
                                            <Switch
                                                checked={skill.enabled}
                                                onCheckedChange={checked => {
                                                    void handleToggle(skill, checked);
                                                }}
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {(registry?.skills || []).some(m => m.id === skill.id && m.updateAvailable) && (
                                                <Button
                                                    size="xs"
                                                    variant="destructive"
                                                    className={C_SKILLSTAB_2}
                                                    disabled={updatingId === skill.id}
                                                    onClick={() => {
                                                        void handleUpdate(skill.id);
                                                    }}
                                                >
                                                    <IconRefresh className={cn("h-3.5 w-3.5", updatingId === skill.id && "animate-spin")} />
                                                    {t('common.update')}
                                                </Button>
                                            )}

                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className={C_SKILLSTAB_3}
                                                disabled={isRemoving || updatingId === skill.id}
                                                onClick={() => {
                                                    void handleUninstall(skill.id);
                                                }}
                                            >
                                                {isRemoving ? <IconRefresh className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    {isActive && (
                                        <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full shadow-edge-primary" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </SettingsPanel>
        </div>
    );
};


