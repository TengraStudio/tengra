/**
 * Grid layout for displaying multiple ideas
 */
import { ProjectIdea } from '@shared/types/ideas'
import { Lightbulb } from 'lucide-react'
import React from 'react'

import { useTranslation } from '@/i18n'

import { IdeaCard } from './IdeaCard'

interface IdeaGridProps {
    ideas: ProjectIdea[]
    onSelectIdea: (idea: ProjectIdea) => void
}

export const IdeaGrid: React.FC<IdeaGridProps> = ({ ideas, onSelectIdea }) => {
    const { t } = useTranslation()

    if (ideas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Lightbulb className="w-8 h-8 text-white/30" />
                </div>
                <h3 className="text-lg font-medium text-white/60">
                    {t('ideas.empty.noIdeas')}
                </h3>
                <p className="text-sm text-white/40 mt-1">
                    {t('ideas.empty.noIdeasDesc')}
                </p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ideas.map(idea => (
                <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onClick={() => onSelectIdea(idea)}
                />
            ))}
        </div>
    )
}
