/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCheck, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { PresetCard } from './presets/PresetCard';
import { PresetEditor } from './presets/PresetEditor';
import { getPresetColor, getPresetIcon } from './presets/utils';

/* Batch-02: Extracted Long Classes */
const C_PARAMETERPRESETS_1 = "flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/20 border border-border/50 typo-caption text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors";


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
];

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
    const { t } = useTranslation(language);
    const [showCustom, setShowCustom] = useState(false);
    const [editingPreset, setEditingPreset] = useState<ParameterPreset | null>(null);

    const resolvePresetName = (preset: ParameterPreset): string => {
        if (preset.id === 'creative') { return t('ssh.presets.creative'); }
        if (preset.id === 'precise') { return t('ssh.presets.precise'); }
        if (preset.id === 'coding') { return t('ssh.presets.coding'); }
        if (preset.id.startsWith('custom-')) { return t('ssh.presets.custom'); }
        return preset.name;
    };

    const allPresets = [...DEFAULT_PRESETS, ...customPresets];

    const handleCreateCustom = () => {
        const newPreset: ParameterPreset = {
            id: `custom-${Date.now()}`,
            name: t('ssh.presets.custom'),
            icon: 'custom',
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 4096
        };
        setEditingPreset(newPreset);
        setShowCustom(true);
    };

    const handleSaveCustom = () => {
        if (editingPreset && onSaveCustomPreset) {
            onSaveCustomPreset(editingPreset);
            setShowCustom(false);
            setEditingPreset(null);
        }
    };

    if (compact) {
        return (
            <div className="flex gap-1.5 flex-wrap">
                {DEFAULT_PRESETS.map((preset) => {
                    const Icon = getPresetIcon(preset.icon);
                    const isActive = activePresetId === preset.id;

                    return (
                        <button
                            key={preset.id}
                            onClick={() => onSelectPreset(preset)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border typo-caption font-medium transition-all",
                                getPresetColor(preset.icon, isActive)
                            )}
                            title={`${resolvePresetName(preset)}: temp=${preset.temperature}, top_p=${preset.topP}`}
                        >
                            <Icon size={12} />
                            {resolvePresetName(preset)}
                            {isActive && <IconCheck size={10} />}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{t('ssh.presets.title')}</h3>
                <button
                    onClick={handleCreateCustom}
                    className={C_PARAMETERPRESETS_1}
                >
                    <IconPlus size={12} />
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
                    onCancel={() => { setShowCustom(false); setEditingPreset(null); }}
                    onSave={handleSaveCustom}
                    t={t}
                />
            )}
        </div>
    );
}
