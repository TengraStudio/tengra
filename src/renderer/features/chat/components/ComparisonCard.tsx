/**
 * ComparisonCard - Individual model response card for A/B comparison.
 * Shows model name, response content, metrics, copy and rating buttons.
 */

import { Check, Copy, ThumbsDown, ThumbsUp } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';

import type { ComparisonResult } from '../hooks/useModelComparison';

import { MarkdownRenderer } from './MarkdownRenderer';

interface ComparisonCardProps {
    result: ComparisonResult;
    rating: 1 | -1 | 0;
    onRate: (modelKey: string, rating: 1 | -1) => void;
}

/** Renders a single model's comparison response with metrics and actions. */
export const ComparisonCard: React.FC<ComparisonCardProps> = React.memo(({ result, rating, onRate }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const modelKey = `${result.provider}:${result.model}`;

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(result.content).catch(() => { /* clipboard unavailable */ });
        setCopied(true);
        const timer = window.setTimeout(() => { setCopied(false); }, 2000);
        return () => { window.clearTimeout(timer); };
    }, [result.content]);

    const handleCopyClick = useCallback(() => {
        void handleCopy();
    }, [handleCopy]);

    return (
        <Card className="flex flex-col border border-border/50 hover:border-border transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{result.model}</span>
                    <span className="typo-caption px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {result.provider}
                    </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleCopyClick} title={t('modelComparison.copyResponse')}>
                    {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
            </div>

            {/* Response content */}
            <div className="flex-1 px-4 py-3 overflow-y-auto max-h-96 text-sm">
                {result.error ? (
                    <p className="text-destructive">{result.error}</p>
                ) : (
                    <MarkdownRenderer content={result.content} />
                )}
            </div>

            {/* Metrics footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/30">
                <div className="flex items-center gap-4 typo-caption text-muted-foreground">
                    <span>{t('modelComparison.responseTime')}: {result.responseTime}ms</span>
                    <span>{t('modelComparison.tokenCount')}: {result.tokenCount}</span>
                    <span>{t('modelComparison.tokensPerSecond')}: {result.tokensPerSecond}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => { onRate(modelKey, 1); }}
                        className={rating === 1 ? 'text-success' : 'text-muted-foreground'}
                    >
                        <ThumbsUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => { onRate(modelKey, -1); }}
                        className={rating === -1 ? 'text-destructive' : 'text-muted-foreground'}
                    >
                        <ThumbsDown className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </Card>
    );
});

ComparisonCard.displayName = 'ComparisonCard';
