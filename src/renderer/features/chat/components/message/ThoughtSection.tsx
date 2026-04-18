/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Brain, Sparkles } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

/* Batch-02: Extracted Long Classes */
const C_THOUGHTSECTION_1 = "whitespace-pre-wrap font-mono text-xxs leading-relaxed text-muted-foreground/80 selection:bg-primary/20 drop-shadow-sm max-h-72 overflow-y-auto pe-2";


type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface ThoughtSectionProps {
    thought: string | null;
    thoughtDurationMs?: number;
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
        thoughtDurationMs,
        initiallyExpanded = false,
        segmentIndex,
        isStreaming = false,
        t,
    }: ThoughtSectionProps) => {
        const [isThoughtExpanded, setIsThoughtExpanded] = useState(initiallyExpanded);
        const baseTitle = typeof segmentIndex === 'number'
            ? t('workspaceAgent.thoughtStep', { index: segmentIndex + 1 })
            : t('messageBubble.showThought');
        const title = typeof thoughtDurationMs === 'number' && Number.isFinite(thoughtDurationMs)
            ? `${baseTitle} • ${(thoughtDurationMs / 1000).toFixed(1)}${t('messageBubble.secondsShort')}`
            : baseTitle;

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

        useEffect(() => {
            const thoughtLength = typeof thought === 'string' ? thought.trim().length : 0;
            appLogger.info(
                'ThoughtSection',
                `render segment=${segmentIndex ?? -1}, thoughtLen=${thoughtLength}, initiallyExpanded=${String(initiallyExpanded)}, expanded=${String(isThoughtExpanded)}, streaming=${String(isStreaming)}`
            );
        }, [segmentIndex, thought, initiallyExpanded, isThoughtExpanded, isStreaming]);

        if (!thought || thought.trim().length === 0) {
            appLogger.info(
                'ThoughtSection',
                `skip-empty segment=${segmentIndex ?? -1}, streaming=${String(isStreaming)}`
            );
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
                            'flex items-center gap-2 px-1.5 py-1 rounded-md border border-transparent transition-all duration-300 select-none',
                            isThoughtExpanded
                                ? 'text-primary'
                                : 'text-muted-foreground/70 hover:text-primary/70'
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
                            <div className="rounded-2xl p-2 border border-border/20 bg-transparent">
                                <div className={C_THOUGHTSECTION_1}>
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
