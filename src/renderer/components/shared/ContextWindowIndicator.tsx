import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import './context-window-indicator.css';

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
            ? 'tengra-context-indicator__fill--danger'
            : percentage > 50
              ? 'tengra-context-indicator__fill--warning'
              : 'tengra-context-indicator__fill--success';

    const formatNumber = (n: number): string => n.toLocaleString();

    return (
        <div className="tengra-context-indicator">
            <div className="tengra-context-indicator__header">
                <span className="tengra-context-indicator__model">{modelName}</span>
                <span>
                    {t('contextWindow.usage', {
                        used: formatNumber(usedTokens),
                        max: formatNumber(maxTokens),
                        percentage: roundedPercentage,
                    })}
                </span>
            </div>
            <div className="tengra-context-indicator__bar">
                <div
                    className={cn('tengra-context-indicator__fill', colorClass)}
                    style={{ width: `${roundedPercentage}%` }}
                />
            </div>
        </div>
    );
};

export default ContextWindowIndicator;
