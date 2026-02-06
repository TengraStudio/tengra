import { Calendar, Clock, Hash, Percent, TrendingUp } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface CopilotLimitItemProps {
    period: 'hourly' | 'daily' | 'weekly'
    periodLimit: { enabled: boolean; type: 'requests' | 'percentage'; value: number }
    copilotRemaining: number
    updateCopilotLimit: (period: 'hourly' | 'daily' | 'weekly', field: 'enabled' | 'type' | 'value', value: boolean | string | number) => void
}

export const CopilotLimitItem: React.FC<CopilotLimitItemProps> = ({
    period, periodLimit, copilotRemaining, updateCopilotLimit
}) => {
    const { t } = useTranslation();
    const periodLabel = t(`settings.usageLimits.periods.${period}`);
    const Icon = period === 'hourly' ? Clock : period === 'daily' ? Calendar : TrendingUp;

    return (
        <div key={period} className="mb-4 p-4 bg-muted/10 rounded-lg border border-border/50">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <label className="text-sm font-bold">{t('settings.usageLimits.limitLabel', { period: periodLabel })}</label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={periodLimit.enabled}
                        onChange={(e) => updateCopilotLimit(period, 'enabled', e.target.checked)}
                        className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-xs text-muted-foreground">{t('settings.usageLimits.enable')}</span>
                </label>
            </div>

            {periodLimit.enabled && (
                <div className="space-y-3 mt-3">
                    <div className="flex items-center gap-3">
                        <label className="text-xs text-muted-foreground">{t('settings.usageLimits.typeLabel')}</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => updateCopilotLimit(period, 'type', 'requests')}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all",
                                    periodLimit.type === 'requests'
                                        ? "bg-primary/20 border-primary text-primary"
                                        : "bg-muted/20 border-border text-muted-foreground"
                                )}
                            >
                                <Hash className="w-3 h-3 inline mr-1" />
                                {t('settings.usageLimits.types.requests')}
                            </button>
                            <button
                                onClick={() => updateCopilotLimit(period, 'type', 'percentage')}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all",
                                    periodLimit.type === 'percentage'
                                        ? "bg-primary/20 border-primary text-primary"
                                        : "bg-muted/20 border-border text-muted-foreground"
                                )}
                            >
                                <Percent className="w-3 h-3 inline mr-1" />
                                {t('settings.usageLimits.types.percentage')}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                            {periodLimit.type === 'requests' ? t('settings.usageLimits.maxRequests') : t('settings.usageLimits.maxPercentage')}
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={periodLimit.type === 'percentage' ? 100 : undefined}
                            value={periodLimit.value}
                            onChange={(e) => updateCopilotLimit(period, 'value', Number.parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-sm"
                            placeholder={periodLimit.type === 'requests' ? t('settings.usageLimits.maxRequestsPlaceholder') : t('settings.usageLimits.maxPercentagePlaceholder')}
                        />
                        {periodLimit.type === 'percentage' && (
                            <div className="text-xs text-muted-foreground mt-1">
                                {t('settings.usageLimits.percentHint', {
                                    count: Math.round(copilotRemaining * (periodLimit.value / 100)),
                                    percentage: periodLimit.value,
                                    remaining: copilotRemaining
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
