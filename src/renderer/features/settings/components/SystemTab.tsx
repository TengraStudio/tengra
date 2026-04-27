/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBolt,IconCloudDownload, IconCpu, IconPower, IconSettings, IconShieldCheck, IconTerminal } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { AppSettings } from '@/types/settings';

import type { SettingsSharedProps } from '../types';

/* Batch-02: Extracted Long Classes */
const C_SYSTEMTAB_1 = "h-10 rounded-xl border-primary/20 bg-primary/5 px-5 typo-body font-medium text-primary hover:bg-primary hover:text-primary-foreground";
const C_SYSTEMTAB_2 = "flex flex-col gap-4 rounded-2xl border border-border/20 bg-muted/5 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between";
const C_SYSTEMTAB_3 = "flex flex-col gap-4 rounded-2xl border border-border/20 bg-muted/5 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between";
const C_SYSTEMTAB_4 = "flex flex-col gap-4 rounded-2xl border border-border/20 bg-muted/5 p-4 transition-colors md:col-span-2 sm:flex-row sm:items-center sm:justify-between";
const C_SYSTEMTAB_5 = "flex flex-col gap-4 rounded-2xl border border-border/20 bg-muted/5 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between";
const C_SYSTEMTAB_6 = "flex flex-col gap-4 rounded-2xl border border-border/20 bg-muted/5 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between";
const C_SYSTEMTAB_7 = "flex flex-col gap-4 rounded-2xl border border-border/20 bg-muted/5 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between";
const C_SYSTEMTAB_8 = "flex flex-col gap-4 rounded-2xl border border-border/20 bg-muted/5 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between";


type SystemTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'handleSave' | 't'
>;

export const SystemTab: React.FC<SystemTabProps> = ({
    settings,
    handleSave,
    t,
}) => {
    const autoUpdate = settings?.autoUpdate ?? {
        enabled: true,
        checkOnStartup: true,
        downloadAutomatically: true,
        notifyOnly: false,
    };

    const updateAutoUpdate = (patch: Partial<typeof autoUpdate>) => {
        if (!settings) {
            return;
        }
        void handleSave({
            ...settings,
            autoUpdate: {
                ...autoUpdate,
                ...patch,
            },
        });
    };

    const updateWindow = (patch: Partial<NonNullable<AppSettings['window']>>) => {
        if (!settings) {
            return;
        }
        void handleSave({
            ...settings,
            window: {
                width: settings.window?.width ?? 1280,
                height: settings.window?.height ?? 800,
                x: settings.window?.x ?? 0,
                y: settings.window?.y ?? 0,
                ...settings.window,
                ...patch,
            },
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out pb-16">
            <div className="px-1">
                <div className="flex items-center gap-4 mb-3">
                    <div className="rounded-2xl bg-primary/10 p-3.5 text-primary">
                        <IconSettings className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-semibold text-foreground leading-none">
                            {t('settings.systemTitle')}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="h-1 w-8 rounded-full bg-primary" />
                            <p className="typo-body font-medium text-muted-foreground opacity-60">
                                OS Orchestration Hub
                            </p>
                        </div>
                    </div>
                </div>
                <p className="max-w-2xl px-1 text-sm leading-relaxed text-muted-foreground/70">
                    {t('settings.systemDescription')}
                </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border/30 bg-card p-6 sm:p-8">
                <div className="relative z-10 flex flex-col gap-6 px-1 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                            <IconCloudDownload className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">
                                {t('general.autoUpdate')}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground/70">
                                Deployment Protocols
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => {
                            void window.electron.update.checkForUpdates();
                        }}
                        className={C_SYSTEMTAB_1}
                    >
                        {t('general.checkForUpdates')}
                    </Button>
                </div>

                <div className="relative z-10 mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className={C_SYSTEMTAB_2}>
                        <div className="space-y-1">
                            <div className="typo-body font-medium text-foreground">{t('general.autoUpdate')}</div>
                            <div className="max-w-240 typo-body leading-relaxed text-muted-foreground/70">
                                {t('general.autoUpdateDesc')}
                            </div>
                        </div>
                        <Switch
                            checked={autoUpdate.enabled}
                            onCheckedChange={checked => updateAutoUpdate({ enabled: checked })}
                        />
                    </div>

                    <div className={C_SYSTEMTAB_3}>
                        <div className="space-y-1">
                            <div className="typo-body font-medium text-foreground">{t('general.checkOnStartup')}</div>
                            <div className="max-w-240 typo-body leading-relaxed text-muted-foreground/70">
                                {t('general.checkOnStartupDesc')}
                            </div>
                        </div>
                        <Switch
                            checked={autoUpdate.checkOnStartup}
                            onCheckedChange={checked => updateAutoUpdate({ checkOnStartup: checked })}
                        />
                    </div>

                    <div className={C_SYSTEMTAB_4}>
                        <div className="space-y-1">
                            <div className="typo-body font-medium text-foreground">{t('settings.downloadUpdatesAutomatically')}</div>
                            <div className="max-w-420 typo-body leading-relaxed text-muted-foreground/70">
                                {t('settings.downloadUpdatesAutomaticallyDescription')}
                            </div>
                        </div>
                        <Switch
                            checked={autoUpdate.downloadAutomatically}
                            onCheckedChange={checked => updateAutoUpdate({ downloadAutomatically: checked })}
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border/30 bg-card p-6 sm:p-8">
                <div className="relative z-10 flex items-center gap-4 px-1">
                    <div className="rounded-2xl bg-primary/10 p-3.5 text-primary">
                        <IconCpu className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('settings.runtimeTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground/70">
                            Process Life-Cycle
                        </p>
                    </div>
                </div>

                <div className="relative z-10 mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className={C_SYSTEMTAB_5}>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 typo-body font-medium text-foreground">
                                <IconPower className="w-3.5 h-3.5 text-primary opacity-40" />
                                {t('general.startOnStartup')}
                            </div>
                            <div className="typo-body leading-relaxed text-muted-foreground/70">
                                {t('general.startOnStartupDesc')}
                            </div>
                        </div>
                        <Switch
                            checked={settings?.window?.startOnStartup ?? true}
                            onCheckedChange={checked => updateWindow({ startOnStartup: checked })}
                        />
                    </div>

                    <div className={C_SYSTEMTAB_6}>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 typo-body font-medium text-foreground">
                                <IconTerminal className="w-3.5 h-3.5 text-primary opacity-40" />
                                {t('general.workAtBackground')}
                            </div>
                            <div className="typo-body leading-relaxed text-muted-foreground/70">
                                {t('general.workAtBackgroundDesc')}
                            </div>
                        </div>
                        <Switch
                            checked={settings?.window?.workAtBackground ?? true}
                            onCheckedChange={checked => updateWindow({ workAtBackground: checked })}
                        />
                    </div>

                    <div className={C_SYSTEMTAB_7}>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 typo-body font-medium text-foreground">
                                <IconBolt className="w-3.5 h-3.5 text-primary opacity-40" />
                                {t('settings.lowPowerMode')}
                            </div>
                            <div className="typo-body leading-relaxed text-muted-foreground/70">
                                {t('settings.lowPowerModeDescription')}
                            </div>
                        </div>
                        <Switch
                            checked={settings?.window?.lowPowerMode ?? true}
                            onCheckedChange={checked => updateWindow({ lowPowerMode: checked })}
                        />
                    </div>

                    <div className={C_SYSTEMTAB_8}>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 typo-body font-medium text-foreground">
                                <IconShieldCheck className="w-3.5 h-3.5 text-primary opacity-40" />
                                {t('settings.autoHibernation')}
                            </div>
                            <div className="typo-body leading-relaxed text-muted-foreground/70">
                                {t('settings.autoHibernationDescription')}
                            </div>
                        </div>
                        <Switch
                            checked={settings?.window?.autoHibernation ?? true}
                            onCheckedChange={checked => updateWindow({ autoHibernation: checked })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
