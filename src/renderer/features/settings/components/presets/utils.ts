import { Code2, Sliders, Sparkles, Target } from 'lucide-react'

import { ParameterPreset } from '../ParameterPresets'

export const presetIconMap = {
    creative: Sparkles,
    precise: Target,
    coding: Code2,
    custom: Sliders
}

export const getPresetIcon = (icon: ParameterPreset['icon']) => {
    return presetIconMap[icon]
}

export const getPresetColor = (icon: ParameterPreset['icon'], isActive: boolean) => {
    if (!isActive) { return 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10' }
    switch (icon) {
        case 'creative': return 'bg-orange-500/15 border-orange-500/30 text-orange-300'
        case 'precise': return 'bg-blue-500/15 border-blue-500/30 text-blue-300'
        case 'coding': return 'bg-green-500/15 border-green-500/30 text-green-300'
        default: return 'bg-purple-500/15 border-purple-500/30 text-purple-300'
    }
}
