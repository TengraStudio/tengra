import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Loader2, Clock, MessageSquare, Activity, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { QuotaResponse, CodexUsage, CopilotQuota, AppSettings, ModelQuotaItem } from '@/types'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

type DetailedStats = {
    chatCount: number
    messageCount: number
    dbSize: number
    totalTokens: number
    promptTokens: number
    completionTokens: number
    tokenTimeline: { timestamp: number; promptTokens: number; completionTokens: number }[]
    activity: number[]
}

interface TimeStats {
    totalOnlineTime: number
    totalCodingTime: number
    projectCodingTime: Record<string, number>
}

interface StatisticsTabProps {
    statsLoading: boolean
    statsData: DetailedStats | null
    quotaData: QuotaResponse | null
    copilotQuota: CopilotQuota | null
    codexUsage: CodexUsage | null
    claudeQuota: { success: boolean; fiveHour?: { utilization: number; resetsAt: string }; sevenDay?: { utilization: number; resetsAt: string } } | null
    statsPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly'
    setStatsPeriod: (p: 'daily' | 'weekly' | 'monthly' | 'yearly') => void
    settings: AppSettings | null
    authStatus: { codex: boolean; claude: boolean; antigravity: boolean }
    setReloadTrigger?: (v: number | ((prev: number) => number)) => void
}

const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
}

const renderRing = (value: number, color: string, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'h-9 w-9' : 'h-12 w-12'
    const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'
    return (
        <div className={`relative ${sizeClass} text-foreground`}>
            <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${color} ${value}%, hsl(var(--muted) / 0.3) 0)` }} />
            <div className={`absolute inset-1 rounded-full bg-card flex items-center justify-center ${textSize} font-bold`}>
                {Math.round(value)}%
            </div>
        </div>
    )
}

const getQuotaColor = (p: number) => {
    if (p === 0) return 'rgb(239 68 68)'
    if (p < 25) return 'rgb(249 115 22)'
    if (p < 50) return 'rgb(234 179 8)'
    return 'rgb(34 197 94)'
}

const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
}

// Simple bar chart component for time
const TimeBarChart = ({ value, maxValue, label, color = 'hsl(var(--primary))' }: { value: number; maxValue: number; label: string; color?: string }) => {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <span className="text-sm font-bold text-foreground">{formatTime(value)}</span>
            </div>
            <div className="h-3 bg-muted/20 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(percentage, 100)}%`, background: color }}
                />
            </div>
        </div>
    )
}

// Project bar chart component
const ProjectBarChart = ({ projects, maxTime }: { projects: Array<{ id: string; title: string; time: number }>; maxTime: number }) => {
    return (
        <div className="space-y-4">
            {projects.map(({ id, title, time }) => {
                const percentage = maxTime > 0 ? (time / maxTime) * 100 : 0
                return (
                    <div key={id} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground truncate flex-1">{title}</span>
                            <span className="text-sm font-bold text-primary ml-2 flex-shrink-0">{formatTime(time)}</span>
                        </div>
                        <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500 bg-primary"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export const StatisticsTab: React.FC<StatisticsTabProps> = ({
    statsLoading, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, statsPeriod, setStatsPeriod, settings, authStatus, setReloadTrigger
}) => {
    const { t } = useTranslation(settings?.general?.language || 'en')
    const [timeStats, setTimeStats] = useState<TimeStats | null>(null)
    const [loadingTimeStats, setLoadingTimeStats] = useState(false)
    const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([])

    useEffect(() => {
        const loadTimeStats = async () => {
            setLoadingTimeStats(true)
            try {
                const stats = await window.electron.db.getTimeStats()
                setTimeStats(stats)
            } catch (error) {
                console.error('Failed to load time stats:', error)
            } finally {
                setLoadingTimeStats(false)
            }
        }
        loadTimeStats()

        const loadProjects = async () => {
            try {
                const projs = await window.electron.db.getProjects()
                setProjects(projs)
            } catch (error) {
                console.error('Failed to load projects:', error)
            }
        }
        loadProjects()
    }, [])

    const formatReset = (value?: string) => {
        if (!value || value === '-') return '-'
        try {
            const date = new Date(value)
            const locale = settings?.general?.language === 'tr' ? 'tr-TR' : 'en-US'
            if (Number.isNaN(date.getTime())) return String(value)
            return date.toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        } catch {
            return value
        }
    }

    // Codex usage - extract from codexUsage object (from internal API)
    const codex = codexUsage || {}
    const dailyUsedPercent = codex.dailyUsedPercent || 0
    const weeklyUsedPercent = codex.weeklyUsedPercent || 0

    // Copilot quota - service returns { success, plan, limit, remaining, used, percentage }
    const copilotLimit = (copilotQuota && typeof copilotQuota === 'object' && 'limit' in copilotQuota) ? (copilotQuota.limit ?? 0) : 0
    const copilotRemaining = (copilotQuota && typeof copilotQuota === 'object' && 'remaining' in copilotQuota) ? (copilotQuota.remaining ?? 0) : 0
    const copilotSuccess = (copilotQuota && typeof copilotQuota === 'object' && 'success' in copilotQuota) ? (copilotQuota.success ?? false) : false

    // Use percentage from service if available, otherwise calculate from remaining/limit
    let copilotPercent: number | null = null
    if (copilotQuota && typeof copilotQuota === 'object' && 'percentage' in copilotQuota && copilotQuota.percentage !== null && typeof copilotQuota.percentage === 'number') {
        copilotPercent = copilotQuota.percentage
    } else if (copilotLimit > 0) {
        copilotPercent = Math.round((copilotRemaining / copilotLimit) * 100)
    }

    // Filter Antigravity models from quotaData
    const antigravityModels = quotaData?.models?.filter((m: ModelQuotaItem) =>
        m.provider === 'antigravity' || m.provider?.toLowerCase() === 'antigravity'
    ) || []

    if (statsLoading && !statsData) {
        return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{t('statistics.messages')}</CardTitle>
                            <MessageSquare className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{statsData?.messageCount || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total messages sent</p>
                    </CardContent>
                </Card>

                <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{t('statistics.chats')}</CardTitle>
                            <Activity className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{statsData?.chatCount || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Active conversations</p>
                    </CardContent>
                </Card>

                <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{t('statistics.totalTokens')}</CardTitle>
                            <TrendingUp className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingDown className="w-3.5 h-3.5 text-blue-400" />
                                    <span className="text-xs font-medium text-muted-foreground">{t('statistics.incoming')}</span>
                                </div>
                                <span className="text-lg font-bold text-blue-400">{formatNumber(statsData?.promptTokens || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-xs font-medium text-muted-foreground">{t('statistics.outgoing')}</span>
                                </div>
                                <span className="text-lg font-bold text-emerald-400">{formatNumber(statsData?.completionTokens || 0)}</span>
                            </div>
                            <div className="pt-2 border-t border-border/30">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Total</span>
                                    <span className="text-xl font-bold text-foreground">{formatNumber(statsData?.totalTokens || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{t('statistics.onlineTime')}</CardTitle>
                            <Clock className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingTimeStats ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                            <TimeBarChart
                                value={timeStats?.totalOnlineTime || 0}
                                maxValue={Math.max(timeStats?.totalOnlineTime || 0, 86400000)}
                                label={t('statistics.totalAppUsage')}
                                color="hsl(var(--primary))"
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Codex and Copilot Quotas */}
            {(authStatus.codex || copilotQuota) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {authStatus.codex && codexUsage && (
                        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-foreground">ChatGPT Codex</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        {renderRing(100 - dailyUsedPercent, 'hsl(var(--primary))')}
                                        <div>
                                            <div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.dailyRemaining')}</div>
                                            <div className="text-xs text-muted-foreground">{t('statistics.reset')}: {formatReset(codex.dailyResetAt)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {renderRing(100 - weeklyUsedPercent, 'hsl(280 100% 60%)')}
                                        <div>
                                            <div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.weeklyRemaining')}</div>
                                            <div className="text-xs text-muted-foreground">{t('statistics.reset')}: {formatReset(codex.weeklyResetAt)}</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {copilotQuota && copilotSuccess && copilotLimit > 0 && (
                        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-foreground">GitHub Copilot</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {copilotPercent !== null && typeof copilotPercent === 'number' ? (
                                    <div className="flex items-center gap-3">
                                        {renderRing(copilotPercent, 'hsl(142 76% 45%)')}
                                        <div>
                                            <div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.quotaStatus')}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {copilotRemaining} / {copilotLimit} remaining
                                            </div>
                                            {copilotQuota && typeof copilotQuota === 'object' && 'plan' in copilotQuota && typeof copilotQuota.plan === 'string' && copilotQuota.plan && (
                                                <div className="text-xs text-muted-foreground/70 mt-0.5">
                                                    Plan: {copilotQuota.plan}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        {renderRing(0, 'hsl(var(--muted))')}
                                        <div>
                                            <div className="text-xs font-bold uppercase text-muted-foreground">{t('statistics.quotaStatus')}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {copilotRemaining} / {copilotLimit} remaining
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Claude Quota */}
            {authStatus.claude && claudeQuota && claudeQuota.success && (
                <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-foreground">Anthropic Claude</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            {claudeQuota.fiveHour && (
                                <div className="flex items-center gap-3">
                                    {renderRing(100 - claudeQuota.fiveHour.utilization, 'hsl(280 70% 60%)')}
                                    <div>
                                        <div className="text-xs font-bold uppercase text-muted-foreground">5-Hour Limit</div>
                                        <div className="text-xs text-muted-foreground">{t('statistics.reset')}: {formatReset(claudeQuota.fiveHour.resetsAt)}</div>
                                    </div>
                                </div>
                            )}
                            {claudeQuota.sevenDay && (
                                <div className="flex items-center gap-3">
                                    {renderRing(100 - claudeQuota.sevenDay.utilization, 'hsl(260 70% 60%)')}
                                    <div>
                                        <div className="text-xs font-bold uppercase text-muted-foreground">7-Day Limit</div>
                                        <div className="text-xs text-muted-foreground">{t('statistics.reset')}: {formatReset(claudeQuota.sevenDay.resetsAt)}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}


            {/* Antigravity Model Quotas - Grid Layout */}
            {authStatus.antigravity && antigravityModels.length > 0 && (
                <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-bold text-foreground">{t('statistics.antigravityQuotas')}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">Per-model quota information</p>
                        </div>
                        {setReloadTrigger && (
                            <button
                                onClick={() => setReloadTrigger((p: number) => p + 1)}
                                className="p-1.5 hover:bg-muted/20 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {antigravityModels.map((m: ModelQuotaItem) => (
                                <div key={m.id || m.name} className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-muted/10">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-foreground truncate">{m.name || m.id}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{t('statistics.reset')}: {formatReset(m.reset)}</div>
                                    </div>
                                    <div className="ml-4 flex-shrink-0">
                                        {renderRing(m.percentage || 0, getQuotaColor(m.percentage || 0), 'sm')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Project Coding Time Chart */}
            {timeStats && Object.keys(timeStats.projectCodingTime).length > 0 && (
                <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-semibold">{t('statistics.codingTimeByProject')}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{t('statistics.timeSpentCodingInEachProject')}</p>
                        </div>
                        <div className="flex bg-muted/20 rounded-lg p-1 border border-border/40">
                            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setStatsPeriod(period)}
                                    className={cn(
                                        "px-3 py-1 text-xs rounded-md capitalize transition-all",
                                        statsPeriod === period
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'hover:bg-muted/30 text-muted-foreground'
                                    )}
                                >
                                    {t(`statistics.${period}`)}
                                </button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingTimeStats ? (
                            <div className="h-64 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                        ) : (
                            <ProjectBarChart
                                projects={Object.entries(timeStats.projectCodingTime)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([projectId, time]) => {
                                        const project = projects.find(p => p.id === projectId)
                                        return {
                                            id: projectId,
                                            title: project?.title || t('statistics.unknownProject'),
                                            time
                                        }
                                    })}
                                maxTime={Math.max(...Object.values(timeStats.projectCodingTime), 0)}
                            />
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Activity Overview */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Activity Overview</CardTitle>
                    <div className="flex bg-muted/20 rounded-lg p-1 border border-border/40">
                        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => (
                            <button
                                key={period}
                                onClick={() => setStatsPeriod(period)}
                                className={cn(
                                    "px-3 py-1 text-xs rounded-md capitalize transition-all",
                                    statsPeriod === period
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'hover:bg-muted/30 text-muted-foreground'
                                )}
                            >
                                {t(`statistics.${period}`)}
                            </button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground border-t border-border/40">
                    Chart visualization coming soon
                </CardContent>
            </Card>
        </div>
    )
}
