import { TrendingUp } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { AppSettings } from '@/types/settings';

import { CopilotLimitItem } from './CopilotLimitItem';

interface CopilotLimitsSectionProps {
    copilotLimits?: NonNullable<AppSettings['modelUsageLimits']>['copilot']
    copilotRemaining: number
    copilotLimit: number
    updateCopilotLimit: (period: 'hourly' | 'daily' | 'weekly', field: 'enabled' | 'type' | 'value', value: boolean | string | number) => void
}

export const CopilotLimitsSection: React.FC<CopilotLimitsSectionProps> = ({
    copilotLimits,
    copilotRemaining,
    copilotLimit,
    updateCopilotLimit
}) => {
    const { t } = useTranslation();
    return (
        <div className="bg-card p-6 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold uppercase text-muted-foreground">{t('settings.usageLimits.copilot.title')}</h3>
            </div>
            <div className="text-xs text-muted-foreground mb-4">
                {t('settings.usageLimits.copilot.current', { remaining: copilotRemaining, limit: copilotLimit })}
            </div>

            {(['hourly', 'daily', 'weekly'] as const).map((period) => {
                const periodLimit = copilotLimits?.[period] ?? { enabled: false, type: 'requests' as const, value: 0 };
                return (
                    <CopilotLimitItem
                        key={period}
                        period={period}
                        periodLimit={periodLimit}
                        copilotRemaining={copilotRemaining}
                        updateCopilotLimit={updateCopilotLimit}
                    />
                );
            })}
        </div>
    );
};
