import { useState } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Settings2, ChevronUp, ChevronDown } from 'lucide-react'

interface HyperparameterPanelProps {
    temperature: number
    topP: number
    topK: number
    repeatPenalty: number
    onTemperatureChange: (value: number) => void
    onTopPChange: (value: number) => void
    onTopKChange: (value: number) => void
    onRepeatPenaltyChange: (value: number) => void
}

export function HyperparameterPanel({
    temperature,
    topP,
    topK,
    repeatPenalty,
    onTemperatureChange,
    onTopPChange,
    onTopKChange,
    onRepeatPenaltyChange
}: HyperparameterPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    const sliders = [
        {
            label: 'Temperature',
            value: temperature,
            onChange: onTemperatureChange,
            min: 0,
            max: 2,
            step: 0.1,
            description: 'YaratÄ±cÄ±lÄ±k seviyesi (0: deterministik, 2: Ã§ok yaratÄ±cÄ±)'
        },
        {
            label: 'Top-P',
            value: topP,
            onChange: onTopPChange,
            min: 0,
            max: 1,
            step: 0.05,
            description: 'Nucleus sampling olasÄ±lÄ±k eÅŸiÄŸi'
        },
        {
            label: 'Top-K',
            value: topK,
            onChange: onTopKChange,
            min: 1,
            max: 100,
            step: 1,
            description: 'En olasÄ± token sayÄ±sÄ±'
        },
        {
            label: 'Repeat Penalty',
            value: repeatPenalty,
            onChange: onRepeatPenaltyChange,
            min: 1,
            max: 2,
            step: 0.05,
            description: 'Tekrar cezasÄ± (1: yok, 2: yÃ¼ksek)'
        }
    ]

    return (
        <div className="glass-card rounded-lg overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium">Hiperparametreler</span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
            </button>

            <motion.div
                initial={false}
                animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
            >
                <div className="px-4 pb-4 pt-2 space-y-4">
                    {sliders.map((slider) => (
                        <div key={slider.label} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">
                                    {slider.label}
                                </label>
                                <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
                                    {slider.value.toFixed(slider.step < 1 ? 2 : 0)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={slider.min}
                                max={slider.max}
                                step={slider.step}
                                value={slider.value}
                                onChange={(e) => slider.onChange(parseFloat(e.target.value))}
                                className={cn(
                                    "w-full h-2 rounded-full appearance-none cursor-pointer",
                                    "bg-white/10",
                                    "[&::-webkit-slider-thumb]:appearance-none",
                                    "[&::-webkit-slider-thumb]:w-4",
                                    "[&::-webkit-slider-thumb]:h-4",
                                    "[&::-webkit-slider-thumb]:rounded-full",
                                    "[&::-webkit-slider-thumb]:bg-purple-500",
                                    "[&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]",
                                    "[&::-webkit-slider-thumb]:transition-all",
                                    "[&::-webkit-slider-thumb]:hover:scale-110"
                                )}
                            />
                            <p className="text-sm text-muted-foreground/60">
                                {slider.description}
                            </p>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
