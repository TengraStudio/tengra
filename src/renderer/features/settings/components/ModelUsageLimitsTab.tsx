import React, { useMemo } from 'react'
import { AppSettings } from '@/types/settings'
import { GroupedModels } from '@/features/models/utils/model-fetcher'
import { Settings, Clock, Calendar, TrendingUp, Percent, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModelUsageLimitsTabProps {
    settings: AppSettings | null
    setSettings: (s: AppSettings) => void
    handleSave: (s?: AppSettings) => void
    groupedModels?: GroupedModels
    copilotQuota?: { remaining: number; limit: number } | null
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
    if (!settings) return null

    const limits = settings.modelUsageLimits || {}
    const copilotLimits = limits.copilot || {}
    const antigravityLimits = limits.antigravity || {}
    const codexLimits = limits.codex || {}

    // Get Antigravity models
    const antigravityModels = useMemo(() => {
        if (!groupedModels) return []
        const agGroup = groupedModels['antigravity']
        return agGroup?.models || []
    }, [groupedModels])

    const updateCopilotLimit = (period: 'hourly' | 'daily' | 'weekly', field: 'enabled' | 'type' | 'value', value: any) => {
        const updated = {
            ...settings,
            modelUsageLimits: {
                ...limits,
                copilot: {
                    ...copilotLimits,
                    [period]: {
                        ...copilotLimits[period],
                        [field]: value
                    }
                }
            }
        }
        setSettings(updated)
        handleSave(updated)
    }

    const updateAntigravityLimit = (modelId: string, enabled: boolean, percentage: number) => {
        const updated = {
            ...settings,
            modelUsageLimits: {
                ...limits,
                antigravity: {
                    ...antigravityLimits,
                    [modelId]: {
                        enabled,
                        percentage
                    }
                }
            }
        }
        setSettings(updated)
        handleSave(updated)
    }

    const updateCodexLimit = (period: 'daily' | 'weekly', field: 'enabled' | 'percentage', value: any) => {
        const updated = {
            ...settings,
            modelUsageLimits: {
                ...limits,
                codex: {
                    ...codexLimits,
                    [period]: {
                        ...codexLimits[period],
                        [field]: value
                    }
                }
            }
        }
        setSettings(updated)
        handleSave(updated)
    }

    const copilotRemaining = copilotQuota?.remaining ?? 0
    const copilotLimit = copilotQuota?.limit ?? 0

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-6">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Model Usage Limits</h2>
            </div>

            {/* Copilot Limits */}
            <div className="bg-card p-6 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold uppercase text-muted-foreground">Copilot</h3>
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                    Current: {copilotRemaining} / {copilotLimit} remaining
                </div>

                {(['hourly', 'daily', 'weekly'] as const).map((period) => {
                    const periodLimit = copilotLimits[period] || { enabled: false, type: 'requests' as const, value: 0 }
                    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1)
                    const Icon = period === 'hourly' ? Clock : period === 'daily' ? Calendar : TrendingUp

                    return (
                        <div key={period} className="mb-4 p-4 bg-muted/10 rounded-lg border border-border/50">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-primary" />
                                    <label className="text-sm font-bold">{periodLabel} Limit</label>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={periodLimit.enabled}
                                        onChange={(e) => updateCopilotLimit(period, 'enabled', e.target.checked)}
                                        className="w-4 h-4 rounded border-border"
                                    />
                                    <span className="text-xs text-muted-foreground">Enable</span>
                                </label>
                            </div>

                            {periodLimit.enabled && (
                                <div className="space-y-3 mt-3">
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs text-muted-foreground">Type:</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateCopilotLimit(period, 'type', 'requests')}
                                                className={cn(
                                                    "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all",
                                                    periodLimit.type === 'requests'
                                                        ? "bg-primary/20 border-primary text-primary"
                                                        : "bg-muted/20 border-border text-muted-foreground"
                                                )}
                                            >
                                                <Hash className="w-3 h-3 inline mr-1" />
                                                Requests
                                            </button>
                                            <button
                                                onClick={() => updateCopilotLimit(period, 'type', 'percentage')}
                                                className={cn(
                                                    "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all",
                                                    periodLimit.type === 'percentage'
                                                        ? "bg-primary/20 border-primary text-primary"
                                                        : "bg-muted/20 border-border text-muted-foreground"
                                                )}
                                            >
                                                <Percent className="w-3 h-3 inline mr-1" />
                                                Percentage
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1">
                                            {periodLimit.type === 'requests' ? 'Max Requests' : 'Max Percentage (%)'}
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={periodLimit.type === 'percentage' ? 100 : undefined}
                                            value={periodLimit.value}
                                            onChange={(e) => updateCopilotLimit(period, 'value', parseInt(e.target.value) || 0)}
                                            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-sm"
                                            placeholder={periodLimit.type === 'requests' ? '5' : '50'}
                                        />
                                        {periodLimit.type === 'percentage' && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Will limit to {Math.round(copilotRemaining * (periodLimit.value / 100))} requests ({periodLimit.value}% of {copilotRemaining} remaining)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Antigravity Limits */}
            <div className="bg-card p-6 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-4">
                    <Percent className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold uppercase text-muted-foreground">Antigravity Models</h3>
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                    Set percentage limit based on each model's remaining quota
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {antigravityModels.map((model) => {
                        const modelId = model.id || ''
                        const modelLimit = antigravityLimits?.[modelId] || { enabled: false, percentage: 50 }
                        return (
                            <div key={modelId} className="p-3 bg-muted/10 rounded-lg border border-border/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">{model.name || modelId}</span>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={modelLimit.enabled}
                                            onChange={(e) => modelId && updateAntigravityLimit(modelId, e.target.checked, modelLimit.percentage)}
                                            className="w-4 h-4 rounded border-border"
                                        />
                                        <span className="text-xs text-muted-foreground">Enable</span>
                                    </label>
                                </div>
                                {modelLimit.enabled && (
                                    <div className="mt-2">
                                        <label className="text-xs text-muted-foreground block mb-1">
                                            Max Percentage of Remaining Quota (%)
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={modelLimit.percentage}
                                            onChange={(e) => modelId && updateAntigravityLimit(modelId, true, parseInt(e.target.value) || 0)}
                                            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-sm"
                                            placeholder="50"
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Codex Limits */}
            <div className="bg-card p-6 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-green-400" />
                    <h3 className="text-sm font-bold uppercase text-muted-foreground">Codex</h3>
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                    Set percentage limits based on daily/weekly remaining quota
                </div>

                {(['daily', 'weekly'] as const).map((period) => {
                    const periodLimit = codexLimits[period] || { enabled: false, percentage: 50 }
                    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1)

                    return (
                        <div key={period} className="mb-4 p-4 bg-muted/10 rounded-lg border border-border/50">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    <label className="text-sm font-bold">{periodLabel} Limit</label>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={periodLimit.enabled}
                                        onChange={(e) => updateCodexLimit(period, 'enabled', e.target.checked)}
                                        className="w-4 h-4 rounded border-border"
                                    />
                                    <span className="text-xs text-muted-foreground">Enable</span>
                                </label>
                            </div>

                            {periodLimit.enabled && (
                                <div className="mt-3">
                                    <label className="text-xs text-muted-foreground block mb-1">
                                        Max Percentage of Remaining Quota (%)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={periodLimit.percentage}
                                        onChange={(e) => updateCodexLimit(period, 'percentage', parseInt(e.target.value) || 0)}
                                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-sm"
                                        placeholder="50"
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
