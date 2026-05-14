/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * (at your option) any later version.
 */

import { IconPlayerPlay, IconRadio, IconVolume } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { AppSettings } from '@/types/settings';
import { appLogger } from '@/utils/renderer-logger';

import {
    SettingsField,
    SettingsPanel,
    SettingsSelectContent,
    SettingsSelectItem,
    SettingsSelectTrigger, 
    SettingsTabLayout,
} from './SettingsPrimitives';

interface SpeechTabProps {
    settings: AppSettings | null;
    updateSpeech: (patch: Partial<NonNullable<AppSettings['speech']>>) => void;
    t: (key: string) => string;
}

interface DeviceOption {
    value: string;
    label: string;
}

function useSpeechDevices(t: (key: string) => string) {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

    useEffect(() => {
        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices();
            if (v.length > 0) {
                setVoices(v);
            }
        };

        const loadDevices = async () => {
            try {
                await navigator.mediaDevices
                    .getUserMedia({ audio: true })
                    .catch((err: Error) =>
                        appLogger.warn('SpeechTab', 'Microphone permission denied:', err)
                    );
                const d = await navigator.mediaDevices.enumerateDevices();
                setDevices(d);
            } catch (err) {
                appLogger.error(
                    'SpeechTab',
                    'Error enumerating devices:',
                    err instanceof Error ? err : new Error(String(err))
                );
            }
        };

        void loadVoices();
        void loadDevices();

        if ('onvoiceschanged' in window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        navigator.mediaDevices.ondevicechange = loadDevices;

        return () => {
            navigator.mediaDevices.ondevicechange = null;
        };
    }, []);

    const inputDevices = useMemo<DeviceOption[]>(
        () =>
            devices
                .filter(d => d.kind === 'audioinput' && d.deviceId)
                .map(d => ({
                    value: d.deviceId,
                    label: d.label || `${t('frontend.speech.microphone')} ${d.deviceId.slice(0, 5)}`,
                })),
        [devices, t]
    );

    const outputDevices = useMemo<DeviceOption[]>(
        () =>
            devices
                .filter(d => d.kind === 'audiooutput' && d.deviceId)
                .map(d => ({
                    value: d.deviceId,
                    label: d.label || `${t('frontend.speech.speaker')} ${d.deviceId.slice(0, 5)}`,
                })),
        [devices, t]
    );

    return { voices, inputDevices, outputDevices };
}

interface VoiceSectionProps {
    settings: AppSettings | null;
    voices: SpeechSynthesisVoice[];
    updateSpeech: (patch: Partial<NonNullable<AppSettings['speech']>>) => void;
    t: (key: string) => string;
}

const VoiceSection: React.FC<VoiceSectionProps> = ({
    settings,
    voices,
    updateSpeech,
    t,
}) => (
    <div className="space-y-5 px-6 py-2">
        <SettingsField label={t('frontend.speech.voiceSelection')}>
            <Select
                value={settings?.speech?.voiceURI ?? ''}
                onValueChange={val => updateSpeech({ voiceURI: val })}
            >
                <SettingsSelectTrigger>
                    <SelectValue placeholder={t('frontend.speech.systemDefault')} />
                </SettingsSelectTrigger>
                <SettingsSelectContent>
                    <SettingsSelectItem value="system-default">
                        {t('frontend.speech.systemDefault')}
                    </SettingsSelectItem>
                    {voices.map(v => (
                        <SettingsSelectItem key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                        </SettingsSelectItem>
                    ))}
                </SettingsSelectContent>
            </Select>
        </SettingsField>

        <SettingsField label={t('frontend.speech.speed')}>
            <div className="flex items-center gap-4">
                <Slider
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={[settings?.speech?.rate ?? 1]}
                    onValueChange={([val]) => updateSpeech({ rate: val })}
                    className="flex-1"
                />
                <Badge variant="outline" className="h-6 shrink-0 border-primary/20 px-3 font-mono text-sm font-semibold text-primary tabular-nums">
                    {settings?.speech?.rate ?? 1}x
                </Badge>
            </div>
            <div className="mt-3 flex justify-between text-xs font-medium text-muted-foreground/50">
                <span>{t('frontend.speech.rateHalf')}</span>
                <span>{t('frontend.speech.rateNormal')}</span>
                <span>{t('frontend.speech.rateDouble')}</span>
            </div>
        </SettingsField>
    </div>
);

interface DeviceSectionProps {
    settings: AppSettings | null;
    inputDevices: DeviceOption[];
    outputDevices: DeviceOption[];
    updateSpeech: (patch: Partial<NonNullable<AppSettings['speech']>>) => void;
    t: (key: string) => string;
}

const DeviceSection: React.FC<DeviceSectionProps> = ({
    settings,
    inputDevices,
    outputDevices,
    updateSpeech,
    t,
}) => (
    <div className="space-y-5">
        <SettingsField label={t('frontend.speech.microphone')}>
            <Select
                value={settings?.speech?.audioInputDeviceId ?? 'default'}
                onValueChange={val => updateSpeech({ audioInputDeviceId: val })}
            >
                <SettingsSelectTrigger>
                    <SelectValue placeholder={t('frontend.speech.systemDefault')} />
                </SettingsSelectTrigger>
                <SettingsSelectContent>
                    <SettingsSelectItem value="default">
                        {t('frontend.speech.systemDefault')}
                    </SettingsSelectItem>
                    {inputDevices.map(opt => (
                        <SettingsSelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SettingsSelectItem>
                    ))}
                </SettingsSelectContent>
            </Select>
        </SettingsField>

        <SettingsField label={t('frontend.speech.speakerSelection')}>
            <Select
                value={settings?.speech?.audioOutputDeviceId ?? 'default'}
                onValueChange={val => updateSpeech({ audioOutputDeviceId: val })}
            >
                <SettingsSelectTrigger>
                    <SelectValue placeholder={t('frontend.speech.systemDefault')} />
                </SettingsSelectTrigger>
                <SettingsSelectContent>
                    <SettingsSelectItem value="default">
                        {t('frontend.speech.systemDefault')}
                    </SettingsSelectItem>
                    {outputDevices.map(opt => (
                        <SettingsSelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SettingsSelectItem>
                    ))}
                </SettingsSelectContent>
            </Select>
        </SettingsField>
    </div>
);

export const SpeechTab: React.FC<SpeechTabProps> = ({
    settings,
    updateSpeech,
    t,
}) => {
    const { voices, inputDevices, outputDevices } = useSpeechDevices(t);

    const handleTest = useCallback(() => {
        const utterance = new SpeechSynthesisUtterance(t('frontend.speech.previewText'));
        const voice = voices.find(v => v.voiceURI === settings?.speech?.voiceURI);
        if (voice) {
            utterance.voice = voice;
        }
        utterance.rate = settings?.speech?.rate ?? 1;
        window.speechSynthesis.speak(utterance);
    }, [t, voices, settings?.speech?.voiceURI, settings?.speech?.rate]);

    return (
        <SettingsTabLayout className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsPanel
                title={t('frontend.speech.synthesizerMatrix')}
                icon={IconRadio}
            >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <VoiceSection
                        settings={settings}
                        voices={voices}
                        updateSpeech={updateSpeech}
                        t={t}
                    />
                    <DeviceSection
                        settings={settings}
                        inputDevices={inputDevices}
                        outputDevices={outputDevices}
                        updateSpeech={updateSpeech}
                        t={t}
                    />
                </div>

                <div className="space-y-4 border-t border-border/10 px-6 py-2">
                    <div className="rounded-2xl border border-border/15 bg-muted/10 p-5">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 rounded-xl bg-primary/10 p-2 text-primary">
                                <IconVolume className="h-4 w-4" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground/70">
                                    {t('frontend.speech.auralPreview')}
                                </p>
                                <p className="text-sm leading-relaxed text-foreground/90">
                                    "{t('frontend.speech.previewText')}"
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={handleTest}
                        variant="outline"
                        className="h-11 rounded-2xl border-primary/20 bg-primary/5 px-5 font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                        <IconPlayerPlay className="mr-2 h-4 w-4" />
                        {t('frontend.speech.test')}
                    </Button>
                </div>
            </SettingsPanel>
        </SettingsTabLayout>
    );
};
