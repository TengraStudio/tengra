import { Code2, Sliders, Sparkles, Target } from 'lucide-react';

import { ParameterPreset } from '../ParameterPresets';

export const presetIconMap = {
    creative: Sparkles,
    precise: Target,
    coding: Code2,
    custom: Sliders
};

export const getPresetIcon = (icon: ParameterPreset['icon']) => {
    return presetIconMap[icon];
};

export const getPresetColor = (icon: ParameterPreset['icon'], isActive: boolean) => {
    if (!isActive) { return 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'; }
    switch (icon) {
        case 'creative': return 'bg-orange/15 border-orange/30 text-orange-300';
        case 'precise': return 'bg-primary/15 border-primary/30 text-blue-300';
        case 'coding': return 'bg-success/15 border-success/30 text-green-300';
        default: return 'bg-purple/15 border-purple/30 text-purple-300';
    }
};
