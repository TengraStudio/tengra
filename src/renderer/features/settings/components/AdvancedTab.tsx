import { SERVICE_INTERVALS } from '@shared/constants'
import { AppSettings } from '@shared/types/settings'
import { Activity, Clock, MessageSquare, RefreshCw, Sliders, Thermometer, Zap } from 'lucide-react'
import React, { useState } from 'react'

import { SelectDropdown } from '@/components/ui/SelectDropdown'
import type { ModelInfo } from '@/features/models/utils/model-fetcher'
import { cn } from '@/lib/utils'

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

export const AdvancedTab: React.FC<AdvancedTabProps> = ({
    settings, installedModels, proxyModels, setSettings, handleSave, benchmarkResult, isBenchmarking: _isBenchmarking, handleRunBenchmark: _handleRunBenchmark, t
}) => {
    const [selectedConfigModel, setSelectedConfigModel] = useState<string | null>(null)
    const availableModels = [...(installedModels ?? []), ...(proxyModels ?? [])]
    const currentModelId = selectedConfigModel ?? (availableModels[0]?.id ?? '')
    const modelSettings = settings?.modelSettings?.[currentModelId] ?? {}
    const modelPresets = settings?.presets ?? [
        { id: 'creative', name: t('ssh.presets.creative'), temperature: 0.9, topP: 0.95, frequencyPenalty: 0.1, presencePenalty: 0.1 },
        { id: 'precise', name: t('ssh.presets.precise'), temperature: 0.2, topP: 0.1, frequencyPenalty: 0, presencePenalty: 0 },
        { id: 'balanced', name: t('ssh.presets.balanced'), temperature: 0.7, topP: 0.9, frequencyPenalty: 0, presencePenalty: 0 }
    ]

    const modelOptions = availableModels.map(m => ({ value: m.id || '', label: m.id || '' }))

    type ModelSettingsPatch = Partial<NonNullable<AppSettings['modelSettings']>[string]>
    const updateModelSetting = (patch: ModelSettingsPatch) => {
        if (!settings || !currentModelId) { return }
        const updated = { ...settings, modelSettings: { ...settings.modelSettings, [currentModelId]: { ...(settings.modelSettings?.[currentModelId] || {}), ...patch } } }
        setSettings(updated)
        handleSave(updated)
    }

    return (
        <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border space-y-6">
                <div className="flex items-center justify-between">
                    <div><h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('advancedTab.modelConfiguration')}</h3><p className="text-xs text-muted-foreground mt-1">{t('advancedTab.modelConfigurationDesc')}</p></div>
                    <SelectDropdown
                        value={currentModelId}
                        options={modelOptions}
                        onChange={setSelectedConfigModel}
                        className="w-48"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /><span className="text-xs font-bold text-white uppercase tracking-wider">{t('advancedTab.customSystemMessage')}</span></div>
                        <textarea value={modelSettings.systemPrompt || ''} onChange={e => updateModelSetting({ systemPrompt: e.target.value })} placeholder={t('advancedTab.systemPromptPlaceholder')} className="w-full h-32 bg-muted/10 border border-border/50 rounded-xl p-3 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none resize-none font-medium leading-relaxed" />
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2"><Sliders className="w-4 h-4 text-emerald-400" /><span className="text-xs font-bold text-white uppercase tracking-wider">{t('advancedTab.parameterPreset')}</span></div>
                        <div className="grid grid-cols-1 gap-2">
                            {modelPresets.map(p => (
                                <button key={p.id} onClick={() => updateModelSetting({ presetId: p.id })} className={cn("flex items-center justify-between p-3 rounded-xl border transition-all text-left", modelSettings.presetId === p.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10")}>
                                    <div><div className="text-xs font-bold">{p.name}</div><div className="text-[10px] opacity-60">Temp: {p.temperature} • TopP: {p.topP}</div></div>
                                    {modelSettings.presetId === p.id && <Zap className="w-4 h-4 animate-pulse" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-purple-400" />
                        <div>
                            <h3 className="text-sm font-bold text-white">{t('advanced.orchestration')}</h3>
                            <p className="text-xs text-muted-foreground">{t('advanced.orchestrationDesc')}</p>
                        </div>
                    </div>
                    <SelectDropdown
                        value={settings?.ollama?.orchestrationPolicy || 'auto'}
                        options={[
                            { value: 'auto', label: t('advanced.orchestrationAuto') },
                            { value: 'fifo', label: t('advanced.orchestrationFIFO') },
                            { value: 'parallel', label: t('advanced.orchestrationParallel') }
                        ]}
                        onChange={(val) => {
                            if (!settings) { return }
                            const updated = { ...settings, ollama: { ...settings.ollama, orchestrationPolicy: val as 'auto' | 'fifo' | 'parallel' } }
                            setSettings(updated)
                            handleSave(updated)
                        }}
                        className="w-48"
                    />
                </div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                {benchmarkResult && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center gap-1">
                            <Thermometer className="w-5 h-5 text-primary" /><div className="text-xl font-black text-white">{benchmarkResult.tokensPerSec} t/s</div><div className="text-[10px] text-muted-foreground uppercase font-bold">{t('advanced.tokensPerSec')}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center gap-1">
                            <Activity className="w-5 h-5 text-emerald-400" /><div className="text-xl font-black text-white">{benchmarkResult.latency}ms</div><div className="text-[10px] text-muted-foreground uppercase font-bold">{t('advanced.latency')}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* AI Service Intervals */}
            <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('advanced.serviceIntervals')}</h3>
                        <p className="text-xs text-muted-foreground">{t('advanced.serviceIntervalsDesc')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Model Update Interval */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                            {t('advanced.modelUpdateInterval')}
                        </label>
                        <p className="text-[10px] text-muted-foreground">{t('advanced.modelUpdateIntervalDesc')}</p>
                        <select
                            value={settings?.ai?.modelUpdateInterval ?? SERVICE_INTERVALS.MODEL_UPDATE}
                            onChange={(e) => {
                                if (!settings) { return }
                                const updated = {
                                    ...settings,
                                    ai: { ...settings.ai, modelUpdateInterval: parseInt(e.target.value) }
                                }
                                setSettings(updated)
                                handleSave(updated)
                            }}
                            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            aria-label={t('advanced.modelUpdateInterval')}
                        >
                            <option value={1800000}>30 {t('common.minutes')}</option>
                            <option value={3600000}>1 {t('common.hour')}</option>
                            <option value={7200000}>2 {t('common.hours')}</option>
                            <option value={14400000}>4 {t('common.hours')}</option>
                            <option value={86400000}>24 {t('common.hours')}</option>
                        </select>
                    </div>

                    {/* Token Refresh Interval */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                            {t('advanced.tokenRefreshInterval')}
                        </label>
                        <p className="text-[10px] text-muted-foreground">{t('advanced.tokenRefreshIntervalDesc')}</p>
                        <select
                            value={settings?.ai?.tokenRefreshInterval ?? SERVICE_INTERVALS.TOKEN_REFRESH}
                            onChange={(e) => {
                                if (!settings) { return }
                                const updated = {
                                    ...settings,
                                    ai: { ...settings.ai, tokenRefreshInterval: parseInt(e.target.value) }
                                }
                                setSettings(updated)
                                handleSave(updated)
                            }}
                            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            aria-label={t('advanced.tokenRefreshInterval')}
                        >
                            <option value={60000}>1 {t('common.minute')}</option>
                            <option value={300000}>5 {t('common.minutes')}</option>
                            <option value={600000}>10 {t('common.minutes')}</option>
                            <option value={900000}>15 {t('common.minutes')}</option>
                            <option value={1800000}>30 {t('common.minutes')}</option>
                        </select>
                    </div>

                    {/* Copilot Refresh Interval */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                            {t('advanced.copilotRefreshInterval')}
                        </label>
                        <p className="text-[10px] text-muted-foreground">{t('advanced.copilotRefreshIntervalDesc')}</p>
                        <select
                            value={settings?.ai?.copilotRefreshInterval ?? SERVICE_INTERVALS.COPILOT_REFRESH}
                            onChange={(e) => {
                                if (!settings) { return }
                                const updated = {
                                    ...settings,
                                    ai: { ...settings.ai, copilotRefreshInterval: parseInt(e.target.value) }
                                }
                                setSettings(updated)
                                handleSave(updated)
                            }}
                            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            aria-label={t('advanced.copilotRefreshInterval')}
                        >
                            <option value={300000}>5 {t('common.minutes')}</option>
                            <option value={600000}>10 {t('common.minutes')}</option>
                            <option value={900000}>15 {t('common.minutes')}</option>
                            <option value={1800000}>30 {t('common.minutes')}</option>
                            <option value={3600000}>1 {t('common.hour')}</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}
