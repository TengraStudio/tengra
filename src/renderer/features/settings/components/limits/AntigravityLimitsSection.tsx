/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Input } from '@renderer/components/ui/input';
import { Switch } from '@renderer/components/ui/switch';
import { Percent } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import type { ModelInfo } from '@/types';

interface AntigravityLimitsSectionProps {
    antigravityModels: ModelInfo[];
    antigravityLimits: Record<string, { enabled: boolean; percentage: number }> | undefined;
    updateAntigravityLimit: (modelId: string, enabled: boolean, percentage: number) => void;
}

export const AntigravityLimitsSection: React.FC<AntigravityLimitsSectionProps> = ({
    antigravityModels,
    antigravityLimits,
    updateAntigravityLimit,
}) => {
    const { t } = useTranslation();
    return (
        <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Percent className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-foreground">
                        {t('settings.usageLimits.antigravity.title')}
                    </h3>
                    <p className="typo-caption text-muted-foreground mt-0.5">
                        {t('settings.usageLimits.antigravity.description')}
                    </p>
                </div>
            </div>

            <div className="space-y-3 max-h-400 overflow-y-auto pr-2 custom-scrollbar">
                {antigravityModels.map(model => {
                    const modelId = model.id ?? '';
                    const modelLimit = antigravityLimits?.[modelId] ?? {
                        enabled: false,
                        percentage: 50,
                    };

                    return (
                        <div
                            key={modelId}
                            className="rounded-xl bg-muted/20 border border-border/40 p-4 transition-all hover:bg-muted/30"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-foreground truncate">
                                        {model.name ?? modelId}
                                    </div>
                                    <div className="text-xxs text-muted-foreground mt-0.5 font-medium opacity-60">
                                        ID: {modelId}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 px-2 py-1 rounded-full bg-background/50 border border-border/50">
                                    <span className="typo-body font-bold text-muted-foreground/80">
                                        {t('settings.usageLimits.enable')}
                                    </span>
                                    <Switch
                                        checked={modelLimit.enabled}
                                        onCheckedChange={checked =>
                                            modelId &&
                                            updateAntigravityLimit(modelId, checked, modelLimit.percentage)
                                        }
                                        className="scale-90"
                                    />
                                </div>
                            </div>

                            {modelLimit.enabled && (
                                <div className="mt-4 pt-4 border-t border-border/40 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="text-xxs font-bold text-muted-foreground/70 ml-1">
                                        {t('settings.usageLimits.maxPercentQuota')}
                                    </label>
                                    <div className="relative group">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={modelLimit.percentage}
                                            onChange={e =>
                                                modelId &&
                                                updateAntigravityLimit(
                                                    modelId,
                                                    true,
                                                    Number.parseInt(e.target.value, 10) || 0
                                                )
                                            }
                                            className="bg-background/50 border-border/50 h-10 font-mono text-sm pr-10 focus:ring-primary/20"
                                            placeholder={t('settings.usageLimits.maxPercentPlaceholder')}
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

                {antigravityModels.length === 0 && (
                    <div className="py-12 text-center opacity-30 text-sm">
                        {t('settings.usageLimits.noAntigravityModels')}
                    </div>
                )}
            </div>
        </div>
    );
};
