/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCalendar, IconClock, IconHash, IconPercentage, IconTrendingUp } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface CopilotLimitItemProps {
    period: 'hourly' | 'daily' | 'weekly';
    periodLimit: { enabled: boolean; type: 'requests' | 'percentage'; value: number };
    copilotRemaining: number;
    updateCopilotLimit: (
        period: 'hourly' | 'daily' | 'weekly',
        field: 'enabled' | 'type' | 'value',
        value: boolean | string | number
    ) => void;
}

export const CopilotLimitItem: React.FC<CopilotLimitItemProps> = ({
    period,
    periodLimit,
    copilotRemaining,
    updateCopilotLimit,
}) => {
    const { t } = useTranslation();
    const periodLabel = t(`settings.usageLimits.periods.${period}`);
    const Icon = period === 'hourly' ? IconClock : period === 'daily' ? IconCalendar : IconTrendingUp;

    return (
        <div
            key={period}
            className="group mb-4 p-5 bg-muted/20 rounded-xl border border-border/40 transition-all hover:bg-muted/30"
        >
            <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-foreground">
                            {t('settings.usageLimits.limitLabel', { period: periodLabel })}
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5 font-medium opacity-60">
                            {period} interval
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 px-2 py-1 rounded-full bg-background/50 border border-border/50">
                    <span className="typo-body font-bold text-muted-foreground/80">
                        {t('settings.usageLimits.enable')}
                    </span>
                    <Switch
                        checked={periodLimit.enabled}
                        onCheckedChange={checked => updateCopilotLimit(period, 'enabled', checked)}
                        className="scale-90"
                    />
                </div>
            </div>

            {periodLimit.enabled && (
                <div className="space-y-4 mt-4 pt-4 border-t border-border/40 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground/70 ml-1">
                            {t('settings.usageLimits.typeLabel')}
                        </label>
                        <div className="flex gap-2 p-1 rounded-lg bg-muted/30 border border-border/20 w-fit">
                            <Button
                                variant={periodLimit.type === 'requests' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => updateCopilotLimit(period, 'type', 'requests')}
                                className={cn(
                                    'h-8 rounded-md px-3 typo-caption font-bold transition-all',
                                    periodLimit.type === 'requests'
                                        ? 'shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <IconHash className="w-3 h-3 mr-1.5" />
                                {t('settings.usageLimits.types.requests')}
                            </Button>
                            <Button
                                variant={periodLimit.type === 'percentage' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => updateCopilotLimit(period, 'type', 'percentage')}
                                className={cn(
                                    'h-8 rounded-md px-3 typo-caption font-bold transition-all',
                                    periodLimit.type === 'percentage'
                                        ? 'shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <IconPercentage className="w-3 h-3 mr-1.5" />
                                {t('settings.usageLimits.types.percentage')}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground/70 ml-1">
                            {periodLimit.type === 'requests'
                                ? t('settings.usageLimits.maxRequests')
                                : t('settings.usageLimits.maxPercentage')}
                        </label>
                        <div className="relative">
                            <Input
                                type="number"
                                min={0}
                                max={periodLimit.type === 'percentage' ? 100 : undefined}
                                value={periodLimit.value}
                                onChange={e =>
                                    updateCopilotLimit(
                                        period,
                                        'value',
                                        Number.parseInt(e.target.value, 10) || 0
                                    )
                                }
                                className="bg-background/50 border-border/50 h-10 font-mono text-sm pr-10 focus:ring-primary/20"
                                placeholder={
                                    periodLimit.type === 'requests'
                                        ? t('settings.usageLimits.maxRequestsPlaceholder')
                                        : t('settings.usageLimits.maxPercentagePlaceholder')
                                }
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 font-bold typo-caption">
                                {periodLimit.type === 'requests' ? 'REQ' : '%'}
                            </div>
                        </div>
                        {periodLimit.type === 'percentage' && (
                            <div className="typo-body text-muted-foreground/70 mt-1.5 px-1 font-medium bg-muted/30 py-1.5 rounded-md border border-border/20">
                                ✨{' '}
                                {t('settings.usageLimits.percentHint', {
                                    count: Math.round(copilotRemaining * (periodLimit.value / 100)),
                                    percentage: periodLimit.value,
                                    remaining: copilotRemaining,
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
