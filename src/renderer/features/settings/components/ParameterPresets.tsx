import { Check, Code2, Plus, Sliders, Sparkles, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Language, useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

export interface ParameterPreset {
    id: string
    name: string
    icon: 'creative' | 'precise' | 'coding' | 'custom'
    temperature: number
    topP: number
    maxTokens: number
    presencePenalty?: number
    frequencyPenalty?: number
}

const DEFAULT_PRESETS: ParameterPreset[] = [
    { id: 'creative', name: 'Creative', icon: 'creative', temperature: 0.9, topP: 0.95, maxTokens: 4096 },
    { id: 'precise', name: 'Precise', icon: 'precise', temperature: 0.3, topP: 0.85, maxTokens: 4096 },
    { id: 'coding', name: 'Coding', icon: 'coding', temperature: 0.2, topP: 0.9, maxTokens: 8192 }
]

interface ParameterPresetsProps {
    activePresetId?: string
    customPresets?: ParameterPreset[]
    onSelectPreset: (preset: ParameterPreset) => void
    onSaveCustomPreset?: (preset: ParameterPreset) => void
    onDeleteCustomPreset?: (id: string) => void
    compact?: boolean
    language?: Language
}

const getPresetIcon = (icon: ParameterPreset['icon']) => {
    switch (icon) {
        case 'creative': return Sparkles
        case 'precise': return Target
        case 'coding': return Code2
        default: return Sliders
    }
}

const getPresetColor = (icon: ParameterPreset['icon'], isActive: boolean) => {
    if (!isActive) { return 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10' }
    switch (icon) {
        case 'creative': return 'bg-orange-500/15 border-orange-500/30 text-orange-300'
        case 'precise': return 'bg-blue-500/15 border-blue-500/30 text-blue-300'
        case 'coding': return 'bg-green-500/15 border-green-500/30 text-green-300'
        default: return 'bg-purple-500/15 border-purple-500/30 text-purple-300'
    }
}

export function ParameterPresets({
    activePresetId,
    customPresets = [],
    onSelectPreset,
    onSaveCustomPreset,
    onDeleteCustomPreset,
    compact = false,
    language
}: ParameterPresetsProps) {
    const { t } = useTranslation(language)
    const [showCustom, setShowCustom] = useState(false)
    const [editingPreset, setEditingPreset] = useState<ParameterPreset | null>(null)

    const allPresets = [...DEFAULT_PRESETS, ...customPresets]

    const handleCreateCustom = () => {
        const newPreset: ParameterPreset = {
            id: `custom-${Date.now()}`,
            name: 'Custom',
            icon: 'custom',
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 4096
        }
        setEditingPreset(newPreset)
        setShowCustom(true)
    }

    const handleSaveCustom = () => {
        if (editingPreset && onSaveCustomPreset) {
            onSaveCustomPreset(editingPreset)
            setShowCustom(false)
            setEditingPreset(null)
        }
    }

    if (compact) {
        return (
            <div className="flex gap-1.5 flex-wrap">
                {DEFAULT_PRESETS.map((preset) => {
                    const Icon = getPresetIcon(preset.icon)
                    const isActive = activePresetId === preset.id

                    return (
                        <button
                            key={preset.id}
                            onClick={() => onSelectPreset(preset)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                getPresetColor(preset.icon, isActive)
                            )}
                            title={`${preset.name}: temp=${preset.temperature}, top_p=${preset.topP}`}
                        >
                            <Icon size={12} />
                            {preset.id === 'creative' ? t('ssh.presets.creative') :
                                preset.id === 'precise' ? t('ssh.presets.precise') :
                                    preset.id === 'coding' ? t('ssh.presets.coding') : preset.name}
                            {isActive && <Check size={10} />}
                        </button>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">{t('ssh.presets.title')}</h3>
                <button
                    onClick={handleCreateCustom}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <Plus size={12} />
                    {t('ssh.presets.custom')}
                </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {allPresets.map((preset) => {
                    const Icon = getPresetIcon(preset.icon)
                    const isActive = activePresetId === preset.id
                    const isCustom = preset.icon === 'custom'

                    return (
                        <div
                            key={preset.id}
                            className={cn(
                                "relative p-3 rounded-xl border cursor-pointer transition-all group",
                                getPresetColor(preset.icon, isActive)
                            )}
                            onClick={() => onSelectPreset(preset)}
                        >
                            {isCustom && onDeleteCustomPreset && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteCustomPreset(preset.id) }}
                                    className="absolute top-1 right-1 p-1 rounded bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={10} />
                                </button>
                            )}
                            <div className="flex flex-col items-center gap-2">
                                <Icon size={20} />
                                <div className="text-xs font-medium">
                                    {preset.id === 'creative' ? t('ssh.presets.creative') :
                                        preset.id === 'precise' ? t('ssh.presets.precise') :
                                            preset.id === 'coding' ? t('ssh.presets.coding') : preset.name}
                                </div>
                                <div className="text-[10px] opacity-60">
                                    T:{preset.temperature} P:{preset.topP}
                                </div>
                            </div>
                            {isActive && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-current rounded-full flex items-center justify-center">
                                    <Check size={10} className="text-black" />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Custom Preset Editor */}
            {showCustom && editingPreset && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <input
                        type="text"
                        value={editingPreset.name}
                        onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white"
                        placeholder={t('ssh.presets.placeholders.name')}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">{t('ssh.presets.labels.temperature')}</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={editingPreset.temperature}
                                onChange={(e) => setEditingPreset({ ...editingPreset, temperature: parseFloat(e.target.value) })}
                                className="w-full"
                            />
                            <div className="text-xs text-center">{editingPreset.temperature}</div>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">{t('ssh.presets.labels.topP')}</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={editingPreset.topP}
                                onChange={(e) => setEditingPreset({ ...editingPreset, topP: parseFloat(e.target.value) })}
                                className="w-full"
                            />
                            <div className="text-xs text-center">{editingPreset.topP}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShowCustom(false); setEditingPreset(null) }}
                            className="flex-1 py-2 rounded-lg bg-white/5 text-zinc-400 text-sm"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSaveCustom}
                            className="flex-1 py-2 rounded-lg bg-purple-500/20 text-purple-300 text-sm font-medium"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
