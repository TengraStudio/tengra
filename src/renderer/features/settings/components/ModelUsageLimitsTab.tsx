import { Badge } from '@renderer/components/ui/badge';
import { Activity, Lock,Shield, Zap } from 'lucide-react';
import React, { useMemo } from 'react';

import type { GroupedModels } from '@/types';
import { AppSettings } from '@/types/settings';

import { AntigravityLimitsSection } from './limits/AntigravityLimitsSection';
import { CodexLimitsSection } from './limits/CodexLimitsSection';
import { CopilotLimitsSection } from './limits/CopilotLimitsSection';

interface ModelUsageLimitsTabProps {
    settings: AppSettings | null;
    setSettings: (s: AppSettings) => void;
    handleSave: (s?: AppSettings) => void;
    groupedModels?: GroupedModels;
    copilotQuota?: {
        accounts: Array<
            import('@shared/types/quota').CopilotQuota & {
                accountId?: string;
                email?: string;
            }
        >;
    } | null;
    t: (key: string) => string;
}

export const ModelUsageLimitsTab: React.FC<ModelUsageLimitsTabProps> = ({
    settings,
    setSettings,
    handleSave,
    groupedModels,
    copilotQuota,
    t,
}) => {
    const antigravityModels = useMemo(() => {
        if (!groupedModels) {
            return [];
        }
        if (!('antigravity' in groupedModels)) {
            return [];
        }
        return groupedModels['antigravity'].models;
    }, [groupedModels]);

    if (!settings) {
        return null;
    }

    const limits = settings.modelUsageLimits ?? {};
    const copilotLimits = limits.copilot;
    const antigravityLimits = limits.antigravity;
    const codexLimits = limits.codex;

    const updateCopilotLimit = (
        period: 'hourly' | 'daily' | 'weekly',
        field: 'enabled' | 'type' | 'value',
        value: boolean | string | number
    ) => {
        const updated = {
            ...settings,
            modelUsageLimits: {
                ...limits,
                copilot: {
                    ...copilotLimits,
                    [period]: {
                        ...(copilotLimits?.[period] ?? {
                            enabled: false,
                            type: 'requests' as const,
                            value: 0,
                        }),
                        [field]: value,
                    },
                },
            },
        };
        setSettings(updated);
        handleSave(updated);
    };

    const updateAntigravityLimit = (
        modelId: string,
        enabled: boolean,
        percentage: number
    ) => {
        const updated = {
            ...settings,
            modelUsageLimits: {
                ...limits,
                antigravity: {
                    ...(antigravityLimits ?? {}),
                    [modelId]: {
                        enabled,
                        percentage,
                    },
                },
            },
        };
        setSettings(updated);
        handleSave(updated);
    };

    const updateCodexLimit = (
        period: 'daily' | 'weekly',
        field: 'enabled' | 'percentage',
        value: boolean | number
    ) => {
        const updated = {
            ...settings,
            modelUsageLimits: {
                ...limits,
                codex: {
                    ...(codexLimits ?? {}),
                    [period]: {
                        ...(codexLimits?.[period] ?? {}),
                        [field]: value,
                    },
                },
            },
        };
        setSettings(updated);
        handleSave(updated);
    };

    const firstAccount = copilotQuota?.accounts[0];
    const copilotRemaining = firstAccount?.remaining ?? 0;
    const copilotLimit = firstAccount?.limit ?? 0;

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out pb-20">
            {/* Page Header */}
            <div className="relative group px-1">
                <div className="flex items-center gap-4 mb-3">
                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shadow-2xl shadow-primary/10 group-hover:scale-110 transition-transform duration-700 ring-1 ring-primary/20">
                        <Shield className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-foreground leading-none">
                            {t('settings.usageLimits.title')}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                             <div className="h-1 w-8 bg-primary rounded-full group-hover:w-12 transition-all duration-700" />
                            <p className="text-[10px] font-bold text-muted-foreground opacity-50">
                                {t('settings.usageLimits.consumptionGuard')}
                            </p>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-2xl font-medium px-1">
                    {t('settings.usageLimits.description')}
                </p>
            </div>

            {/* Limits Sections */}
            <div className="space-y-8 pb-20">
                {/* Copilot Section */}
                <div className="bg-card rounded-[2.5rem] border border-border/40 p-8 pt-10 shadow-sm relative overflow-hidden group/copilot hover:border-border/60 transition-all duration-500">
                    <div className="flex items-center justify-between px-1 mb-8 relative z-10">
                        <div className="flex items-center gap-3">
                            <Zap className="w-4 h-4 text-primary" />
                            <h4 className="text-[10px] font-bold text-muted-foreground/40">{t('settings.usageLimits.copilotProtocol')}</h4>
                        </div>
                        <Badge variant="outline" className="h-5 text-[8px] px-2 font-bold border-primary/20 text-primary">{t('settings.usageLimits.activePolicy')}</Badge>
                    </div>
                     <div className="relative z-10">
                        <CopilotLimitsSection
                            copilotLimits={copilotLimits}
                            copilotRemaining={copilotRemaining}
                            copilotLimit={copilotLimit}
                            updateCopilotLimit={updateCopilotLimit}
                        />
                    </div>
                    <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] opacity-30 pointer-events-none" />
                </div>

                {/* Antigravity Section */}
                <div className="bg-card rounded-[2.5rem] border border-border/40 p-8 pt-10 shadow-sm relative overflow-hidden group/antigravity hover:border-border/60 transition-all duration-500">
                    <div className="flex items-center justify-between px-1 mb-8 relative z-10">
                        <div className="flex items-center gap-3">
                            <Activity className="w-4 h-4 text-primary" />
                            <h4 className="text-[10px] font-bold text-muted-foreground/40">{t('settings.usageLimits.coreAllocation')}</h4>
                        </div>
                        <Badge variant="outline" className="h-5 text-[8px] px-2 font-bold border-primary/20 text-primary">{t('settings.usageLimits.customQuotas')}</Badge>
                    </div>
                    <div className="relative z-10">
                        <AntigravityLimitsSection
                            antigravityModels={antigravityModels}
                            antigravityLimits={antigravityLimits}
                            updateAntigravityLimit={updateAntigravityLimit}
                        />
                    </div>
                     <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] opacity-30 pointer-events-none" />
                </div>

                {/* Codex Section */}
                <div className="bg-card rounded-[2.5rem] border border-border/40 p-8 pt-10 shadow-sm relative overflow-hidden group/codex hover:border-border/60 transition-all duration-500">
                    <div className="flex items-center justify-between px-1 mb-8 relative z-10">
                        <div className="flex items-center gap-3">
                            <Lock className="w-4 h-4 text-primary" />
                            <h4 className="text-[10px] font-bold text-muted-foreground/40">{t('settings.usageLimits.legacyThresholds')}</h4>
                        </div>
                        <Badge variant="outline" className="h-5 text-[8px] px-2 font-bold border-primary/20 text-primary">{t('settings.usageLimits.restrictive')}</Badge>
                    </div>
                    <div className="relative z-10">
                        <CodexLimitsSection
                            codexLimits={codexLimits}
                            updateCodexLimit={updateCodexLimit}
                        />
                    </div>
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] opacity-30 pointer-events-none" />
                </div>
            </div>
        </div>
    );
};
