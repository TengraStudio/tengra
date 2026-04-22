/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Button } from '@renderer/components/ui/button';
import { ConfirmationModal } from '@renderer/components/ui/ConfirmationModal';
import { Input } from '@renderer/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Textarea } from '@renderer/components/ui/textarea';
import { useAppState } from '@renderer/hooks/useAppState';
import { cn } from '@renderer/lib/utils';
import { SERVICE_INTERVALS } from '@shared/constants';
import { AppSettings } from '@shared/types/settings';
import {
    Activity,
    Brain,
    FileCode,
    Gauge,
    Layers,
    RefreshCw,
    Settings2,
    ShieldAlert,
    Sliders,
    Thermometer,
    Timer,
    Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import type { ModelInfo } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

/* Batch-02: Extracted Long Classes */
const C_ADVANCEDTAB_1 = "p-6 rounded-card-lg bg-muted/10 border border-border/40 space-y-4 group/interval hover:bg-muted/20 transition-all duration-500 lg:p-8";
const C_ADVANCEDTAB_2 = "p-3 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/config:scale-110 transition-transform duration-500";
const C_ADVANCEDTAB_3 = "absolute -inset-0.5 bg-gradient-to-br from-primary/20 to-transparent rounded-card-lg blur opacity-0 group-hover/textarea:opacity-100 transition duration-1000";
const C_ADVANCEDTAB_4 = "relative w-full h-48 px-6 py-6 rounded-card-lg bg-muted/20 border-border/40 typo-body leading-relaxed font-medium focus-visible:ring-primary/20 transition-all shadow-inner";
const C_ADVANCEDTAB_5 = "p-3 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/orch:scale-110 transition-transform duration-500";
const C_ADVANCEDTAB_6 = "p-3.5 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/intervals:scale-110 transition-transform duration-500";
const C_ADVANCEDTAB_7 = "p-3.5 rounded-2xl bg-primary/10 text-primary shadow-2xl shadow-primary/10 group-hover:scale-110 transition-transform duration-700 ring-1 ring-primary/20";


const SECTION_CARD_BASE = 
    "bg-card rounded-3xl border border-border/40 p-8 space-y-10 shadow-sm transition-all duration-500 overflow-hidden relative";

const SECTION_CARD_HOVER = "hover:border-border/60 shadow-md";

interface BenchmarkResult {
    tokensPerSec: number;
    latency: number;
}

interface AdvancedTabProps {
    settings: AppSettings | null;
    installedModels: ModelInfo[];
    proxyModels?: ModelInfo[];
    setSettings: (s: AppSettings) => void;
    handleSave: (s?: AppSettings) => void;
    benchmarkResult: BenchmarkResult | null;
    isBenchmarking: boolean;
    handleRunBenchmark: (id: string) => void;
    t: (key: string) => string;
}

interface IntervalOption {
    value: number;
    labelKey: string;
    count: number;
}

const MODEL_UPDATE_OPTIONS: IntervalOption[] = [
    { value: 1800000, labelKey: 'common.minutes', count: 30 },
    { value: 3600000, labelKey: 'common.hour', count: 1 },
    { value: 7200000, labelKey: 'common.hours', count: 2 },
    { value: 14400000, labelKey: 'common.hours', count: 4 },
    { value: 86400000, labelKey: 'common.hours', count: 24 },
];

const TOKEN_REFRESH_OPTIONS: IntervalOption[] = [
    { value: 60000, labelKey: 'common.minute', count: 1 },
    { value: 300000, labelKey: 'common.minutes', count: 5 },
    { value: 600000, labelKey: 'common.minutes', count: 10 },
    { value: 900000, labelKey: 'common.minutes', count: 15 },
    { value: 1800000, labelKey: 'common.minutes', count: 30 },
];

const COPILOT_REFRESH_OPTIONS: IntervalOption[] = [
    { value: 300000, labelKey: 'common.minutes', count: 5 },
    { value: 600000, labelKey: 'common.minutes', count: 10 },
    { value: 900000, labelKey: 'common.minutes', count: 15 },
    { value: 1800000, labelKey: 'common.minutes', count: 30 },
    { value: 3600000, labelKey: 'common.hour', count: 1 },
];

interface IntervalSelectProps {
    icon: React.ReactNode;
    label: string;
    description: string;
    value: number;
    options: IntervalOption[];
    onChange: (value: number) => void;
    t: (key: string) => string;
}

const IntervalSelect: React.FC<IntervalSelectProps> = ({
    icon,
    label,
    description,
    value,
    options,
    onChange,
    t,
}) => (
    <div className={C_ADVANCEDTAB_1}>
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-background shadow-sm group-hover/interval:scale-110 transition-transform duration-500">
                {icon}
            </div>
            <div className="typo-body font-bold text-foreground">
                {label}
            </div>
        </div>
        <p className="typo-body font-bold text-muted-foreground/40 leading-relaxed">
            {description}
        </p>
        <Select value={value.toString()} onValueChange={(val: string) => onChange(parseInt(val))}>
            <SelectTrigger className="h-10 px-4 rounded-xl bg-background border-border/40 typo-body font-bold focus:ring-primary/20 transition-all">
                <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                {options.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()} className="typo-body font-bold">
                        {opt.count} {t(opt.labelKey)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
);

interface BenchmarkResultsProps {
    result: BenchmarkResult;
    t: (key: string) => string;
}

const BenchmarkResults: React.FC<BenchmarkResultsProps> = ({ result, t }) => (
    <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="p-8 rounded-card-lg bg-primary/5 border border-primary/10 flex flex-col items-center justify-center gap-2 group/stat">
            <Thermometer className="w-6 h-6 text-primary mb-2 group-hover/stat:scale-110 transition-transform duration-500" />
            <div className="text-3xl font-bold text-foreground leading-none">
                {result.tokensPerSec}
            </div>
            <div className="typo-body text-primary font-bold">
                {t('advanced.tokensPerSecShort')}
            </div>
        </div>
        <div className="p-8 rounded-card-lg bg-success/5 border border-success/10 flex flex-col items-center justify-center gap-2 group/stat">
            <Activity className="w-6 h-6 text-success mb-2 group-hover/stat:scale-110 transition-transform duration-500" />
            <div className="text-3xl font-bold text-foreground leading-none">
                {result.latency}ms
            </div>
            <div className="typo-body text-success font-bold">
                {t('advanced.latency')}
            </div>
        </div>
    </div>
);

// Model Configuration Section
interface ModelConfigSectionProps {
    currentModelId: string;
    modelOptions: Array<{ value: string; label: string }>;
    setSelectedConfigModel: (v: string) => void;
    modelSettings: Partial<NonNullable<AppSettings['modelSettings']>[string]>;
    modelPresets: Array<{ id: string; name: string; temperature: number; topP: number }>;
    updateModelSetting: (
        patch: Partial<NonNullable<AppSettings['modelSettings']>[string]>
    ) => void;
    t: (k: string) => string;
}

const PresetButton: React.FC<{
    preset: { id: string; name: string; temperature: number; topP: number };
    isSelected: boolean;
    onSelect: () => void;
}> = ({ preset, isSelected, onSelect }) => (
    <Button
        variant="ghost"
        onClick={onSelect}
        className={cn(
            'flex items-center justify-between p-5 h-auto rounded-3xl border transition-all duration-300 text-left justify-start group/preset',
            isSelected
                ? 'bg-primary/10 border-primary/30 text-primary shadow-lg shadow-primary/5'
                : 'bg-muted/5 border-border/10 text-muted-foreground/60 hover:bg-muted/10 hover:border-border/20 hover:text-foreground'
        )}
    >
        <div className="flex-1">
            <div className="typo-body font-bold mb-1">{preset.name}</div>
            <div className="typo-body font-bold opacity-40">
                T: {preset.temperature} <span className="mx-1">•</span> P: {preset.topP}
            </div>
        </div>
        {isSelected && <Zap className="w-3.5 h-3.5 animate-pulse shrink-0 ml-2" />}
    </Button>
);

const ModelConfigSection: React.FC<ModelConfigSectionProps> = ({
    currentModelId,
    modelOptions,
    setSelectedConfigModel,
    modelSettings,
    modelPresets,
    updateModelSetting,
    t,
}) => (
    <div className={cn(SECTION_CARD_BASE, SECTION_CARD_HOVER, "group/config")}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 relative z-10">
            <div className="flex items-center gap-4">
                <div className={C_ADVANCEDTAB_2}>
                    <Brain className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-foreground">
                        {t('advancedTab.modelConfiguration')}
                    </h3>
                    <p className="typo-body text-muted-foreground mt-1 font-bold opacity-40">
                        Neural Parameter tuning
                    </p>
                </div>
            </div>
            <Select value={currentModelId} onValueChange={(val: string) => setSelectedConfigModel(val)}>
                <SelectTrigger className="h-10 px-4 w-56 rounded-xl bg-muted/20 border-border/40 typo-body font-bold focus:ring-primary/20">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl max-h-300">
                    {modelOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="typo-body font-bold">
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <FileCode className="w-4 h-4 text-primary" />
                    <span className="typo-body font-bold text-foreground">
                        System Logic Template
                    </span>
                </div>
                <div className="relative group/textarea">
                    <div className={C_ADVANCEDTAB_3} />
                    <Textarea
                        value={modelSettings.systemPrompt ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            updateModelSetting({ systemPrompt: e.target.value })
                        }
                        placeholder={t('advancedTab.systemPromptPlaceholder')}
                        className={C_ADVANCEDTAB_4}
                    />
                </div>
            </div>
            <div className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                            <Sliders className="w-4 h-4 text-success" />
                            <span className="typo-body font-bold text-foreground">
                                {t('advanced.inferenceStrategy')}
                            </span>
                        </div>
                <div className="grid grid-cols-1 gap-3">
                    {modelPresets.map(p => (
                        <PresetButton
                            key={p.id}
                            preset={p}
                            isSelected={modelSettings.presetId === p.id}
                            onSelect={() => updateModelSetting({ presetId: p.id })}
                        />
                    ))}
                </div>

                {currentModelId.includes('ollama') && (
                    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center gap-3 px-1">
                            <Activity className="w-4 h-4 text-primary" />
                            <span className="typo-body font-bold text-foreground">
                                {t('advanced.contextWindowOverride')}
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Input
                                type="number"
                                value={modelSettings.numCtx ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateModelSetting({ numCtx: e.target.value ? parseInt(e.target.value) : undefined })
                                }
                                placeholder={t('common.auto')}
                                className="h-10 rounded-xl bg-muted/20 border-border/40 typo-body font-medium focus-visible:ring-primary/20"
                            />
                            <div className="typo-body font-bold text-muted-foreground/40 leading-tight">
                                {t('advanced.contextWindowOverrideDescription')}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl opacity-30 pointer-events-none" />
    </div>
);

// Orchestration Section
interface OrchestrationSectionProps {
    orchestrationPolicy: string;
    updateOrchestrationPolicy: (val: string) => void;
    t: (k: string) => string;
}

const OrchestrationSection: React.FC<OrchestrationSectionProps> = ({
    orchestrationPolicy,
    updateOrchestrationPolicy,
    t,
}) => (
    <div className={cn(SECTION_CARD_BASE, SECTION_CARD_HOVER, "space-y-8 group/orch")}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 relative z-10">
            <div className="flex items-center gap-4">
                <div className={C_ADVANCEDTAB_5}>
                    <Layers className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-foreground">{t('advanced.orchestration')}</h3>
                    <p className="typo-body text-muted-foreground mt-1 font-bold opacity-40">{t('advanced.orchestrationDesc')}</p>
                </div>
            </div>
            <Select value={orchestrationPolicy} onValueChange={(val: string) => updateOrchestrationPolicy(val)}>
                <SelectTrigger className="h-10 px-4 w-48 rounded-xl bg-muted/20 border-border/40 typo-body font-bold focus:ring-primary/20">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                    <SelectItem value="auto" className="typo-body font-bold">{t('advanced.orchestrationAuto')}</SelectItem>
                    <SelectItem value="fifo" className="typo-body font-bold">{t('advanced.orchestrationFIFO')}</SelectItem>
                    <SelectItem value="parallel" className="typo-body font-bold">{t('advanced.orchestrationParallel')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl opacity-30 pointer-events-none" />
    </div>
);

// Service Intervals Section
interface ServiceIntervalsSectionProps {
    settings: AppSettings | null;
    updateAiSetting: (
        key: 'modelUpdateInterval' | 'tokenRefreshInterval' | 'copilotRefreshInterval',
        value: number
    ) => void;
    t: (k: string) => string;
}

const ServiceIntervalsSection: React.FC<ServiceIntervalsSectionProps> = ({
    settings,
    updateAiSetting,
    t,
}) => (
    <div className={cn(SECTION_CARD_BASE, SECTION_CARD_HOVER, "group/intervals")}>
        <div className="flex items-center gap-4 relative z-10 px-1">
            <div className={C_ADVANCEDTAB_6}>
                <Timer className="w-6 h-6" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-foreground">
                    {t('advanced.serviceIntervals')}
                </h3>
                <p className="typo-body text-muted-foreground mt-1 font-bold opacity-40">
                    Cycle Synchronization frequency
                </p>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            <IntervalSelect
                icon={<RefreshCw className="w-4 h-4 text-emerald-500" />}
                label={t('advanced.modelUpdateInterval')}
                description={t('advanced.modelUpdateIntervalDesc')}
                value={settings?.ai?.modelUpdateInterval ?? SERVICE_INTERVALS.MODEL_UPDATE}
                options={MODEL_UPDATE_OPTIONS}
                onChange={v => updateAiSetting('modelUpdateInterval', v)}
                t={t}
            />
            <IntervalSelect
                icon={<Gauge className="w-4 h-4 text-amber-500" />}
                label={t('advanced.tokenRefreshInterval')}
                description={t('advanced.tokenRefreshIntervalDesc')}
                value={settings?.ai?.tokenRefreshInterval ?? SERVICE_INTERVALS.TOKEN_REFRESH}
                options={TOKEN_REFRESH_OPTIONS}
                onChange={v => updateAiSetting('tokenRefreshInterval', v)}
                t={t}
            />
            <IntervalSelect
                icon={<Timer className="w-4 h-4 text-blue-500" />}
                label={t('advanced.copilotRefreshInterval')}
                description={t('advanced.copilotRefreshIntervalDesc')}
                value={settings?.ai?.copilotRefreshInterval ?? SERVICE_INTERVALS.COPILOT_REFRESH}
                options={COPILOT_REFRESH_OPTIONS}
                onChange={v => updateAiSetting('copilotRefreshInterval', v)}
                t={t}
            />
        </div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl opacity-30 pointer-events-none" />
    </div>
);

const SecuritySection: React.FC<{ t: (k: string) => string }> = ({ t }) => {
    const [isResetting, setIsResetting] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const { addToast } = useAppState();

    const handleReset = () => {
        setIsConfirmOpen(true);
    };

    const handleConfirmReset = async () => {
        setIsConfirmOpen(false);
        setIsResetting(true);
        try {
            const result = await window.electron.invoke<{ success: boolean; error?: string }>('security:reset-master-key');
            if (result.success) {
                addToast({ type: 'success', message: t('advanced.resetMasterKeySuccess') });
            } else {
                addToast({ type: 'error', message: t('advanced.resetMasterKeyError') + ': ' + result.error });
            }
        } catch (error) {
            appLogger.error('AdvancedTab', 'Failed to reset master key', error as Error);
            addToast({ type: 'error', message: 'Failed to reset master key' });
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className={cn(SECTION_CARD_BASE, SECTION_CARD_HOVER, "border-destructive/40 bg-destructive/5")}>
            <div className="flex items-center gap-4 relative z-10 px-1">
                <div className="p-3.5 rounded-2xl bg-destructive/10 text-destructive shadow-2xl shadow-destructive/10 group-hover:scale-110 transition-transform duration-700 ring-1 ring-destructive/20">
                    <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-foreground">
                        {t('advanced.securityTitle')}
                    </h3>
                    <p className="typo-body text-muted-foreground mt-1 font-bold opacity-40">
                        {t('advanced.dangerZone')}
                    </p>
                </div>
            </div>
            <div className="space-y-4 relative z-10 mt-6 px-1">
                <p className="typo-body text-muted-foreground leading-relaxed font-bold">
                    {t('advanced.resetMasterKeyWarning')}
                </p>
                <div className="flex items-center gap-4">
                    <Button 
                        variant="destructive" 
                        onClick={handleReset} 
                        disabled={isResetting}
                        className="rounded-xl font-bold h-11 px-6 shadow-lg shadow-destructive/10"
                    >
                        {isResetting ? t('common.resetting') : t('advanced.resetMasterKeyButton')}
                    </Button>
                    <p className="typo-caption text-muted-foreground/40 font-bold max-w-sm">
                        {t('advanced.resetMasterKeyHelp')}
                    </p>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmReset}
                title={t('advanced.securityTitle')}
                message={t('advanced.resetMasterKeyConfirm')}
                variant="danger"
            />
        </div>
    );
};

// Default presets factory
const getDefaultPresets = (t: (k: string) => string) => [
    {
        id: 'creative',
        name: t('ssh.presets.creative'),
        temperature: 0.9,
        topP: 0.95,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1,
    },
    {
        id: 'precise',
        name: t('ssh.presets.precise'),
        temperature: 0.2,
        topP: 0.1,
        frequencyPenalty: 0,
        presencePenalty: 0,
    },
    {
        id: 'balanced',
        name: t('ssh.presets.balanced'),
        temperature: 0.7,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
    },
];

// Helper to create model settings update
function createModelSettingsUpdate(
    settings: AppSettings,
    currentModelId: string,
    patch: Partial<NonNullable<AppSettings['modelSettings']>[string]>
): AppSettings {
    const currentSettings = settings.modelSettings?.[currentModelId] ?? {};
    return {
        ...settings,
        modelSettings: {
            ...settings.modelSettings,
            [currentModelId]: { ...currentSettings, ...patch },
        },
    };
}

interface UseAdvancedTabOptions {
    settings: AppSettings | null;
    installedModels: ModelInfo[];
    proxyModels: ModelInfo[] | undefined;
    setSettings: (s: AppSettings) => void;
    handleSave: (s?: AppSettings) => void;
    t: (key: string) => string;
}

const useAdvancedTabHandlers = (
    settings: AppSettings | null,
    currentModelId: string,
    setSettings: (s: AppSettings) => void,
    handleSave: (s?: AppSettings) => void
) => {
    const updateModelSetting = useCallback(
        (patch: Partial<NonNullable<AppSettings['modelSettings']>[string]>) => {
            if (!settings || !currentModelId) {
                return;
            }
            const updated = createModelSettingsUpdate(settings, currentModelId, patch);
            setSettings(updated);
            handleSave(updated);
        },
        [settings, currentModelId, setSettings, handleSave]
    );

    const updateAiSetting = useCallback(
        (
            key: 'modelUpdateInterval' | 'tokenRefreshInterval' | 'copilotRefreshInterval',
            value: number
        ) => {
            if (!settings) {
                return;
            }
            const updated = { ...settings, ai: { ...settings.ai, [key]: value } };
            setSettings(updated);
            handleSave(updated);
        },
        [settings, setSettings, handleSave]
    );

    const updateOrchestrationPolicy = useCallback(
        (val: string) => {
            if (!settings) {
                return;
            }
            const updated = {
                ...settings,
                ollama: {
                    ...settings.ollama,
                    orchestrationPolicy: val as 'auto' | 'fifo' | 'parallel',
                },
            };
            setSettings(updated);
            handleSave(updated);
        },
        [settings, setSettings, handleSave]
    );

    return { updateModelSetting, updateAiSetting, updateOrchestrationPolicy };
};

const useAdvancedTabLogic = ({
    settings,
    installedModels,
    proxyModels,
    setSettings,
    handleSave,
    t,
}: UseAdvancedTabOptions) => {
    const [selectedConfigModel, setSelectedConfigModel] = useState<string | null>(null);
    const availableModels = useMemo(
        () => [...installedModels, ...(proxyModels ?? [])],
        [installedModels, proxyModels]
    );
    const currentModelId = useMemo(
        () => selectedConfigModel ?? (availableModels[0]?.id ?? ''),
        [selectedConfigModel, availableModels]
    );
    const modelSettings = useMemo(() => settings?.modelSettings?.[currentModelId] ?? {}, [
        settings,
        currentModelId,
    ]);
    const modelPresets = useMemo(() => settings?.presets ?? getDefaultPresets(t), [settings, t]);
    const modelOptions = useMemo(
        () => availableModels.map(m => ({ value: m.id ?? '', label: m.id ?? '' })),
        [availableModels]
    );

    const handlers = useAdvancedTabHandlers(settings, currentModelId, setSettings, handleSave);
    const orchestrationPolicy = settings?.ollama.orchestrationPolicy ?? 'auto';

    return {
        currentModelId,
        modelSettings,
        modelPresets,
        modelOptions,
        orchestrationPolicy,
        setSelectedConfigModel,
        ...handlers,
    };
};

export const AdvancedTab: React.FC<AdvancedTabProps> = ({
    settings,
    installedModels,
    proxyModels,
    setSettings,
    handleSave,
    benchmarkResult,
    isBenchmarking: _isBenchmarking,
    handleRunBenchmark: _handleRunBenchmark,
    t,
}) => {
    const {
        currentModelId,
        modelSettings,
        modelPresets,
        modelOptions,
        orchestrationPolicy,
        setSelectedConfigModel,
        updateModelSetting,
        updateAiSetting,
        updateOrchestrationPolicy,
    } = useAdvancedTabLogic({ settings, installedModels, proxyModels, setSettings, handleSave, t });

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out pb-20">
            {/* Page Header */}
            <div className="relative group px-1">
                <div className="flex items-center gap-4 mb-3">
                    <div className={C_ADVANCEDTAB_7}>
                        <Settings2 className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-foreground leading-none">
                            {t('advanced.title')}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="h-1 w-8 bg-primary rounded-full group-hover:w-12 transition-all duration-700" />
                            <p className="typo-body font-bold text-muted-foreground opacity-50">
                                {t('advanced.subtitle')}
                            </p>
                        </div>
                    </div>
                </div>
                <p className="typo-caption text-muted-foreground/60 leading-relaxed max-w-2xl font-medium px-1">
                    {t('advanced.description')}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <ModelConfigSection
                    currentModelId={currentModelId}
                    modelOptions={modelOptions}
                    setSelectedConfigModel={setSelectedConfigModel}
                    modelSettings={modelSettings}
                    modelPresets={modelPresets}
                    updateModelSetting={updateModelSetting}
                    t={t}
                />

                <OrchestrationSection
                    orchestrationPolicy={orchestrationPolicy}
                    updateOrchestrationPolicy={updateOrchestrationPolicy}
                    t={t}
                />

                {benchmarkResult && (
                    <div className={cn(SECTION_CARD_BASE, SECTION_CARD_HOVER, "p-10 space-y-8 group/benchmark")}>
                        <div className="flex items-center gap-3 px-1 relative z-10">
                            <Gauge className="w-4 h-4 text-primary" />
                            <h4 className="typo-body font-bold text-muted-foreground/40">{t('advanced.throughputSnapshot')}</h4>
                        </div>
                        <div className="relative z-10">
                            <BenchmarkResults result={benchmarkResult} t={t} />
                        </div>
                        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl opacity-30 pointer-events-none" />
                    </div>
                )}

                <ServiceIntervalsSection settings={settings} updateAiSetting={updateAiSetting} t={t} />

                <SecuritySection t={t} />
            </div>
        </div>
    );
};
