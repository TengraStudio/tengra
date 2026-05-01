/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCalendar } from '@tabler/icons-react';
import React from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n';

interface CodexLimitsSectionProps {
    codexLimits?: {
        daily?: { enabled: boolean; percentage: number };
        weekly?: { enabled: boolean; percentage: number };
    };
    updateCodexLimit: (
        period: 'daily' | 'weekly',
        field: 'enabled' | 'percentage',
        value: boolean | number
    ) => void;
}

export const CodexLimitsSection: React.FC<CodexLimitsSectionProps> = ({
    codexLimits,
    updateCodexLimit,
}) => {
    const { t } = useTranslation();
    return (
        <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-success/10 text-success">
                    <IconCalendar className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-foreground">
                        {t('frontend.settings.usageLimits.codex.title')}
                    </h3>
                    <p className="typo-caption text-muted-foreground mt-0.5">
                        {t('frontend.settings.usageLimits.codex.description')}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {(['daily', 'weekly'] as const).map(period => {
                    const periodLimit = codexLimits?.[period] ?? { enabled: false, percentage: 50 };
                    const periodLabel = t(`settings.usageLimits.periods.${period}`);

                    return (
                        <div
                            key={period}
                            className="rounded-xl bg-muted/20 border border-border/40 p-5 transition-all hover:bg-muted/30"
                        >
                            <div className="flex items-center justify-between gap-4 mb-1">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-foreground">
                                        {t('frontend.settings.usageLimits.limitLabel', {
                                            period: periodLabel,
                                        })}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-0.5 font-medium opacity-60">
                                        {period} interval
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 px-2 py-1 rounded-full bg-background/50 border border-border/50 self-start">
                                    <span className="typo-body font-bold text-muted-foreground/80">
                                        {t('frontend.settings.usageLimits.enable')}
                                    </span>
                                    <Switch
                                        checked={periodLimit.enabled}
                                        onCheckedChange={checked =>
                                            updateCodexLimit(period, 'enabled', checked)
                                        }
                                        className="scale-90"
                                    />
                                </div>
                            </div>

                            {periodLimit.enabled && (
                                <div className="mt-5 pt-4 border-t border-border/40 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="text-sm font-bold text-muted-foreground/70 ml-1">
                                        {t('frontend.settings.usageLimits.maxPercentQuota')}
                                    </label>
                                    <div className="relative group">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={periodLimit.percentage}
                                            onChange={e =>
                                                updateCodexLimit(
                                                    period,
                                                    'percentage',
                                                    Number.parseInt(e.target.value, 10) || 0
                                                )
                                            }
                                            className="bg-background/50 border-border/50 h-10 font-mono text-sm pr-10 focus:ring-success/20"
                                            placeholder={t('frontend.settings.usageLimits.maxPercentPlaceholder')}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 font-bold typo-caption">
                                            %
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
