/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Input } from '@renderer/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import {
    Clock,
    Globe,
    Settings,
    Shield,
    Volume2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { useVoice } from '@/features/voice/hooks/useVoice';
import { localeRegistry } from '@/i18n/locale-registry.service';
import type { GroupedModels } from '@/types';

import type { SettingsSharedProps } from '../types';

import {
    SettingsField,
    SettingsInputClassName,
    SettingsPanel,
    SettingsToggleRow,
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
        <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
            <SettingsPanel
                title={t('settings.generalTitle')}
                description={t('settings.generalDescription')}
                icon={Settings}
            >
                <div className="grid gap-5 md:grid-cols-2">
                    <SettingsField label={t('settings.language')}>
                        <Select
                            value={settings.general.language ?? 'en'}
                            onValueChange={value => {
                                void updateGeneral({ language: value });
                            }}
                        >
                            <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                                <div className="flex items-center gap-2">
                                    <Globe className="h-3.5 w-3.5 text-primary/50" />
                                    <SelectValue />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/30">
                                {languageOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsField>



                    <SettingsField label={t('general.contextMessageLimit')}>
                        <Input
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
                            className={SettingsInputClassName}
                        />
                    </SettingsField>

                    <SettingsField label={t('settings.agentSoftDeadline')}>
                        <Input
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
                            className={SettingsInputClassName}
                        />
                    </SettingsField>

                    <SettingsField label={t('settings.agentHardDeadline')}>
                        <Input
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
                            className={SettingsInputClassName}
                        />
                    </SettingsField>
                    <div className="md:col-span-2">
                        <SettingsToggleRow
                            title={t('settings.agentPathPolicyTitle')}
                            description={t('settings.agentPathPolicyDescription')}
                            control={(
                                <Switch
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
                            icon={Shield}
                        />
                    </div>

                    <SettingsField label={t('settings.agentAllowedCommands')}>
                        <Input
                            type="text"
                            value={(settings.general.agentAllowedCommands ?? []).join(', ')}
                            onChange={event => {
                                void updateGeneral({
                                    agentAllowedCommands: normalizeCsvValue(event.target.value),
                                });
                            }}
                            className={SettingsInputClassName}
                            placeholder={t('settings.agentAllowedCommandsPlaceholder')}
                        />
                    </SettingsField>

                    <SettingsField label={t('settings.agentDisallowedCommands')}>
                        <Input
                            type="text"
                            value={(settings.general.agentDisallowedCommands ?? []).join(', ')}
                            onChange={event => {
                                void updateGeneral({
                                    agentDisallowedCommands: normalizeCsvValue(event.target.value),
                                });
                            }}
                            className={SettingsInputClassName}
                            placeholder={t('settings.agentDisallowedCommandsPlaceholder')}
                        />
                    </SettingsField>
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('voice.interfaceTitle')}
                description={t('voice.interfaceSubtitle')}
                icon={Volume2}
            >
                <div className="space-y-4">
                    <SettingsToggleRow
                        title={t('settings.voiceInterfaceEnabled')}
                        description={t('settings.voiceInterfaceEnabledDescription')}
                        control={(
                            <Switch
                                checked={voiceSettings.enabled}
                                onCheckedChange={checked => {
                                    void updateVoiceSettings({ enabled: checked });
                                }}
                            />
                        )}
                        icon={Volume2}
                    />
                    <SettingsToggleRow
                        title={t('voice.continuousListening')}
                        description={t('settings.voiceContinuousListeningDescription')}
                        control={(
                            <Switch
                                checked={voiceSettings.continuousListening}
                                onCheckedChange={checked => {
                                    void updateVoiceSettings({ continuousListening: checked });
                                }}
                            />
                        )}
                        icon={Clock}
                    />
                    <div className="grid gap-5 md:grid-cols-2">
                        <SettingsField label={t('voice.wakeWord')}>
                            <Input
                                type="text"
                                value={voiceSettings.wakeWord}
                                onChange={event => {
                                    void updateVoiceSettings({ wakeWord: event.target.value });
                                }}
                                className={SettingsInputClassName}
                                placeholder={t('placeholder.wakeWord')}
                            />
                        </SettingsField>
                        <SettingsField label={t('settings.voiceSilenceTimeout')}>
                            <Input
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
                                className={SettingsInputClassName}
                            />
                        </SettingsField>
                    </div>
                </div>
            </SettingsPanel>
        </div>
    );
};
