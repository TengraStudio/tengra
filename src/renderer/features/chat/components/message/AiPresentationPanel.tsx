import { AiPresentationMetadata } from '@shared/types/ai-runtime';
import { Bookmark, Brain, ChevronDown, Code2, Eye, RotateCcw, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

interface AiPresentationPanelProps {
    presentation: AiPresentationMetadata | null;
    t: TranslationFn;
}

const ReasoningSegment = ({
    segment,
    index,
    isLast,
    isStreaming,
    t
}: {
    segment: string;
    index: number;
    isLast: boolean;
    isStreaming: boolean;
    t: TranslationFn;
}) => {
    const [isOpen, setIsOpen] = useState(isLast); // Default open for the most recent one

    const toggleOpen = () => setIsOpen(!isOpen);

    return (
        <div className="group mb-2 last:mb-0 overflow-hidden rounded-xl border border-border/30 bg-accent/5 transition-all hover:bg-accent/10">
            <button
                onClick={toggleOpen}
                className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20">
                        {isLast && isStreaming ? (
                            <Sparkles className="h-3 w-3 animate-pulse" />
                        ) : (
                            <Brain className="h-3 w-3" />
                        )}
                    </div>
                    <span className="text-xxs font-semibold tracking-tight text-foreground/80 lowercase italic first-letter:uppercase">
                        {t('workspaceAgent.thoughtStep', { index: index + 1 })}
                        {isLast && isStreaming && " ..."}
                    </span>
                </div>
                <ChevronDown
                    className={`h-3 w-3 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="px-3 pb-3 pt-1">
                    <div className="text-xxs leading-relaxed text-muted-foreground/80 whitespace-pre-wrap selection:bg-primary/20">
                        {segment}
                    </div>
                </div>
            )}
        </div>
    );
};

export const AiPresentationPanel = memo(
    ({ presentation, t }: AiPresentationPanelProps) => {
        if (!presentation) {
            return null;
        }

        const hasSignals = presentation.hasReasoning
            || presentation.toolCallCount > 0
            || presentation.toolResultCount > 0
            || presentation.sourceCount > 0
            || presentation.imageCount > 0;
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

        const reasoningSegments = presentation.reasoningSegments ?? [];

        return (
            <div className="w-full mb-4 rounded-2xl border border-border/40 bg-background/60 p-4 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Brain className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xxs font-bold tracking-wider text-muted-foreground/90 uppercase">
                            {t('workspaceAgent.reasoningTitle')}
                        </span>
                    </div>

                    {presentation.isStreaming && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="typo-body font-medium text-primary/80 lowercase italic">
                                Thinking...
                            </span>
                        </div>
                    )}
                </div>

                {reasoningSegments.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {reasoningSegments.map((segment, index) => (
                            <ReasoningSegment
                                key={`reasoning-${index}-${segment.slice(0, 20)}`}
                                segment={segment}
                                index={index}
                                isLast={index === reasoningSegments.length - 1}
                                isStreaming={presentation.isStreaming}
                                t={t}
                            />
                        ))}
                    </div>
                )}

                {metricItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/20">
                        {metricItems.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={`${item.value}-${index}`}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 bg-accent/20 px-2 py-1 text-xxs font-medium text-muted-foreground/70"
                                >
                                    <Icon className="w-3 h-3" />
                                    <span>{item.value}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }
);

AiPresentationPanel.displayName = 'AiPresentationPanel';
