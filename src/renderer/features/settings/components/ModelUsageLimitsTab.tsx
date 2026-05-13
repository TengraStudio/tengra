/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconActivity, IconBolt, IconLock, IconShield } from '@tabler/icons-react';
import React, { useMemo } from 'react';

import { SettingsPanel, SettingsTabHeader, SettingsTabLayout } from './SettingsPrimitives';
import type { GroupedModels } from '@/types';
import { AppSettings } from '@/types/settings';

import { AntigravityLimitsSection } from './limits/AntigravityLimitsSection';
import { CodexLimitsSection } from './limits/CodexLimitsSection';
import { CopilotLimitsSection } from './limits/CopilotLimitsSection';

interface ModelUsageLimitsTabProps {
    settings: AppSettings | null;
    setSettings: (s: AppSettings) => void;
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
    };

    const firstAccount = copilotQuota?.accounts[0];
    const copilotRemaining = firstAccount?.remaining ?? 0;
    const copilotLimit = firstAccount?.limit ?? 0;

    return (
        <SettingsTabLayout> 
            <SettingsPanel
                title={t('frontend.settings.usageLimits.copilotProtocol')}
                description={t('frontend.settings.usageLimits.consumptionGuard')}
                icon={IconBolt}
            >
                <div className="px-4 pb-4 pt-0 sm:px-6">
                    <CopilotLimitsSection
                        copilotLimits={copilotLimits}
                        copilotRemaining={copilotRemaining}
                        copilotLimit={copilotLimit}
                        updateCopilotLimit={updateCopilotLimit}
                    />
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('frontend.settings.usageLimits.coreAllocation')}
                description={t('frontend.settings.usageLimits.antigravity.description')}
                icon={IconActivity}
            >
                <div className="px-4 pb-4 pt-0 sm:px-6">
                    <AntigravityLimitsSection
                        antigravityModels={antigravityModels}
                        antigravityLimits={antigravityLimits}
                        updateAntigravityLimit={updateAntigravityLimit}
                    />
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('frontend.settings.usageLimits.legacyThresholds')}
                description={t('frontend.settings.usageLimits.codex.description')}
                icon={IconLock}
            >
                <div className="px-4 pb-4 pt-0 sm:px-6">
                    <CodexLimitsSection
                        codexLimits={codexLimits}
                        updateCodexLimit={updateCodexLimit}
                    />
                </div>
            </SettingsPanel>
        </SettingsTabLayout>
    );
};

