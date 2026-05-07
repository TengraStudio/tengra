/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';


/** Props for the ContextWindowIndicator component */
interface ContextWindowIndicatorProps {
    /** Number of tokens currently used */
    usedTokens: number
    /** Maximum tokens allowed by the model's context window */
    maxTokens: number
    /** Name of the active model */
    modelName: string
}

/**
 * Displays a horizontal bar indicating context window token usage
 * with color coding: green (<50%), yellow (50-80%), red (>80%).
 */
const ContextWindowIndicator: React.FC<ContextWindowIndicatorProps> = ({
    usedTokens,
    maxTokens,
    modelName,
}) => {
    const { t } = useTranslation();

    const percentage = maxTokens > 0 ? Math.min((usedTokens / maxTokens) * 100, 100) : 0;
    const roundedPercentage = Math.round(percentage);

    const colorClass =
        percentage > 80
            ? 'bg-destructive shadow-glow-destructive animate-pulse'
            : percentage > 50
              ? 'bg-warning shadow-glow-warning'
              : 'bg-primary shadow-glow-primary-subtle';

    const formatNumber = (n: number): string => n.toLocaleString();

    return (
        <div className="flex flex-col gap-1.5 w-full max-w-sm px-1 font-sans">
            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground ">
                <span className="font-semibold text-foreground/80 truncate pr-2" title={modelName}>{modelName}</span>
                <span className="whitespace-nowrap tabular-nums text-foreground/70">
                    {t('frontend.contextWindow.usage', {
                        used: formatNumber(usedTokens),
                        max: formatNumber(maxTokens),
                        percentage: roundedPercentage,
                    })}
                </span>
            </div>
            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden border border-border/20 shadow-inner">
                <div
                    className={cn('h-full rounded-full transition-all duration-500 ease-out', colorClass)}
                    style={{ width: `${roundedPercentage}%` }}
                />
            </div>
        </div>
    );
};

export default ContextWindowIndicator;

