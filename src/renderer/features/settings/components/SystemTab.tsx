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

import type { SettingsSharedProps } from '../types';

import {
    SettingsPanel,
    SettingsSwitch,
    SettingsTabHeader,
    SettingsTabLayout,
    SettingsToggleRow,
} from './SettingsPrimitives';


type SystemTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'setSettings' | 'updateWindow' | 't'
>;

export const SystemTab: React.FC<SystemTabProps> = ({
    settings,
    setSettings,
    updateWindow,
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
        void setSettings({
            ...settings,
            autoUpdate: {
                ...autoUpdate,
                ...patch,
            },
        });
    };

    return (
        <SettingsTabLayout className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsPanel
                title={t('frontend.general.autoUpdate')}
                description={t('frontend.settings.downloadUpdatesAutomaticallyDescription')}
                icon={IconCloudDownload}
                actions={(
                    <Button
                        variant="outline"
                        onClick={() => {
                            void window.electron.update.checkForUpdates();
                        }}
                        className="h-10 rounded-xl border-primary/20 bg-primary/5 px-5 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                        {t('frontend.general.checkForUpdates')}
                    </Button>
                )}
            >
                <div className="grid gap-4 md:grid-cols-2 px-6 py-2">
                    <SettingsToggleRow
                        title={t('frontend.general.autoUpdate')}
                        description={t('frontend.general.autoUpdateDesc')}
                        control={<SettingsSwitch checked={autoUpdate.enabled} onCheckedChange={checked => updateAutoUpdate({ enabled: checked })} />}
                    />
                    <SettingsToggleRow
                        title={t('frontend.general.checkOnStartup')}
                        description={t('frontend.general.checkOnStartupDesc')}
                        control={<SettingsSwitch checked={autoUpdate.checkOnStartup} onCheckedChange={checked => updateAutoUpdate({ checkOnStartup: checked })} />}
                    />
                    <div className="md:col-span-2">
                        <SettingsToggleRow
                            title={t('frontend.settings.downloadUpdatesAutomatically')}
                            description={t('frontend.settings.downloadUpdatesAutomaticallyDescription')}
                            control={<SettingsSwitch checked={autoUpdate.downloadAutomatically} onCheckedChange={checked => updateAutoUpdate({ downloadAutomatically: checked })} />}
                        />
                    </div>
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('frontend.settings.runtimeTitle')}
                description={t('frontend.general.workAtBackgroundDesc')}
                icon={IconCpu}
            >
                <div className="grid gap-4 md:grid-cols-2 px-6 py-2">
                    <SettingsToggleRow
                        title={t('frontend.general.startOnStartup')}
                        description={t('frontend.general.startOnStartupDesc')}
                        control={<SettingsSwitch checked={settings?.window?.startOnStartup ?? true} onCheckedChange={checked => { void updateWindow({ startOnStartup: checked }); }} />}
                        icon={IconPower}
                    />
                    <SettingsToggleRow
                        title={t('frontend.general.workAtBackground')}
                        description={t('frontend.general.workAtBackgroundDesc')}
                        control={<SettingsSwitch checked={settings?.window?.workAtBackground ?? true} onCheckedChange={checked => { void updateWindow({ workAtBackground: checked }); }} />}
                        icon={IconTerminal}
                    />
                    <SettingsToggleRow
                        title={t('frontend.settings.lowPowerMode')}
                        description={t('frontend.settings.lowPowerModeDescription')}
                        control={<SettingsSwitch checked={settings?.window?.lowPowerMode ?? true} onCheckedChange={checked => { void updateWindow({ lowPowerMode: checked }); }} />}
                        icon={IconBolt}
                    />
                    <SettingsToggleRow
                        title={t('frontend.settings.autoHibernation')}
                        description={t('frontend.settings.autoHibernationDescription')}
                        control={<SettingsSwitch checked={settings?.window?.autoHibernation ?? true} onCheckedChange={checked => { void updateWindow({ autoHibernation: checked }); }} />}
                        icon={IconShieldCheck}
                    />
                </div>
            </SettingsPanel>
        </SettingsTabLayout>
    );
};

