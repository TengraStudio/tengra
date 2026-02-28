import { Percent } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import type { ModelInfo } from '@/types';

interface AntigravityLimitsSectionProps {
    antigravityModels: ModelInfo[]
    antigravityLimits: Record<string, { enabled: boolean; percentage: number }> | undefined
    updateAntigravityLimit: (modelId: string, enabled: boolean, percentage: number) => void
}

export const AntigravityLimitsSection: React.FC<AntigravityLimitsSectionProps> = ({
    antigravityModels,
    antigravityLimits,
    updateAntigravityLimit
}) => {
    const { t } = useTranslation();
    return (
        <div className="bg-card p-6 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-4">
                <Percent className="w-4 h-4 text-purple" />
                <h3 className="text-sm font-bold uppercase text-muted-foreground">{t('settings.usageLimits.antigravity.title')}</h3>
            </div>
            <div className="text-xs text-muted-foreground mb-4">
                {t('settings.usageLimits.antigravity.description')}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
                {antigravityModels.map((model) => {
                    const modelId = model.id ?? '';
                    const modelLimit = antigravityLimits?.[modelId] ?? { enabled: false, percentage: 50 };
                    return (
                        <div key={modelId} className="p-3 bg-muted/10 rounded-lg border border-border/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{model.name ?? modelId}</span>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={modelLimit.enabled}
                                        onChange={(e) => modelId && updateAntigravityLimit(modelId, e.target.checked, modelLimit.percentage)}
                                        className="w-4 h-4 rounded border-border"
                                    />
                                    <span className="text-xs text-muted-foreground">{t('settings.usageLimits.enable')}</span>
                                </label>
                            </div>
                            {modelLimit.enabled && (
                                <div className="mt-2">
                                    <label className="text-xs text-muted-foreground block mb-1">
                                        {t('settings.usageLimits.maxPercentQuota')}
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={modelLimit.percentage}
                                        onChange={(e) => modelId && updateAntigravityLimit(modelId, true, Number.parseInt(e.target.value, 10) || 0)}
                                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-sm"
                                        placeholder={t('settings.usageLimits.maxPercentPlaceholder')}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
