import { ProjectIdea } from '@shared/types/ideas'
import { Lightbulb, Loader2 } from 'lucide-react'
import React from 'react'

import { WorkflowStage } from '../types'

import { IdeaGrid } from './IdeaGrid'

interface StageGenerationProps {
    isGenerating: boolean
    ideasCount: number
    maxIdeas: number
    ideas: ProjectIdea[]
    setSelectedIdea: (idea: ProjectIdea) => void
    setWorkflowStage: (stage: WorkflowStage) => void
    t: (key: string) => string
}

export const StageGeneration: React.FC<StageGenerationProps> = ({
    isGenerating,
    ideasCount,
    maxIdeas,
    ideas,
    setSelectedIdea,
    setWorkflowStage,
    t
}) => (
    <div className="space-y-6">
        <div className="bg-muted/20 backdrop-blur-sm rounded-xl border border-border p-6 shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-4">{t('ideas.generation.title')}</h3>

            {isGenerating ? (
                <div className="flex items-center gap-4">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <p className="text-muted-foreground font-medium">
                        {t('ideas.generation.progress')
                            .replace('{{current}}', String(ideasCount + 1))
                            .replace('{{total}}', String(maxIdeas))}
                    </p>
                </div>
            ) : (
                <div className="flex items-center gap-4 text-primary">
                    <Lightbulb className="w-6 h-6 text-amber-500" />
                    <p className="font-bold">{t('ideas.generation.complete')}</p>
                </div>
            )}
        </div>

        {ideas.length > 0 && <IdeaGrid ideas={ideas} onSelectIdea={setSelectedIdea} />}

        {!isGenerating && ideas.length > 0 && (
            <button
                type="button"
                onClick={() => setWorkflowStage('review')}
                className="w-full py-4 rounded-xl font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-lg shadow-primary/20"
            >
                {t('ideas.generation.complete')} - {t('ideas.idea.viewDetails')}
            </button>
        )}
    </div>
)
