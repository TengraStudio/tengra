/**
 * Card component for displaying a generated idea
 */
import { ProjectIdea } from '@shared/types/ideas';
import { ChevronRight, Sparkles } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { getCategoryMeta } from '../utils/categories';

interface IdeaCardProps {
    idea: ProjectIdea
    onClick: () => void
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ idea, onClick }) => {
    const { t } = useTranslation();
    const meta = getCategoryMeta(idea.category);
    const Icon = meta.icon;
    const [isFlipped, setIsFlipped] = React.useState(false);

    // Placeholder for high potential logic
    const isHighPotential = idea.status === 'approved';

    const handleFlip = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFlipped(!isFlipped);
    };

    const cardContent = (
        <React.Fragment>
            {/* Front Face */}
            <div className={cn(
                "w-full h-full text-left p-5 rounded-xl backface-hidden absolute inset-0 transition-opacity duration-300",
                isFlipped ? "opacity-0 pointer-events-none" : "opacity-100 z-10"
            )}>
                <div className="flex items-start gap-4 h-full">
                    {/* Category icon */}
                    <div className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
                        meta.bgColor, meta.color
                    )}>
                        <Icon className="w-6 h-6" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col h-full">
                        <h3 className="text-lg font-semibold text-foreground truncate">
                            {idea.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {idea.description}
                        </p>

                        {/* Value proposition preview */}
                        {idea.valueProposition && (
                            <div className="mt-3 flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                                <p className="text-sm text-foreground/70 line-clamp-2 italic">
                                    {idea.valueProposition}
                                </p>
                            </div>
                        )}

                        <div className="flex-1" />

                        {/* Status badge */}
                        <div className="mt-3 flex items-center justify-between">
                            <span className={cn(
                                'text-xxs uppercase tracking-wider font-bold px-2 py-1 rounded-full',
                                idea.status === 'pending' && 'bg-muted text-muted-foreground',
                                idea.status === 'approved' && 'bg-primary/20 text-primary border border-primary/20',
                                idea.status === 'rejected' && 'bg-destructive/20 text-destructive border border-destructive/20'
                            )}>
                                {t(`ideas.status.${idea.status}`)}
                            </span>

                            <button
                                onClick={handleFlip}
                                className="text-sm text-muted-foreground/60 flex items-center gap-1 hover:text-primary transition-colors z-20"
                            >
                                {t('ideas.idea.viewDetails')}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Back Face */}
            <div className={cn(
                "w-full h-full text-left p-5 rounded-xl backface-hidden absolute inset-0 rotate-y-180 bg-card/50 backdrop-blur-md overflow-hidden flex flex-col",
                isFlipped ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
            )}>
                <div className="flex items-center justify-between mb-4 border-b border-border/10 pb-2">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        Technical Details
                    </h3>
                    <button onClick={handleFlip} className="text-xs text-muted-foreground hover:text-foreground">
                        Close
                    </button>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1 text-sm text-muted-foreground">
                    <p><strong>Impact:</strong> High (Estimated)</p>
                    <p><strong>Effort:</strong> Medium</p>
                    {idea.valueProposition && (
                        <div>
                            <strong className="block text-foreground/80 mb-1">Value Proposition</strong>
                            <p className="italic">{idea.valueProposition}</p>
                        </div>
                    )}
                    <div className="pt-2">
                        <button onClick={onClick} className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs font-medium transition-colors">
                            Open Full Project
                        </button>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );

    return (
        <div className={cn(
            "relative group perspective-1000 w-full h-[220px]", // Fixed height for flip
            isHighPotential && "p-[1px] rounded-xl bg-gradient-to-r from-primary via-purple-500 to-pink-500"
        )}>
            <div className={cn(
                "relative w-full h-full transition-transform duration-500 transform-style-3d shadow-lg rounded-xl",
                isFlipped ? "rotate-y-180" : "",
                !isHighPotential && "border border-border/50 bg-muted/20 backdrop-blur-sm hover:bg-muted/40 hover:border-border transition-all duration-200",
                isHighPotential && "bg-card/90" // Inner background for gradient border
            )}>
                {cardContent}
            </div>
        </div>
    );
};
