import { Check, Plus } from 'lucide-react'
import { useState } from 'react'

import { Language, useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

import { PresetCard } from './presets/PresetCard'
import { PresetEditor } from './presets/PresetEditor'
import { getPresetColor, getPresetIcon } from './presets/utils'

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
                {allPresets.map((preset) => (
                    <PresetCard
                        key={preset.id}
                        preset={preset}
                        isActive={activePresetId === preset.id}
                        onSelect={onSelectPreset}
                        onDelete={onDeleteCustomPreset}
                        t={t}
                    />
                ))}
            </div>

            {/* Custom Preset Editor */}
            {showCustom && editingPreset && (
                <PresetEditor
                    preset={editingPreset}
                    onUpdate={setEditingPreset}
                    onCancel={() => { setShowCustom(false); setEditingPreset(null) }}
                    onSave={handleSaveCustom}
                    t={t}
                />
            )}
        </div>
    )
}
