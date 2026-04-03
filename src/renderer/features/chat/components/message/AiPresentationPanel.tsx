import { AiPresentationMetadata } from '@shared/types/ai-runtime';
import { Bookmark, Brain, Code2, Eye, RotateCcw } from 'lucide-react';
import { memo } from 'react';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

interface AiPresentationPanelProps {
    presentation: AiPresentationMetadata | null;
    t: TranslationFn;
}

export const AiPresentationPanel = memo(
    ({ presentation, t }: AiPresentationPanelProps) => {
        if (!presentation) {
            return null;
        }

        const hasSignals = presentation.hasReasoning
            || presentation.toolCallCount > 0
            || presentation.toolResultCount > 0
            || presentation.sourceCount > 0
            || presentation.imageCount > 0
            || typeof presentation.evidenceSummary === 'string';
        if (!hasSignals) {
            return null;
        }

        const metricItems = [
            presentation.toolCallCount > 0
                ? { icon: Code2, value: presentation.toolCallCount }
                : null,
            presentation.sourceCount > 0
                ? { icon: Bookmark, value: presentation.sourceCount }
                : null,
            presentation.imageCount > 0
                ? { icon: Eye, value: presentation.imageCount }
                : null,
            presentation.reusedToolResultCount > 0
                ? { icon: RotateCcw, value: presentation.reusedToolResultCount }
                : null,
        ].filter((item): item is { icon: typeof Code2; value: number } => item !== null);

        return (
            <div className="w-full mb-3 rounded-2xl border border-border/40 bg-background/60 px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Brain className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xxs font-bold tracking-wide text-muted-foreground/80 uppercase">
                        {t('workspaceAgent.reasoningTitle')}
                    </span>
                </div>
                {metricItems.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                        {metricItems.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={`${item.value}-${index}`}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-accent/30 px-2.5 py-1 text-xxs font-semibold text-muted-foreground/80"
                                >
                                    <Icon className="w-3 h-3" />
                                    <span>{item.value}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
                {presentation.reasoningSummary && (
                    <div className="text-xxs leading-relaxed text-muted-foreground/80 whitespace-pre-wrap">
                        {presentation.reasoningSummary}
                    </div>
                )}
                {presentation.evidenceSummary && (
                    <div className="mt-2 text-xxs leading-relaxed text-muted-foreground/65 whitespace-pre-wrap">
                        {presentation.evidenceSummary}
                    </div>
                )}
            </div>
        );
    }
);

AiPresentationPanel.displayName = 'AiPresentationPanel';
