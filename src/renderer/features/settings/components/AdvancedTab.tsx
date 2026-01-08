import React, { useState } from 'react'
import { MessageSquare, Sliders, Zap, Activity, Thermometer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppSettings } from '../hooks/useSettingsLogic'
import { SelectDropdown } from '@/components/ui/SelectDropdown'

interface AdvancedTabProps {
    settings: AppSettings | null
    installedModels: any[]
    proxyModels?: any[]
    setSettings: (s: AppSettings) => void
    handleSave: (s?: AppSettings) => void
    benchmarkResult: any
    isBenchmarking: boolean
    handleRunBenchmark: (id: string) => void
    t: (key: string) => string
}

export const AdvancedTab: React.FC<AdvancedTabProps> = ({
    settings, installedModels, proxyModels, setSettings, handleSave, benchmarkResult, isBenchmarking: _isBenchmarking, handleRunBenchmark: _handleRunBenchmark, t
}) => {
    const [selectedConfigModel, setSelectedConfigModel] = useState<string | null>(null)
    const availableModels = [...(installedModels || []), ...(proxyModels || [])]
    const currentModelId = selectedConfigModel || availableModels[0]?.id
    const modelSettings = settings?.modelSettings?.[currentModelId] || {}
    const modelPresets = settings?.presets || [
        { id: 'creative', name: 'Yaratıcı', temperature: 0.9, topP: 0.95, frequencyPenalty: 0.1, presencePenalty: 0.1 },
        { id: 'precise', name: 'Hassas', temperature: 0.2, topP: 0.1, frequencyPenalty: 0, presencePenalty: 0 },
        { id: 'balanced', name: 'Dengeli', temperature: 0.7, topP: 0.9, frequencyPenalty: 0, presencePenalty: 0 }
    ]

    const modelOptions = availableModels.map(m => ({ value: m.id, label: m.id }))

    const updateModelSetting = (patch: any) => {
        if (!settings || !currentModelId) return
        const updated = { ...settings, modelSettings: { ...settings.modelSettings, [currentModelId]: { ...(settings.modelSettings?.[currentModelId] || {}), ...patch } } }
        setSettings(updated)
        handleSave(updated)
    }

    return (
        <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border space-y-6">
                <div className="flex items-center justify-between">
                    <div><h3 className="text-sm font-bold text-white uppercase tracking-wider">Model Yapılandırma</h3><p className="text-xs text-muted-foreground mt-1">Seçili modele özel sistem komutları ve parametreler.</p></div>
                    <SelectDropdown
                        value={currentModelId}
                        options={modelOptions}
                        onChange={setSelectedConfigModel}
                        className="w-48"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /><span className="text-xs font-bold text-white uppercase tracking-wider">Özel Sistem Mesajı</span></div>
                        <textarea value={modelSettings.systemPrompt || ''} onChange={e => updateModelSetting({ systemPrompt: e.target.value })} placeholder="Bu modele özel sistem komutu..." className="w-full h-32 bg-muted/10 border border-border/50 rounded-xl p-3 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none resize-none font-medium leading-relaxed" />
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2"><Sliders className="w-4 h-4 text-emerald-400" /><span className="text-xs font-bold text-white uppercase tracking-wider">Parametre Seti</span></div>
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
                            if (!settings) return
                            const updated = { ...settings, ollama: { ...settings.ollama, orchestrationPolicy: val as any } }
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
        </div>
    )
}
