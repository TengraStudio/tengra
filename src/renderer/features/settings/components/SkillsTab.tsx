import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Switch } from '@renderer/components/ui/switch';
import type { ProxySkill } from '@shared/types/skill';
import { RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { SettingsSharedProps } from '../types';

import { SettingsPanel } from './SettingsPrimitives';

type SkillsTabProps = Pick<SettingsSharedProps, 't'>;

function normalizeTranslation(value: string, fallback: string): string {
    return value.includes('.') ? fallback : value;
}

export const SkillsTab: React.FC<SkillsTabProps> = ({ t }) => {
    const [skills, setSkills] = useState<ProxySkill[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            setSkills(await window.electron.listSkills());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleToggle = useCallback(async (skill: ProxySkill, enabled: boolean) => {
        await window.electron.toggleSkill(skill.id, enabled);
        await loadData();
    }, [loadData]);

    const handleUninstall = useCallback(async (skillId: string) => {
        setRemovingId(skillId);
        try {
            await window.electron.deleteSkill(skillId);
            await loadData();
        } finally {
            setRemovingId(null);
        }
    }, [loadData]);

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
            <header className="space-y-2 px-1">
                <h2 className="text-2xl font-semibold tracking-tight">
                    {normalizeTranslation(t('settings.tabs.skills'), 'Skills')}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {normalizeTranslation(t('settings.skills.description'), 'Manage installed skills. Install new ones from Marketplace > Skills.')}
                </p>
            </header>

            <SettingsPanel
                title={normalizeTranslation(t('settings.skills.libraryTitle'), 'Installed Skills')}
                description={normalizeTranslation(t('settings.skills.libraryDescription'), 'Enable, disable, or uninstall installed skills.')}
                icon={Sparkles}
            >
                {loading ? (
                    <div className="py-4 typo-caption text-muted-foreground">
                        {normalizeTranslation(t('common.loading'), 'Loading...')}
                    </div>
                ) : skills.length === 0 ? (
                    <div className="rounded-xl border border-border/25 bg-background/40 p-3 typo-caption text-muted-foreground">
                        {normalizeTranslation(t('settings.skills.empty'), 'No installed skills yet.')}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {skills.map(skill => {
                            const isRemoving = removingId === skill.id;
                            return (
                                <div key={skill.id} className="rounded-xl border border-border/20 bg-background/40 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{skill.name}</p>
                                            <p className="mt-1 line-clamp-2 typo-caption text-muted-foreground">
                                                {skill.description || normalizeTranslation(t('settings.skills.noDescription'), 'No description')}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="typo-body uppercase">
                                            {skill.provider}
                                        </Badge>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-2">
                                        <Switch
                                            checked={skill.enabled}
                                            onCheckedChange={checked => {
                                                void handleToggle(skill, checked);
                                            }}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={isRemoving}
                                            onClick={() => {
                                                void handleUninstall(skill.id);
                                            }}
                                        >
                                            {isRemoving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SettingsPanel>
        </div>
    );
};

