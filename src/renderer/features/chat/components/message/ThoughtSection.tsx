import { Brain, Sparkles } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface ThoughtSectionProps {
    thought: string | null;
    initiallyExpanded?: boolean;
    segmentIndex?: number;
    isStreaming?: boolean;
    t: TranslationFn;
}

/**
 * ThoughtSection component
 * 
 * Displays the AI's internal reasoning/thoughts (the <think> tag content).
 * Includes a collapsible toggle and premium styling with animations.
 */
export const ThoughtSection = memo(
    ({
        thought,
        initiallyExpanded = false,
        segmentIndex,
        isStreaming = false,
        t,
    }: ThoughtSectionProps) => {
        const [isThoughtExpanded, setIsThoughtExpanded] = useState(initiallyExpanded);
        const title = typeof segmentIndex === 'number'
            ? t('workspaceAgent.thoughtStep', { index: segmentIndex + 1 })
            : t('messageBubble.showThought');

        // Auto-expand if the prop changes to true (e.g. during streaming)
        useEffect(() => {
            if (initiallyExpanded) {
                const rafId = requestAnimationFrame(() => {
                    setIsThoughtExpanded(true);
                });
                return () => cancelAnimationFrame(rafId);
            }
            return undefined;
        }, [initiallyExpanded]);

        if (!thought) {
            return null;
        }
        return (
            <div className="w-full mb-3">
                <button
                    onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
                    className={cn(
                        'flex items-center gap-2 group/thought transition-all duration-300',
                        isThoughtExpanded ? 'mb-2' : 'mb-0'
                    )}
                >
                    <div
                        className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 select-none',
                            isThoughtExpanded
                                ? 'bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/10'
                                : 'bg-accent/30 border-border/50 text-muted-foreground/60 hover:bg-accent/50 hover:border-border hover:text-primary/70'
                        )}
                    >
                        <div
                            className={cn(
                                'p-1 rounded-full',
                                isThoughtExpanded ? 'bg-primary/20' : 'bg-accent/30'
                            )}
                        >
                            <Brain
                                className={cn(
                                    'w-3.5 h-3.5',
                                    isThoughtExpanded ? 'animate-pulse' : ''
                                )}
                            />
                        </div>
                        <span className="text-xxs font-bold">{title}</span>
                        <Sparkles
                            className={cn(
                                'w-3 h-3 transition-opacity duration-300',
                                isStreaming || isThoughtExpanded ? 'opacity-100' : 'opacity-0'
                            )}
                        />
                        <span
                            className={cn(
                                'text-xxxs transition-transform duration-300 ms-1',
                                isThoughtExpanded ? 'rotate-180' : 'rotate-0'
                            )}
                        >
                            ▼
                        </span>
                    </div>
                </button>
                {isThoughtExpanded && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="relative ps-4 border-s-2 border-primary/20 py-1">
                            <div className="absolute -start-0.5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent" />
                            <div className="bg-gradient-to-br from-primary/[0.03] to-transparent rounded-2xl p-4 border border-border/20">
                                <div className="whitespace-pre-wrap font-mono text-xxs leading-relaxed text-muted-foreground/80 selection:bg-primary/20 drop-shadow-sm">
                                    {thought}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
);

ThoughtSection.displayName = 'ThoughtSection';
