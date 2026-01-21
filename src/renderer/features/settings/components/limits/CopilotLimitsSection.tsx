import { TrendingUp } from 'lucide-react'
import React from 'react'

import { AppSettings } from '@/types/settings'

import { CopilotLimitItem } from './CopilotLimitItem'

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
    return (
        <div className="bg-card p-6 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold uppercase text-muted-foreground">Copilot</h3>
            </div>
            <div className="text-xs text-muted-foreground mb-4">
                Current: {copilotRemaining} / {copilotLimit} remaining
            </div>

            {(['hourly', 'daily', 'weekly'] as const).map((period) => {
                const periodLimit = copilotLimits?.[period] ?? { enabled: false, type: 'requests' as const, value: 0 }
                return (
                    <CopilotLimitItem
                        key={period}
                        period={period}
                        periodLimit={periodLimit}
                        copilotRemaining={copilotRemaining}
                        updateCopilotLimit={updateCopilotLimit}
                    />
                )
            })}
        </div>
    )
}
