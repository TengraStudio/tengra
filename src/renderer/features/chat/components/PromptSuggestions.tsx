/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertTriangle, IconBolt,IconBulb, IconChevronDown, IconChevronUp, IconCircleCheck, IconInfoCircle, IconSparkles, IconX } from '@tabler/icons-react';
import React, { useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import type { PromptAnalysis, PromptSuggestion, PromptSuggestionType } from '../utils/prompt-optimizer';

interface PromptSuggestionsProps {
    analysis: PromptAnalysis | null;
    isAnalyzing: boolean;
    onApplySuggestion: (text: string) => void;
    onDismiss: (index: number) => void;
}

const TYPE_ICONS: Record<PromptSuggestionType, React.ReactNode> = {
    clarity: <IconBulb className="w-3.5 h-3.5" />,
    specificity: <IconBolt className="w-3.5 h-3.5" />,
    structure: <IconInfoCircle className="w-3.5 h-3.5" />,
    context: <IconSparkles className="w-3.5 h-3.5" />,
    constraint: <IconAlertTriangle className="w-3.5 h-3.5" />,
    format: <IconCircleCheck className="w-3.5 h-3.5" />,
};

const SEVERITY_STYLES: Record<string, string> = {
    warning: 'text-warning',
    improvement: 'text-info',
    info: 'text-muted-foreground',
};

/** Returns a CSS class for the score badge based on the value. */
function getScoreColor(score: number): string {
    if (score >= 75) {return 'text-success bg-success/10';}
    if (score >= 50) {return 'text-warning bg-warning/10';}
    return 'text-destructive bg-destructive/10';
}

/** Single suggestion row with apply/dismiss actions. */
const SuggestionItem: React.FC<{
    suggestion: PromptSuggestion;
    index: number;
    onApply: (text: string) => void;
    onDismiss: (index: number) => void;
    t: (key: string) => string;
}> = ({ suggestion, index, onApply, onDismiss, t }) => (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50">
        <span className={cn('mt-0.5 shrink-0', SEVERITY_STYLES[suggestion.severity])}>
            {TYPE_ICONS[suggestion.type]}
        </span>
        <span className="typo-caption text-muted-foreground flex-1 leading-relaxed">
            {suggestion.message}
        </span>
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {suggestion.suggestedText && (
                <button
                    onClick={() => onApply(suggestion.suggestedText as string)}
                    className="text-sm px-1.5 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
                >
                    {t('frontend.promptOptimizer.apply')}
                </button>
            )}
            <button
                onClick={() => onDismiss(index)}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent"
                aria-label={t('frontend.promptOptimizer.dismiss')}
            >
                <IconX className="w-3 h-3" />
            </button>
        </div>
    </div>
);

/**
 * Collapsible panel displaying prompt analysis results and improvement suggestions.
 * Shown below the chat input area when analysis is available.
 */
export const PromptSuggestions: React.FC<PromptSuggestionsProps> = React.memo(({
    analysis,
    isAnalyzing,
    onApplySuggestion,
    onDismiss,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(true);

    if (!analysis && !isAnalyzing) {return null;}

    if (isAnalyzing) {
        return (
            <div className="px-3 py-2 typo-caption text-muted-foreground/60 animate-pulse">
                {t('frontend.promptOptimizer.analyzing')}
            </div>
        );
    }

    if (!analysis) {return null;}

    const hasSuggestions = analysis.suggestions.length > 0;

    return (
        <div className="border-t border-border/50 bg-background/50">
            <button
                onClick={() => setIsExpanded(prev => !prev)}
                className="flex w-full items-center gap-2 px-3 py-1.5 typo-caption transition-colors hover:bg-accent/50"
            >
                <span className={cn('px-1.5 py-0.5 rounded text-sm font-semibold', getScoreColor(analysis.score))}>
                    {analysis.score}
                </span>
                <span className="text-muted-foreground font-medium">
                    {t('frontend.promptOptimizer.title')}
                </span>
                <span className="text-muted-foreground/50 ml-auto">
                    {hasSuggestions
                        ? `${analysis.suggestions.length} ${t('frontend.promptOptimizer.suggestions').toLowerCase()}`
                        : t('frontend.promptOptimizer.noSuggestions')}
                </span>
                {isExpanded
                    ? <IconChevronUp className="w-3.5 h-3.5 text-muted-foreground/50" />
                    : <IconChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />}
            </button>

            {isExpanded && hasSuggestions && (
                <div className="px-2 pb-2 space-y-0.5 max-h-40 overflow-y-auto">
                    {analysis.suggestions.map((suggestion, index) => (
                        <SuggestionItem
                            key={`${suggestion.type}-${index}`}
                            suggestion={suggestion}
                            index={index}
                            onApply={onApplySuggestion}
                            onDismiss={onDismiss}
                            t={t}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

PromptSuggestions.displayName = 'PromptSuggestions';

