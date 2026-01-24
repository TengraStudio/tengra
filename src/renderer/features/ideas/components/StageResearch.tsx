import { ResearchStage } from '@shared/types/ideas'
import { Play } from 'lucide-react'
import React from 'react'

import { cn } from '@/lib/utils'

import { WorkflowStage } from '../types'

import { ResearchProgress } from './ResearchProgress'

interface StageResearchProps {
    researchStage: ResearchStage
    researchProgress: number
    researchMessage: string
    currentSessionId?: string
    isGenerating: boolean
    startGeneration: (sessionId: string) => Promise<void>
    setWorkflowStage: (stage: WorkflowStage) => void
    t: (key: string) => string
}

export const StageResearch: React.FC<StageResearchProps> = ({
    researchStage,
    researchProgress,
    researchMessage,
    currentSessionId,
    isGenerating,
    startGeneration,
    setWorkflowStage,
    t
}) => (
    <div className="space-y-6">
        <ResearchProgress
            stage={researchStage}
            progress={researchProgress}
            message={researchMessage}
        />

        {researchStage === 'complete' && (
            <button
                type="button"
                onClick={() => {
                    if (currentSessionId) {
                        setWorkflowStage('generation')
                        void startGeneration(currentSessionId)
                    }
                }}
                disabled={isGenerating}
                className={cn(
                    'w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2',
                    'bg-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
            >
                <Play className="w-5 h-5" />
                {t('ideas.startGeneration')}
            </button>
        )}
    </div>
)
