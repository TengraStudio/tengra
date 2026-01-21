import { Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import { AppSettings } from '@/types'
import { CodexUsage, CopilotQuota, QuotaResponse } from '@/types/quota'

import { AccountWrapper, DetailedStats, TimeStats } from '../types'

import { AntigravityCard } from './statistics/AntigravityCard'
import { ClaudeCard } from './statistics/ClaudeCard'
import { CodexCard } from './statistics/CodexCard'
import { CopilotCard } from './statistics/CopilotCard'
import { OverviewCards } from './statistics/OverviewCards'
import { ProjectBarChart } from './statistics/ProjectBarChart'

interface StatisticsTabProps {
    statsLoading: boolean
    statsData: DetailedStats | null
    quotaData: AccountWrapper<QuotaResponse> | null
    copilotQuota: AccountWrapper<CopilotQuota> | null
    codexUsage: AccountWrapper<{ usage: CodexUsage }> | null
    claudeQuota: AccountWrapper<import('@shared/types/quota').ClaudeQuota> | null
    statsPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly'
    setStatsPeriod: (p: 'daily' | 'weekly' | 'monthly' | 'yearly') => void
    settings: AppSettings | null
    authStatus: { codex: boolean; claude: boolean; antigravity: boolean }
    setReloadTrigger?: (v: number | ((prev: number) => number)) => void
}

export const StatisticsTab: React.FC<StatisticsTabProps> = ({
    statsLoading, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, statsPeriod, setStatsPeriod, settings, setReloadTrigger
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
        void loadTimeStats()

        const loadProjects = async () => {
            try {
                const projs = await window.electron.db.getProjects()
                setProjects(projs)
            } catch (error) {
                console.error('Failed to load projects:', error)
            }
        }
        void loadProjects()
    }, [])

    if (statsLoading && !statsData) {
        return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    const locale = settings?.general?.language === 'tr' ? 'tr-TR' : 'en-US'

    return (
        <div className="space-y-6">
            <OverviewCards
                t={t}
                statsData={statsData}
                timeStats={timeStats}
                loadingTimeStats={loadingTimeStats}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AntigravityCard t={t} quotaData={quotaData} setReloadTrigger={setReloadTrigger} locale={locale} />
                <ClaudeCard claudeQuota={claudeQuota} locale={locale} />
                <CopilotCard copilotQuota={copilotQuota} />
                <CodexCard codexUsage={codexUsage} locale={locale} />
            </div>

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
