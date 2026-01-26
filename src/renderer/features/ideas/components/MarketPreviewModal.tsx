/**
 * Modal for showing quick market research preview before full research
 */
import { IdeaCategory } from '@shared/types/ideas';
import { ArrowRight, Loader2, TrendingUp, Users, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface MarketPreview {
    category: IdeaCategory
    summary: string
    keyTrends: string[]
    marketSize: string
    competition: string
}

interface MarketPreviewModalProps {
    categories: IdeaCategory[]
    onClose: () => void
    onContinue: () => void
    isLoading: boolean
    preview: MarketPreview[] | null
}

const CompetitionBadge: React.FC<{ level: string }> = ({ level }) => {
    const isHigh = level.toLowerCase().includes('high');
    const isMedium = level.toLowerCase().includes('medium');
    const isLow = level.toLowerCase().includes('low');

    return (
        <span
            className={cn(
                'px-2 py-1 rounded text-xs font-medium',
                isHigh && 'bg-red-500/10 text-red-500',
                isMedium && 'bg-yellow-500/10 text-yellow-500',
                isLow && 'bg-green-500/10 text-green-500',
                !isHigh && !isMedium && !isLow && 'bg-muted/50 text-muted-foreground'
            )}
        >
            {level}
        </span>
    );
};

export const MarketPreviewModal: React.FC<MarketPreviewModalProps> = ({
    categories,
    onClose,
    onContinue,
    isLoading,
    preview
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-border/50">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border/50">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Market Research Preview</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Quick market overview for your selected categories
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground">Analyzing market conditions...</p>
                        </div>
                    ) : preview ? (
                        <div className="space-y-6">
                            {preview.map((item, idx) => (
                                <div
                                    key={item.category}
                                    className="bg-muted/20 rounded-xl p-5 border border-border/30 space-y-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-foreground capitalize">
                                            {item.category.replace('-', ' ')}
                                        </h3>
                                        <CompetitionBadge level={item.competition} />
                                    </div>

                                    <p className="text-sm text-foreground/80 leading-relaxed">
                                        {item.summary}
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                                <TrendingUp className="w-4 h-4" />
                                                Key Trends
                                            </div>
                                            <ul className="space-y-1.5">
                                                {item.keyTrends.map((trend, i) => (
                                                    <li key={i} className="text-sm text-foreground/70 flex items-start gap-2">
                                                        <span className="text-primary mt-1">•</span>
                                                        <span>{trend}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                                <Users className="w-4 h-4" />
                                                Market Size
                                            </div>
                                            <p className="text-sm text-foreground/70">
                                                {item.marketSize}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            No preview data available
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border/50 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg hover:bg-muted/30 text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onContinue}
                        disabled={isLoading || !preview}
                        className={cn(
                            'px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2',
                            preview && !isLoading
                                ? 'bg-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20'
                                : 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                        )}
                    >
                        Continue with Full Research
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
