/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconClock, IconGlobe, IconSettings, IconShield, IconVolume } from '@tabler/icons-react';
import React, { useEffect, useMemo, useState } from 'react';

import {
    Select,
    SelectValue,
} from '@/components/ui/select';
import { useVoice } from '@/features/voice/hooks/useVoice';
import { localeRegistry } from '@/i18n/locale-registry.service';
import type { GroupedModels } from '@/types';

import type { SettingsSharedProps } from '../types';

import {
    SettingsField,
    SettingsInput,
    SettingsSelectContent,
    SettingsSelectItem,
    SettingsSelectTrigger,
    SettingsPanel,
    SettingsSwitch,
    SettingsToggleRow,
    SettingsTabLayout,
} from './SettingsPrimitives';

type GeneralTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'updateGeneral' | 't'
> & {
    groupedModels?: GroupedModels;
};

function normalizeCsvValue(value: string): string[] {
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
    settings,
    updateGeneral,
    t,
}) => {
    const { settings: voiceSettings, updateSettings: updateVoiceSettings } = useVoice();
    const [availableLocalesVersion, setAvailableLocalesVersion] = useState(0);

    useEffect(() => {
        void localeRegistry.loadLocales();
        return localeRegistry.subscribe(() => {
            setAvailableLocalesVersion(previousValue => previousValue + 1);
        });
    }, []);

    const languageOptions = useMemo(() => {
        void availableLocalesVersion;
        return localeRegistry.getAvailableLocales().map(locale => ({
            value: locale.locale,
            label: locale.nativeName,
        }));
    }, [availableLocalesVersion]);

    if (!settings) {
        return null;
    }

    return (
        <SettingsTabLayout>
            <SettingsPanel
                title={t('frontend.settings.generalTitle')}
                description={t('frontend.settings.generalDescription')}
                icon={IconSettings}
            >
                <div className="grid gap-5 md:grid-cols-2 px-4 py-2">
                    <SettingsField label={t('frontend.settings.language')}>
                        <Select
                            value={settings.general.language ?? 'en'}
                            onValueChange={value => {
                                void updateGeneral({ language: value });
                            }}
                        >
                            <SettingsSelectTrigger>
                                <div className="flex items-center gap-2">
                                    <IconGlobe className="h-3.5 w-3.5 text-primary/50" />
                                    <SelectValue />
                                </div>
                            </SettingsSelectTrigger>
                            <SettingsSelectContent>
                                {languageOptions.map(option => (
                                    <SettingsSelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SettingsSelectItem>
                                ))}
                            </SettingsSelectContent>
                        </Select>
                    </SettingsField>

                    <SettingsField label={t('frontend.general.contextMessageLimit')}>
                        <SettingsInput
                            type="number"
                            min={10}
                            max={200}
                            value={settings.general.contextMessageLimit ?? 50}
                            onChange={event => {
                                const nextValue = Number.parseInt(event.target.value, 10);
                                void updateGeneral({
                                    contextMessageLimit: Number.isNaN(nextValue) ? 50 : nextValue,
                                });
                            }}
                            className=""
                        />
                    </SettingsField>

                    <SettingsField label={t('frontend.settings.agentSoftDeadline')}>
                        <SettingsInput
                            type="number"
                            min={500}
                            step={500}
                            value={settings.general.agentSoftDeadlineMs ?? 4000}
                            onChange={event => {
                                const nextValue = Number.parseInt(event.target.value, 10);
                                void updateGeneral({
                                    agentSoftDeadlineMs: Number.isNaN(nextValue) ? 4000 : nextValue,
                                });
                            }}
                            className=""
                        />
                    </SettingsField>

                    <SettingsField label={t('frontend.settings.agentHardDeadline')}>
                        <SettingsInput
                            type="number"
                            min={1000}
                            step={1000}
                            value={settings.general.agentHardDeadlineMs ?? 25000}
                            onChange={event => {
                                const nextValue = Number.parseInt(event.target.value, 10);
                                void updateGeneral({
                                    agentHardDeadlineMs: Number.isNaN(nextValue) ? 25000 : nextValue,
                                });
                            }}
                            className=""
                        />
                    </SettingsField>

                    <div className="md:col-span-2">
                        <SettingsToggleRow
                            title={t('frontend.settings.agentPathPolicyTitle')}
                            description={t('frontend.settings.agentPathPolicyDescription')}
                            control={(
                                <SettingsSwitch
                                    checked={
                                        (settings.general.agentPathPolicy ?? 'workspace-root-only')
                                        === 'restricted-off-dangerous'
                                    }
                                    onCheckedChange={checked => {
                                        void updateGeneral({
                                            agentPathPolicy: checked
                                                ? 'restricted-off-dangerous'
                                                : 'workspace-root-only',
                                        });
                                    }}
                                />
                            )}
                            icon={IconShield}
                        />
                    </div>

                    <SettingsField label={t('frontend.settings.agentAllowedCommands')}>
                        <SettingsInput
                            type="text"
                            value={(settings.general.agentAllowedCommands ?? []).join(', ')}
                            onChange={event => {
                                void updateGeneral({
                                    agentAllowedCommands: normalizeCsvValue(event.target.value),
                                });
                            }}
                            className=""
                            placeholder={t('frontend.settings.agentAllowedCommandsPlaceholder')}
                        />
                    </SettingsField>

                    <SettingsField label={t('frontend.settings.agentDisallowedCommands')}>
                        <SettingsInput
                            type="text"
                            value={(settings.general.agentDisallowedCommands ?? []).join(', ')}
                            onChange={event => {
                                void updateGeneral({
                                    agentDisallowedCommands: normalizeCsvValue(event.target.value),
                                });
                            }}
                            className=""
                            placeholder={t('frontend.settings.agentDisallowedCommandsPlaceholder')}
                        />
                    </SettingsField>
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('frontend.voice.interfaceTitle')}
                description={t('frontend.voice.interfaceSubtitle')}
                icon={IconVolume}
            >
                <div className="px-4 py-2">
                    <SettingsToggleRow
                        title={t('frontend.settings.voiceInterfaceEnabled')}
                        description={t('frontend.settings.voiceInterfaceEnabledDescription')}
                        control={(
                            <SettingsSwitch
                                checked={voiceSettings.enabled}
                                onCheckedChange={checked => {
                                    void updateVoiceSettings({ enabled: checked });
                                }}
                            />
                        )}
                        icon={IconVolume}
                    />
                    <SettingsToggleRow
                        title={t('frontend.voice.continuousListening')}
                        description={t('frontend.settings.voiceContinuousListeningDescription')}
                        control={(
                            <SettingsSwitch
                                checked={voiceSettings.continuousListening}
                                onCheckedChange={checked => {
                                    void updateVoiceSettings({ continuousListening: checked });
                                }}
                            />
                        )}
                        icon={IconClock}
                    />
                    <div className="grid gap-5 md:grid-cols-2">
                        <SettingsField label={t('frontend.voice.wakeWord')}>
                            <SettingsInput
                                type="text"
                                value={voiceSettings.wakeWord}
                                onChange={event => {
                                    void updateVoiceSettings({ wakeWord: event.target.value });
                                }}
                                className=""
                                placeholder={t('frontend.placeholder.wakeWord')}
                            />
                        </SettingsField>
                        <SettingsField label={t('frontend.settings.voiceSilenceTimeout')}>
                            <SettingsInput
                                type="number"
                                min={500}
                                step={100}
                                value={voiceSettings.silenceTimeout}
                                onChange={event => {
                                    const nextValue = Number.parseInt(event.target.value, 10);
                                    void updateVoiceSettings({
                                        silenceTimeout: Number.isNaN(nextValue) ? 1500 : nextValue,
                                    });
                                }}
                                className=""
                            />
                        </SettingsField>
                    </div>
                </div>
            </SettingsPanel>
        </SettingsTabLayout>
    );
};

