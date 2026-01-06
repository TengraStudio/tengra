import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { ModelExplorer } from '@/features/models/components/ModelExplorer'
import { AppSettings } from '../../hooks/useSettingsLogic'

interface ModelsTabProps {
    settings: AppSettings | null
    installedModels: any[]
    proxyModels?: any[]
    setSettings: (s: AppSettings) => void
    handleSave: (s?: AppSettings) => void
    onRefreshModels: () => void
}

export const ModelsTab: React.FC<ModelsTabProps> = ({ settings, installedModels, proxyModels, setSettings, handleSave }) => {
    const [modelsTab, setModelsTab] = useState<'installed' | 'discover'>('installed')
    const [modelSearch, setModelSearch] = useState('')
    const [showHiddenModels, setShowHiddenModels] = useState(false)

    if (!settings) return null
    const hiddenModels = settings.general.hiddenModels || []
    const defaultModel = settings.general.defaultModel || ''

    const combined = new Map()
    for (const model of installedModels) {
        if (!model?.name) continue
        combined.set(model.name, { id: model.name, sources: ['ollama'], details: model })
    }
    for (const model of (proxyModels || [])) {
        const id = String(model?.id || model?.name || '').trim()
        if (!id) continue
        const existing = combined.get(id)
        const source = model?.owned_by ? String(model.owned_by) : 'proxy'
        if (existing) existing.sources = Array.from(new Set([...(existing.sources || []), source]))
        else combined.set(id, { id, sources: [source] })
    }

    const filtered = Array.from(combined.values()).filter((m: any) => {
        if (!showHiddenModels && hiddenModels.includes(m.id)) return false
        if (!modelSearch) return true
        return m.id.toLowerCase().includes(modelSearch.toLowerCase())
    })

    const updateHidden = (modelId: string, hide: boolean) => {
        const nextHidden = hide ? Array.from(new Set([...hiddenModels, modelId])) : hiddenModels.filter(m => m !== modelId)
        const updated = { ...settings, general: { ...settings.general, hiddenModels: nextHidden } }
        setSettings(updated)
        handleSave(updated)
    }

    const setDefault = (modelId: string) => {
        const updated = { ...settings, general: { ...settings.general, defaultModel: modelId } } as any
        setSettings(updated)
        handleSave(updated)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <button onClick={() => setModelsTab('installed')} className={cn("px-4 py-2 rounded-full text-xs font-bold border transition-colors", modelsTab === 'installed' ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-muted-foreground border-white/10")}>Modellerim</button>
                <button onClick={() => setModelsTab('discover')} className={cn("px-4 py-2 rounded-full text-xs font-bold border transition-colors", modelsTab === 'discover' ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-muted-foreground border-white/10")}>Kesfet</button>
            </div>
            {modelsTab === 'installed' ? (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <input type="text" value={modelSearch} onChange={e => setModelSearch(e.target.value)} placeholder="Model ara..." className="h-10 w-64 max-w-full bg-muted/20 border border-border/50 rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                        <button onClick={() => setShowHiddenModels(prev => !prev)} className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-muted-foreground border border-white/10">{showHiddenModels ? 'Gizlileri Sakla' : 'Gizlileri Goster'}</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {filtered.map((model: any) => (
                            <div key={model.id} className="bg-card p-4 rounded-xl border border-border flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm font-bold text-white">{model.id}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{(model.sources || []).map((s: any) => <span key={s} className="mr-2 uppercase tracking-wider">{s}</span>)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {defaultModel === model.id ? <span className="text-xs font-bold uppercase text-emerald-400">Varsayilan</span> : <button onClick={() => setDefault(model.id)} className="px-2.5 py-1 rounded-md text-xs font-bold bg-primary/20 text-primary border border-white/10">Varsayilan Yap</button>}
                                    <button onClick={() => updateHidden(model.id, !hiddenModels.includes(model.id))} className="px-2.5 py-1 rounded-md text-xs font-bold bg-white/5 text-muted-foreground border border-white/10">{hiddenModels.includes(model.id) ? 'Goster' : 'Gizle'}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="h-[700px] border border-border rounded-xl overflow-hidden bg-card"><ModelExplorer /></div>
            )}
        </div>
    )
}
