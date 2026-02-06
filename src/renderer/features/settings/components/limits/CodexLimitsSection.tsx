import { Calendar } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';

interface CodexLimitsSectionProps {
    codexLimits?: {
        daily?: { enabled: boolean; percentage: number }
        weekly?: { enabled: boolean; percentage: number }
    }
    updateCodexLimit: (period: 'daily' | 'weekly', field: 'enabled' | 'percentage', value: boolean | number) => void
}

export const CodexLimitsSection: React.FC<CodexLimitsSectionProps> = ({
    codexLimits,
    updateCodexLimit
}) => {
    const { t } = useTranslation();
    return (
        <div className="bg-card p-6 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-success" />
                <h3 className="text-sm font-bold uppercase text-muted-foreground">{t('settings.usageLimits.codex.title')}</h3>
            </div>
            <div className="text-xs text-muted-foreground mb-4">
                {t('settings.usageLimits.codex.description')}
            </div>

            {(['daily', 'weekly'] as const).map((period) => {
                const periodLimit = codexLimits?.[period] ?? { enabled: false, percentage: 50 };
                const periodLabel = t(`settings.usageLimits.periods.${period}`);

                return (
                    <div key={period} className="mb-4 p-4 bg-muted/10 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <label className="text-sm font-bold">{t('settings.usageLimits.limitLabel', { period: periodLabel })}</label>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={periodLimit.enabled}
                                    onChange={(e) => updateCodexLimit(period, 'enabled', e.target.checked)}
                                    className="w-4 h-4 rounded border-border"
                                />
                                <span className="text-xs text-muted-foreground">{t('settings.usageLimits.enable')}</span>
                            </label>
                        </div>

                        {periodLimit.enabled && (
                            <div className="mt-3">
                                <label className="text-xs text-muted-foreground block mb-1">
                                    {t('settings.usageLimits.maxPercentQuota')}
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={periodLimit.percentage}
                                    onChange={(e) => updateCodexLimit(period, 'percentage', Number.parseInt(e.target.value, 10) || 0)}
                                    className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-sm"
                                    placeholder={t('settings.usageLimits.maxPercentPlaceholder')}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
