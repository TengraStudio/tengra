/**
 * Card component for displaying a generated idea
 */
import { ProjectIdea } from '@shared/types/ideas'
import { ChevronRight, Sparkles } from 'lucide-react'
import React from 'react'

import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

import { getCategoryMeta } from '../utils/categories'

interface IdeaCardProps {
    idea: ProjectIdea
    onClick: () => void
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ idea, onClick }) => {
    const { t } = useTranslation()
    const meta = getCategoryMeta(idea.category)
    const Icon = meta.icon

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'w-full text-left p-5 rounded-xl transition-all',
                'bg-black/40 backdrop-blur-sm border border-white/10',
                'hover:bg-white/5 hover:border-white/20',
                'group'
            )}
        >
            <div className="flex items-start gap-4">
                {/* Category icon */}
                <div className={cn(
                    'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
                    meta.bgColor, meta.color
                )}>
                    <Icon className="w-6 h-6" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">
                        {idea.title}
                    </h3>
                    <p className="text-sm text-white/50 mt-1 line-clamp-2">
                        {idea.description}
                    </p>

                    {/* Value proposition preview */}
                    {idea.valueProposition && (
                        <div className="mt-3 flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-white/70 line-clamp-2">
                                {idea.valueProposition}
                            </p>
                        </div>
                    )}

                    {/* Status badge */}
                    <div className="mt-3 flex items-center justify-between">
                        <span className={cn(
                            'text-xs px-2 py-1 rounded-full',
                            idea.status === 'pending' && 'bg-white/10 text-white/60',
                            idea.status === 'approved' && 'bg-green-500/20 text-green-400',
                            idea.status === 'rejected' && 'bg-red-500/20 text-red-400'
                        )}>
                            {t(`ideas.status.${idea.status}`)}
                        </span>

                        <span className="text-sm text-white/40 flex items-center gap-1 group-hover:text-white/60">
                            {t('ideas.idea.viewDetails')}
                            <ChevronRight className="w-4 h-4" />
                        </span>
                    </div>
                </div>
            </div>
        </button>
    )
}
