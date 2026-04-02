import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { 
    Headphones,
    Mic, 
    Music,
    Play, 
    Radio, 
    Volume2, 
    Waves, 
    Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { AppSettings } from '@/types/settings';
import { appLogger } from '@/utils/renderer-logger';

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
                        appLogger.warn('SpeechTab', 'Mic permission denied:', err)
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
                .filter(d => d.kind === 'audioinput')
                .map(d => ({
                    value: d.deviceId,
                    label: d.label || `${t('speech.microphone')} ${d.deviceId.slice(0, 5)}`,
                })),
        [devices, t]
    );

    const outputDevices = useMemo<DeviceOption[]>(
        () =>
            devices
                .filter(d => d.kind === 'audiooutput')
                .map(d => ({
                    value: d.deviceId,
                    label: d.label || `${t('speech.speaker')} ${d.deviceId.slice(0, 5)}`,
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
    <div className="space-y-10">
        <div className="px-1">
            <label className="text-[10px] font-bold text-foreground flex items-center gap-2 mb-3">
                <Music className="w-3 h-3 text-primary/60" />
                {t('speech.voiceSelection')}
            </label>
            <Select
                value={settings?.speech?.voiceURI ?? ''}
                onValueChange={val => updateSpeech({ voiceURI: val })}
            >
                <SelectTrigger className="h-12 px-6 rounded-2xl bg-muted/5 border-border/40 text-[10px] font-bold focus:ring-primary/20 transition-all">
                    <SelectValue placeholder={t('speech.systemDefault')} />
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl max-h-[300px]">
                    <SelectItem value="system-default" className="text-[10px] font-bold">{t('speech.systemDefault')}</SelectItem>
                    {voices.map(v => (
                        <SelectItem key={v.voiceURI} value={v.voiceURI} className="text-[10px] font-bold">
                            {v.name} ({v.lang})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="px-1">
            <div className="flex justify-between items-center mb-4">
                <label className="text-[10px] font-bold text-foreground flex items-center gap-2">
                    <Zap className="w-3 h-3 text-primary/60" />
                    {t('speech.speed')}
                </label>
                <Badge variant="outline" className="h-5 text-[8px] px-2 font-bold border-primary/20 text-primary tabular-nums">
                    {settings?.speech?.rate ?? 1}x
                </Badge>
            </div>
            <div className="pt-2 px-1">
                <Slider
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={[settings?.speech?.rate ?? 1]}
                    onValueChange={([val]) => updateSpeech({ rate: val })}
                    className="w-full"
                />
                <div className="flex justify-between mt-3 text-[7px] font-bold text-muted-foreground/30">
                    <span>{t('speech.rateHalf')}</span>
                    <span>{t('speech.rateNormal')}</span>
                    <span>{t('speech.rateDouble')}</span>
                </div>
            </div>
        </div>
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
    <div className="space-y-8">
        <div className="px-1">
            <label className="text-[10px] font-bold text-foreground flex items-center gap-2 mb-3">
                <Mic className="w-3 h-3 text-primary/60" />
                {t('speech.microphone')}
            </label>
            <Select
                value={settings?.speech?.audioInputDeviceId ?? 'default'}
                onValueChange={val => updateSpeech({ audioInputDeviceId: val })}
            >
                <SelectTrigger className="h-12 px-6 rounded-2xl bg-muted/5 border-border/40 text-[10px] font-bold focus:ring-primary/20 transition-all">
                    <SelectValue placeholder={t('speech.systemDefault')} />
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                    <SelectItem value="default" className="text-[10px] font-bold">{t('speech.systemDefault')}</SelectItem>
                    {inputDevices.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-[10px] font-bold">
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="px-1">
            <label className="text-[10px] font-bold text-foreground flex items-center gap-2 mb-3">
                <Headphones className="w-3 h-3 text-primary/60" />
                {t('speech.speakerSelection')}
            </label>
            <Select
                value={settings?.speech?.audioOutputDeviceId ?? 'default'}
                onValueChange={val => updateSpeech({ audioOutputDeviceId: val })}
            >
                <SelectTrigger className="h-12 px-6 rounded-2xl bg-muted/5 border-border/40 text-[10px] font-bold focus:ring-primary/20 transition-all">
                    <SelectValue placeholder={t('speech.systemDefault')} />
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                    <SelectItem value="default" className="text-[10px] font-bold">{t('speech.systemDefault')}</SelectItem>
                    {outputDevices.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-[10px] font-bold">
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    </div>
);

export const SpeechTab: React.FC<SpeechTabProps> = ({
    settings,
    updateSpeech,
    t,
}) => {
    const { voices, inputDevices, outputDevices } = useSpeechDevices(t);

    const handleTest = useCallback(() => {
        const utterance = new SpeechSynthesisUtterance(t('speech.previewText'));
        const voice = voices.find(v => v.voiceURI === settings?.speech?.voiceURI);
        if (voice) {
            utterance.voice = voice;
        }
        utterance.rate = settings?.speech?.rate ?? 1;
        window.speechSynthesis.speak(utterance);
    }, [t, voices, settings?.speech?.voiceURI, settings?.speech?.rate]);

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out pb-20">
            {/* Page Header */}
            <div className="relative group px-1">
                <div className="flex items-center gap-4 mb-3">
                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shadow-2xl shadow-primary/10 group-hover:scale-110 transition-transform duration-700 ring-1 ring-primary/20">
                        <Waves className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-foreground leading-none">
                            {t('speech.title')}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                             <div className="h-1 w-8 bg-primary rounded-full group-hover:w-12 transition-all duration-700" />
                            <p className="text-[10px] font-bold text-muted-foreground opacity-50">
                                {t('speech.sonicInterface')}
                            </p>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-2xl font-medium px-1">
                    {t('speech.subtitle')}
                </p>
            </div>

            {/* Voice & Config Section */}
            <div className="bg-card rounded-[2.5rem] border border-border/40 p-8 pt-10 space-y-10 shadow-sm relative overflow-hidden group/voice hover:border-border/60 transition-all duration-500">
                    <div className="flex items-center gap-3 px-1 relative z-10">
                        <Radio className="w-4 h-4 text-primary" />
                        <h4 className="text-[10px] font-bold text-muted-foreground/40">{t('speech.synthesizerMatrix')}</h4>
                    </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
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

                <div className="pt-10 border-t border-border/10 relative z-10">
                    <div className="flex flex-col gap-6">
                        <div className="group/preview relative">
                            <div className="absolute -inset-2 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 rounded-2xl blur-xl opacity-0 group-hover/preview:opacity-100 transition duration-1000" />
                            <div className="relative p-6 rounded-2xl bg-muted/10 border border-border/20 backdrop-blur-sm shadow-inner group-hover/preview:border-primary/20 transition-all">
                                <div className="flex items-start gap-4">
                                    <div className="p-2 rounded-lg bg-primary/20 text-primary mt-1">
                                        <Volume2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground/40 mb-2">{t('speech.auralPreview')}</p>
                                        <p className="text-xs leading-relaxed text-foreground font-medium opacity-80">
                                            "{t('speech.previewText')}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleTest}
                            variant="outline"
                            className="h-14 rounded-2xl bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:border-primary/30 transition-all duration-500 font-bold text-[10px] shadow-lg shadow-primary/5 group/btn"
                        >
                            <Play className="w-3.5 h-3.5 mr-3 group-hover:scale-125 transition-transform" />
                            {t('speech.test')}
                        </Button>
                    </div>
                </div>
                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] opacity-30 pointer-events-none" />
            </div>
        </div>
    );
};
