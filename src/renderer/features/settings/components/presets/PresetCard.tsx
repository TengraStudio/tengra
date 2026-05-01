/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCheck, IconTrash } from '@tabler/icons-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { ParameterPreset } from '../ParameterPresets';

import { getPresetColor, presetIconMap } from './utils';

/* Batch-02: Extracted Long Classes */
const C_PRESETCARD_1 = "absolute top-1 right-1 p-1 rounded bg-destructive/20 text-destructive opacity-0 group-hover:opacity-100 transition-opacity";


interface PresetCardProps {
    preset: ParameterPreset
    isActive: boolean
    onSelect: (preset: ParameterPreset) => void
    onDelete?: (id: string) => void
    t: (key: string) => string
}

export const PresetCard: React.FC<PresetCardProps> = ({
    preset, isActive, onSelect, onDelete, t
}) => {
    const IconComp = presetIconMap[preset.icon];
    const isCustom = preset.icon === 'custom';

    return (
        <div
            className={cn(
                "relative p-3 rounded-xl border cursor-pointer transition-all group",
                getPresetColor(preset.icon, isActive)
            )}
            onClick={() => onSelect(preset)}
        >
            {isCustom && onDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(preset.id); }}
                    className={C_PRESETCARD_1}
                >
                    <IconTrash size={10} />
                </button>
            )}
            <div className="flex flex-col items-center gap-2">
                <IconComp size={20} />
                <div className="typo-caption font-medium">
                    {preset.id === 'creative' ? t('frontend.ssh.presets.creative') :
                        preset.id === 'precise' ? t('frontend.ssh.presets.precise') :
                            preset.id === 'coding' ? t('frontend.ssh.presets.coding') : preset.name}
                </div>
                <div className="text-sm opacity-60">
                    T:{preset.temperature} P:{preset.topP}
                </div>
            </div>
            {isActive && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-current rounded-full flex items-center justify-center">
                    <IconCheck size={10} className="text-background" />
                </div>
            )}
        </div>
    );
};
