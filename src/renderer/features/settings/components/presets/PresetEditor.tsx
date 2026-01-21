import React from 'react'

import { ParameterPreset } from '../ParameterPresets'

interface PresetEditorProps {
    preset: ParameterPreset
    onUpdate: (preset: ParameterPreset) => void
    onCancel: () => void
    onSave: () => void
    t: (key: string) => string
}

export const PresetEditor: React.FC<PresetEditorProps> = ({
    preset, onUpdate, onCancel, onSave, t
}) => {
    return (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <input
                type="text"
                value={preset.name}
                onChange={(e) => onUpdate({ ...preset, name: e.target.value })}
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
                        value={preset.temperature}
                        onChange={(e) => onUpdate({ ...preset, temperature: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                    <div className="text-xs text-center">{preset.temperature}</div>
                </div>
                <div>
                    <label className="text-xs text-zinc-500 mb-1 block">{t('ssh.presets.labels.topP')}</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={preset.topP}
                        onChange={(e) => onUpdate({ ...preset, topP: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                    <div className="text-xs text-center">{preset.topP}</div>
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onCancel}
                    className="flex-1 py-2 rounded-lg bg-white/5 text-zinc-400 text-sm"
                >
                    {t('common.cancel')}
                </button>
                <button
                    onClick={onSave}
                    className="flex-1 py-2 rounded-lg bg-purple-500/20 text-purple-300 text-sm font-medium"
                >
                    {t('common.save')}
                </button>
            </div>
        </div>
    )
}
