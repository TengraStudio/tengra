import { Code2, Sliders, Sparkles, Target } from 'lucide-react';

import { ParameterPreset } from '../ParameterPresets';

export const presetIconMap = {
    creative: Sparkles,
    precise: Target,
    coding: Code2,
    custom: Sliders,
};

export const getPresetIcon = (icon: ParameterPreset['icon']) => {
    return presetIconMap[icon];
};

export const getPresetColor = (icon: ParameterPreset['icon'], isActive: boolean) => {
    if (!isActive) {
        return 'bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted/60';
    }
    switch (icon) {
        case 'creative':
            return 'bg-warning/15 border-warning/30 text-warning-light';
        case 'precise':
            return 'bg-primary/15 border-primary/30 text-info-light';
        case 'coding':
            return 'bg-success/15 border-success/30 text-success-light';
        default:
            return 'bg-accent/15 border-accent/30 text-accent';
    }
};
