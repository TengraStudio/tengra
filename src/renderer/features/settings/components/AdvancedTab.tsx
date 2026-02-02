import { SERVICE_INTERVALS } from '@shared/constants';
import { AppSettings } from '@shared/types/settings';
import { Activity, Clock, MessageSquare, RefreshCw, Sliders, Thermometer, Zap } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { SelectDropdown } from '@/components/ui/SelectDropdown';
import type { ModelInfo } from '@/features/models/utils/model-fetcher';
import { cn } from '@/lib/utils';

interface BenchmarkResult {
    tokensPerSec: number
    latency: number
}

interface AdvancedTabProps {
    settings: AppSettings | null
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    setSettings: (s: AppSettings) => void
    handleSave: (s?: AppSettings) => void
    benchmarkResult: BenchmarkResult | null
    isBenchmarking: boolean
    handleRunBenchmark: (id: string) => void
    t: (key: string) => string
}

interface IntervalOption { value: number; labelKey: string; count: number }

const MODEL_UPDATE_OPTIONS: IntervalOption[] = [
    { value: 1800000, labelKey: 'common.minutes', count: 30 },
    { value: 3600000, labelKey: 'common.hour', count: 1 },
    { value: 7200000, labelKey: 'common.hours', count: 2 },
    { value: 14400000, labelKey: 'common.hours', count: 4 },
    { value: 86400000, labelKey: 'common.hours', count: 24 }
];

const TOKEN_REFRESH_OPTIONS: IntervalOption[] = [
    { value: 60000, labelKey: 'common.minute', count: 1 },
    { value: 300000, labelKey: 'common.minutes', count: 5 },
    { value: 600000, labelKey: 'common.minutes', count: 10 },
    { value: 900000, labelKey: 'common.minutes', count: 15 },
    { value: 1800000, labelKey: 'common.minutes', count: 30 }
];

const COPILOT_REFRESH_OPTIONS: IntervalOption[] = [
    { value: 300000, labelKey: 'common.minutes', count: 5 },
    { value: 600000, labelKey: 'common.minutes', count: 10 },
    { value: 900000, labelKey: 'common.minutes', count: 15 },
    { value: 1800000, labelKey: 'common.minutes', count: 30 },
    { value: 3600000, labelKey: 'common.hour', count: 1 }
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

const IntervalSelect: React.FC<IntervalSelectProps> = ({ icon, label, description, value, options, onChange, t }) => (
    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
        <label className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
            {icon}
            {label}
        </label>
        <p className="text-[10px] text-muted-foreground">{description}</p>
        <select
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label={label}
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.count} {t(opt.labelKey)}</option>
            ))}
        </select>
    </div>
);

interface BenchmarkResultsProps {
    result: BenchmarkResult;
    t: (key: string) => string;
}

const BenchmarkResults: React.FC<BenchmarkResultsProps> = ({ result, t }) => (
    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4">
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center gap-1">
            <Thermometer className="w-5 h-5 text-primary" />
            <div className="text-xl font-black text-foreground">{result.tokensPerSec} t/s</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{t('advanced.tokensPerSec')}</div>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center gap-1">
            <Activity className="w-5 h-5 text-success" />
            <div className="text-xl font-black text-foreground">{result.latency}ms</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{t('advanced.latency')}</div>
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
    updateModelSetting: (patch: Partial<NonNullable<AppSettings['modelSettings']>[string]>) => void;
    t: (k: string) => string;
}

const PresetButton: React.FC<{
    preset: { id: string; name: string; temperature: number; topP: number };
    isSelected: boolean;
    onSelect: () => void;
}> = ({ preset, isSelected, onSelect }) => (
    <button
        onClick={onSelect}
        className={cn(
            "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
            isSelected ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50"
        )}
    >
        <div>
            <div className="text-xs font-bold">{preset.name}</div>
            <div className="text-[10px] opacity-60">Temp: {preset.temperature} • TopP: {preset.topP}</div>
        </div>
        {isSelected && <Zap className="w-4 h-4 animate-pulse" />}
    </button>
);

const ModelConfigSection: React.FC<ModelConfigSectionProps> = ({
    currentModelId, modelOptions, setSelectedConfigModel, modelSettings, modelPresets, updateModelSetting, t
}) => (
    <div className="bg-card p-6 rounded-xl border border-border space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('advancedTab.modelConfiguration')}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t('advancedTab.modelConfigurationDesc')}</p>
            </div>
            <SelectDropdown value={currentModelId} options={modelOptions} onChange={setSelectedConfigModel} className="w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t('advancedTab.customSystemMessage')}</span>
                </div>
                <textarea
                    value={modelSettings.systemPrompt ?? ''}
                    onChange={e => updateModelSetting({ systemPrompt: e.target.value })}
                    placeholder={t('advancedTab.systemPromptPlaceholder')}
                    className="w-full h-32 bg-muted/10 border border-border/50 rounded-xl p-3 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none resize-none font-medium leading-relaxed"
                />
            </div>
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-success" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t('advancedTab.parameterPreset')}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {modelPresets.map(p => (
                        <PresetButton
                            key={p.id}
                            preset={p}
                            isSelected={modelSettings.presetId === p.id}
                            onSelect={() => updateModelSetting({ presetId: p.id })}
                        />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

// Orchestration Section
interface OrchestrationSectionProps {
    orchestrationPolicy: string;
    updateOrchestrationPolicy: (val: string) => void;
    t: (k: string) => string;
}

const OrchestrationSection: React.FC<OrchestrationSectionProps> = ({ orchestrationPolicy, updateOrchestrationPolicy, t }) => (
    <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple" />
                <div>
                    <h3 className="text-sm font-bold text-foreground">{t('advanced.orchestration')}</h3>
                    <p className="text-xs text-muted-foreground">{t('advanced.orchestrationDesc')}</p>
                </div>
            </div>
            <SelectDropdown
                value={orchestrationPolicy}
                options={[
                    { value: 'auto', label: t('advanced.orchestrationAuto') },
                    { value: 'fifo', label: t('advanced.orchestrationFIFO') },
                    { value: 'parallel', label: t('advanced.orchestrationParallel') }
                ]}
                onChange={updateOrchestrationPolicy}
                className="w-48"
            />
        </div>
    </div>
);

// Service Intervals Section
interface ServiceIntervalsSectionProps {
    settings: AppSettings | null;
    updateAiSetting: (key: 'modelUpdateInterval' | 'tokenRefreshInterval' | 'copilotRefreshInterval', value: number) => void;
    t: (k: string) => string;
}

const ServiceIntervalsSection: React.FC<ServiceIntervalsSectionProps> = ({ settings, updateAiSetting, t }) => (
    <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('advanced.serviceIntervals')}</h3>
                <p className="text-xs text-muted-foreground">{t('advanced.serviceIntervalsDesc')}</p>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IntervalSelect
                icon={<RefreshCw className="w-3.5 h-3.5 text-success" />}
                label={t('advanced.modelUpdateInterval')}
                description={t('advanced.modelUpdateIntervalDesc')}
                value={settings?.ai?.modelUpdateInterval ?? SERVICE_INTERVALS.MODEL_UPDATE}
                options={MODEL_UPDATE_OPTIONS}
                onChange={v => updateAiSetting('modelUpdateInterval', v)}
                t={t}
            />
            <IntervalSelect
                icon={<RefreshCw className="w-3.5 h-3.5 text-warning" />}
                label={t('advanced.tokenRefreshInterval')}
                description={t('advanced.tokenRefreshIntervalDesc')}
                value={settings?.ai?.tokenRefreshInterval ?? SERVICE_INTERVALS.TOKEN_REFRESH}
                options={TOKEN_REFRESH_OPTIONS}
                onChange={v => updateAiSetting('tokenRefreshInterval', v)}
                t={t}
            />
            <IntervalSelect
                icon={<RefreshCw className="w-3.5 h-3.5 text-purple" />}
                label={t('advanced.copilotRefreshInterval')}
                description={t('advanced.copilotRefreshIntervalDesc')}
                value={settings?.ai?.copilotRefreshInterval ?? SERVICE_INTERVALS.COPILOT_REFRESH}
                options={COPILOT_REFRESH_OPTIONS}
                onChange={v => updateAiSetting('copilotRefreshInterval', v)}
                t={t}
            />
        </div>
    </div>
);

// Default presets factory
const getDefaultPresets = (t: (k: string) => string) => [
    { id: 'creative', name: t('ssh.presets.creative'), temperature: 0.9, topP: 0.95, frequencyPenalty: 0.1, presencePenalty: 0.1 },
    { id: 'precise', name: t('ssh.presets.precise'), temperature: 0.2, topP: 0.1, frequencyPenalty: 0, presencePenalty: 0 },
    { id: 'balanced', name: t('ssh.presets.balanced'), temperature: 0.7, topP: 0.9, frequencyPenalty: 0, presencePenalty: 0 }
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
        modelSettings: { ...settings.modelSettings, [currentModelId]: { ...currentSettings, ...patch } }
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
    const updateModelSetting = useCallback((patch: Partial<NonNullable<AppSettings['modelSettings']>[string]>) => {
        if (!settings || !currentModelId) { return; }
        const updated = createModelSettingsUpdate(settings, currentModelId, patch);
        setSettings(updated);
        handleSave(updated);
    }, [settings, currentModelId, setSettings, handleSave]);

    const updateAiSetting = useCallback((key: 'modelUpdateInterval' | 'tokenRefreshInterval' | 'copilotRefreshInterval', value: number) => {
        if (!settings) { return; }
        const updated = { ...settings, ai: { ...settings.ai, [key]: value } };
        setSettings(updated);
        handleSave(updated);
    }, [settings, setSettings, handleSave]);

    const updateOrchestrationPolicy = useCallback((val: string) => {
        if (!settings) { return; }
        const updated = { ...settings, ollama: { ...settings.ollama, orchestrationPolicy: val as 'auto' | 'fifo' | 'parallel' } };
        setSettings(updated);
        handleSave(updated);
    }, [settings, setSettings, handleSave]);

    return { updateModelSetting, updateAiSetting, updateOrchestrationPolicy };
};

const useAdvancedTabLogic = ({
    settings,
    installedModels,
    proxyModels,
    setSettings,
    handleSave,
    t
}: UseAdvancedTabOptions) => {
    const [selectedConfigModel, setSelectedConfigModel] = useState<string | null>(null);
    const availableModels = useMemo(() => [...installedModels, ...(proxyModels ?? [])], [installedModels, proxyModels]);
    const currentModelId = useMemo(() => selectedConfigModel ?? (availableModels[0]?.id ?? ''), [selectedConfigModel, availableModels]);
    const modelSettings = useMemo(() => settings?.modelSettings?.[currentModelId] ?? {}, [settings, currentModelId]);
    const modelPresets = useMemo(() => settings?.presets ?? getDefaultPresets(t), [settings, t]);
    const modelOptions = useMemo(() => availableModels.map(m => ({ value: m.id ?? '', label: m.id ?? '' })), [availableModels]);

    const handlers = useAdvancedTabHandlers(settings, currentModelId, setSettings, handleSave);
    const orchestrationPolicy = settings?.ollama.orchestrationPolicy ?? 'auto';

    return {
        currentModelId,
        modelSettings,
        modelPresets,
        modelOptions,
        orchestrationPolicy,
        setSelectedConfigModel,
        ...handlers
    };
};

export const AdvancedTab: React.FC<AdvancedTabProps> = ({
    settings, installedModels, proxyModels, setSettings, handleSave, benchmarkResult, isBenchmarking: _isBenchmarking, handleRunBenchmark: _handleRunBenchmark, t
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
        updateOrchestrationPolicy
    } = useAdvancedTabLogic({ settings, installedModels, proxyModels, setSettings, handleSave, t });

    return (
        <div className="space-y-6">
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
                <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                    <BenchmarkResults result={benchmarkResult} t={t} />
                </div>
            )}
            <ServiceIntervalsSection settings={settings} updateAiSetting={updateAiSetting} t={t} />
        </div>
    );
};
