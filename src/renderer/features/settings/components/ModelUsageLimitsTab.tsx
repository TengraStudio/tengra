import { Settings } from 'lucide-react';
import React, { useMemo } from 'react';

import { GroupedModels } from '@/features/models/utils/model-fetcher';
import { AppSettings } from '@/types/settings';

import { AntigravityLimitsSection } from './limits/AntigravityLimitsSection';
import { CodexLimitsSection } from './limits/CodexLimitsSection';
import { CopilotLimitsSection } from './limits/CopilotLimitsSection';

interface ModelUsageLimitsTabProps {
    settings: AppSettings | null
    setSettings: (s: AppSettings) => void
    handleSave: (s?: AppSettings) => void
    groupedModels?: GroupedModels
    copilotQuota?: { accounts: Array<import('@shared/types/quota').CopilotQuota & { accountId?: string; email?: string }> } | null
    t: (key: string) => string
}

export const ModelUsageLimitsTab: React.FC<ModelUsageLimitsTabProps> = ({
    settings,
    setSettings,
    handleSave,
    groupedModels,
    copilotQuota,
    t: _t
}) => {
    const antigravityModels = useMemo(() => {
        if (!groupedModels) { return []; }
        if (!('antigravity' in groupedModels)) { return []; }
        return groupedModels['antigravity'].models;
    }, [groupedModels]);

    if (!settings) { return null; }

    const limits = settings.modelUsageLimits ?? {};
    const copilotLimits = limits.copilot;
    const antigravityLimits = limits.antigravity;
    const codexLimits = limits.codex;

    const updateCopilotLimit = (period: 'hourly' | 'daily' | 'weekly', field: 'enabled' | 'type' | 'value', value: boolean | string | number) => {
        const updated = {
            ...settings,
            modelUsageLimits: {
                ...limits,
                copilot: {
                    ...copilotLimits,
                    [period]: {
                        ...(copilotLimits?.[period] ?? { enabled: false, type: 'requests' as const, value: 0 }),
                        [field]: value
                    }
                }
            }
        };
        setSettings(updated);
        handleSave(updated);
    };

    const updateAntigravityLimit = (modelId: string, enabled: boolean, percentage: number) => {
        const updated = {
            ...settings,
            modelUsageLimits: {
                ...limits,
                antigravity: {
                    ...(antigravityLimits ?? {}),
                    [modelId]: {
                        enabled,
                        percentage
                    }
                }
            }
        };
        setSettings(updated);
        handleSave(updated);
    };

    const updateCodexLimit = (period: 'daily' | 'weekly', field: 'enabled' | 'percentage', value: boolean | number) => {
        const updated = {
            ...settings,
            modelUsageLimits: {
                ...limits,
                codex: {
                    ...(codexLimits ?? {}),
                    [period]: {
                        ...(codexLimits?.[period] ?? {}),
                        [field]: value
                    }
                }
            }
        };
        setSettings(updated);
        handleSave(updated);
    };

    const firstAccount = copilotQuota?.accounts[0];
    const copilotRemaining = firstAccount?.remaining ?? 0;
    const copilotLimit = firstAccount?.limit ?? 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-6">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Model Usage Limits</h2>
            </div>

            <CopilotLimitsSection
                copilotLimits={copilotLimits}
                copilotRemaining={copilotRemaining}
                copilotLimit={copilotLimit}
                updateCopilotLimit={updateCopilotLimit}
            />

            <AntigravityLimitsSection
                antigravityModels={antigravityModels}
                antigravityLimits={antigravityLimits}
                updateAntigravityLimit={updateAntigravityLimit}
            />

            <CodexLimitsSection
                codexLimits={codexLimits}
                updateCodexLimit={updateCodexLimit}
            />
        </div>
    );
};
