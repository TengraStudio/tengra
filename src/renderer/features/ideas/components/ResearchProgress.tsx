/**
 * Animated research progress display
 */
import { ResearchStage } from '@shared/types/ideas'
import { Brain, CheckCircle, Search, TrendingUp, Users } from 'lucide-react'
import React from 'react'

import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

interface ResearchProgressProps {
    stage: ResearchStage
    progress: number
    message: string
}

interface StageConfig {
    key: ResearchStage
    icon: React.ElementType
    labelKey: string
}

const STAGES: StageConfig[] = [
    { key: 'understanding', icon: Brain, labelKey: 'ideas.research.understanding' },
    { key: 'sector-analysis', icon: TrendingUp, labelKey: 'ideas.research.sectorAnalysis' },
    { key: 'market-research', icon: Search, labelKey: 'ideas.research.marketResearch' },
    { key: 'competitor-analysis', icon: Users, labelKey: 'ideas.research.competitorAnalysis' }
]

export const ResearchProgress: React.FC<ResearchProgressProps> = ({
    stage,
    progress,
    message
}) => {
    const { t } = useTranslation()

    const getStageIndex = (s: ResearchStage): number => {
        if (s === 'idle') {return -1}
        if (s === 'complete') {return STAGES.length}
        return STAGES.findIndex(st => st.key === s)
    }

    const currentIndex = getStageIndex(stage)

    return (
        <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
                {t('ideas.research.title')}
            </h3>

            {/* Progress stages */}
            <div className="space-y-4">
                {STAGES.map((stageConfig, index) => {
                    const Icon = stageConfig.icon
                    const isActive = currentIndex === index
                    const isComplete = currentIndex > index
                    const isPending = currentIndex < index

                    return (
                        <div
                            key={stageConfig.key}
                            className={cn(
                                'flex items-center gap-4 p-3 rounded-lg transition-all',
                                isActive && 'bg-white/10',
                                isComplete && 'opacity-60'
                            )}
                        >
                            <div className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center',
                                isActive && 'bg-purple-500/20 text-purple-400 animate-pulse',
                                isComplete && 'bg-green-500/20 text-green-400',
                                isPending && 'bg-white/5 text-white/30'
                            )}>
                                {isComplete ? (
                                    <CheckCircle className="w-5 h-5" />
                                ) : (
                                    <Icon className="w-5 h-5" />
                                )}
                            </div>

                            <div className="flex-1">
                                <p className={cn(
                                    'font-medium',
                                    isActive && 'text-white',
                                    isComplete && 'text-white/60',
                                    isPending && 'text-white/30'
                                )}>
                                    {t(stageConfig.labelKey)}
                                </p>
                                {isActive && message && (
                                    <p className="text-sm text-white/50 mt-1">{message}</p>
                                )}
                            </div>

                            {isActive && (
                                <div className="w-20">
                                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-500 transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Complete state */}
                {stage === 'complete' && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-green-500/10">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500/20 text-green-400">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <p className="font-medium text-green-400">
                            {t('ideas.research.complete')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
