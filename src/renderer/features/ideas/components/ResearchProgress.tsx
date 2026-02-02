/**
 * Animated research progress display
 */
import { ResearchStage } from '@shared/types/ideas';
import { Brain, CheckCircle, LucideIcon, Search, TrendingUp, Users } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface ResearchProgressProps {
    stage: ResearchStage
    progress: number
    message: string
}

interface StageConfig {
    key: ResearchStage
    icon: LucideIcon
    labelKey: string
}

const STAGES: StageConfig[] = [
    { key: 'understanding', icon: Brain, labelKey: 'ideas.research.understanding' },
    { key: 'sector-analysis', icon: TrendingUp, labelKey: 'ideas.research.sectorAnalysis' },
    { key: 'market-research', icon: Search, labelKey: 'ideas.research.marketResearch' },
    { key: 'competitor-analysis', icon: Users, labelKey: 'ideas.research.competitorAnalysis' }
];

type StageState = 'active' | 'complete' | 'pending';

function getStageState(currentIndex: number, stageIndex: number): StageState {
    if (currentIndex === stageIndex) { return 'active'; }
    if (currentIndex > stageIndex) { return 'complete'; }
    return 'pending';
}

const ICON_CLASSES: Record<StageState, string> = {
    active: 'bg-purple/20 text-purple animate-pulse',
    complete: 'bg-success/20 text-success',
    pending: 'bg-white/5 text-foreground/30'
};

const TEXT_CLASSES: Record<StageState, string> = {
    active: 'text-foreground',
    complete: 'text-foreground/60',
    pending: 'text-foreground/30'
};

interface StageItemProps {
    config: StageConfig
    state: StageState
    message: string
    progress: number
    t: (key: string) => string
}

const StageItem: React.FC<StageItemProps> = ({ config, state, message, progress, t }) => {
    const Icon = config.icon;
    
    return (
        <div className={cn(
            'flex items-center gap-4 p-3 rounded-lg transition-all',
            state === 'active' && 'bg-white/10',
            state === 'complete' && 'opacity-60'
        )}>
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', ICON_CLASSES[state])}>
                {state === 'complete' ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
            </div>

            <div className="flex-1">
                <p className={cn('font-medium', TEXT_CLASSES[state])}>{t(config.labelKey)}</p>
                {state === 'active' && message && <p className="text-sm text-foreground/50 mt-1">{message}</p>}
            </div>

            {state === 'active' && (
                <div className="w-20">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-purple transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}
        </div>
    );
};

export const ResearchProgress: React.FC<ResearchProgressProps> = ({ stage, progress, message }) => {
    const { t } = useTranslation();

    const getStageIndex = (s: ResearchStage): number => {
        if (s === 'idle') {return -1;}
        if (s === 'complete') {return STAGES.length;}
        return STAGES.findIndex(st => st.key === s);
    };

    const currentIndex = getStageIndex(stage);

    return (
        <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">{t('ideas.research.title')}</h3>

            <div className="space-y-4">
                {STAGES.map((stageConfig, index) => (
                    <StageItem
                        key={stageConfig.key}
                        config={stageConfig}
                        state={getStageState(currentIndex, index)}
                        message={message}
                        progress={progress}
                        t={t}
                    />
                ))}

                {stage === 'complete' && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-success/10">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-success/20 text-success">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <p className="font-medium text-success">{t('ideas.research.complete')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
