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
                'bg-muted/20 backdrop-blur-sm border border-border/50',
                'hover:bg-muted/40 hover:border-border transition-all duration-200',
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
                    <h3 className="text-lg font-semibold text-foreground truncate">
                        {idea.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {idea.description}
                    </p>

                    {/* Value proposition preview */}
                    {idea.valueProposition && (
                        <div className="mt-3 flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-foreground/70 line-clamp-2 italic">
                                {idea.valueProposition}
                            </p>
                        </div>
                    )}

                    {/* Status badge */}
                    <div className="mt-3 flex items-center justify-between">
                        <span className={cn(
                            'text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full',
                            idea.status === 'pending' && 'bg-muted text-muted-foreground',
                            idea.status === 'approved' && 'bg-primary/20 text-primary border border-primary/20',
                            idea.status === 'rejected' && 'bg-destructive/20 text-destructive border border-destructive/20'
                        )}>
                            {t(`ideas.status.${idea.status}`)}
                        </span>

                        <span className="text-sm text-muted-foreground/60 flex items-center gap-1 group-hover:text-muted-foreground">
                            {t('ideas.idea.viewDetails')}
                            <ChevronRight className="w-4 h-4" />
                        </span>
                    </div>
                </div>
            </div>
        </button>
    )
}
