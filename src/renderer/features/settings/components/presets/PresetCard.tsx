import { Check, Trash2 } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { ParameterPreset } from '../ParameterPresets';

import { getPresetColor, presetIconMap } from './utils';

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
                    className="absolute top-1 right-1 p-1 rounded bg-destructive/20 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Trash2 size={10} />
                </button>
            )}
            <div className="flex flex-col items-center gap-2">
                <IconComp size={20} />
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
                    <Check size={10} className="text-background" />
                </div>
            )}
        </div>
    );
};
