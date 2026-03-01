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

    const barColor =
        percentage > 80
            ? 'bg-red-500'
            : percentage > 50
              ? 'bg-yellow-500'
              : 'bg-green-500';

    const formatNumber = (n: number): string => n.toLocaleString();

    return (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">{modelName}</span>
                <span>
                    {t('contextWindow.usage', {
                        used: formatNumber(usedTokens),
                        max: formatNumber(maxTokens),
                        percentage: roundedPercentage,
                    })}
                </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                    className={cn('h-full rounded-full transition-all duration-300', barColor)}
                    style={{ width: `${roundedPercentage}%` }}
                />
            </div>
        </div>
    );
};

export default ContextWindowIndicator;
