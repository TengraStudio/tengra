/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconTrendingUp } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { AppSettings } from '@/types/settings';

import { CopilotLimitItem } from './CopilotLimitItem';

interface CopilotLimitsSectionProps {
    copilotLimits?: NonNullable<AppSettings['modelUsageLimits']>['copilot'];
    copilotRemaining: number;
    copilotLimit: number;
    updateCopilotLimit: (
        period: 'hourly' | 'daily' | 'weekly',
        field: 'enabled' | 'type' | 'value',
        value: boolean | string | number
    ) => void;
}

export const CopilotLimitsSection: React.FC<CopilotLimitsSectionProps> = ({
    copilotLimits,
    copilotRemaining,
    copilotLimit,
    updateCopilotLimit,
}) => {
    const { t } = useTranslation();
    return (
        <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <IconTrendingUp className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-foreground">
                        {t('frontend.settings.usageLimits.copilot.title')}
                    </h3>
                    <p className="typo-caption text-muted-foreground mt-0.5">
                        {t('frontend.settings.usageLimits.copilot.current', {
                            remaining: copilotRemaining,
                            limit: copilotLimit,
                        })}
                    </p>
                </div>
            </div>

            <div className="space-y-1">
                {(['hourly', 'daily', 'weekly'] as const).map(period => {
                    const periodLimit = copilotLimits?.[period] ?? {
                        enabled: false,
                        type: 'requests' as const,
                        value: 0,
                    };
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
        </div>
    );
};
