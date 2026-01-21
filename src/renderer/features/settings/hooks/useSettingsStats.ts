import { useEffect, useMemo, useState } from 'react'

import { DetailedStats } from '../types'

export function useSettingsStats() {
    const [statsLoading, setStatsLoading] = useState(false)
    const [statsPeriod, setStatsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
    const [reloadTrigger, setReloadTrigger] = useState(0)

    const [data, setData] = useState({
        statsData: null as DetailedStats | null,
        quotaData: null as Awaited<ReturnType<Window['electron']['getQuota']>> | null,
        copilotQuota: null as Awaited<ReturnType<Window['electron']['getCopilotQuota']>> | null,
        codexUsage: null as Awaited<ReturnType<Window['electron']['getCodexUsage']>> | null,
        claudeQuota: null as Awaited<ReturnType<Window['electron']['getClaudeQuota']>> | null
    })

    useEffect(() => {
        const loadStats = async () => {
            setStatsLoading(true)
            try {
                const [statsData, quotaData, copilotQuota, codexUsage, claudeQuota] = await Promise.all([
                    window.electron.db.getDetailedStats(statsPeriod).catch(() => null),
                    window.electron.getQuota().catch(() => null),
                    window.electron.getCopilotQuota().catch(() => null),
                    window.electron.getCodexUsage().catch(() => null),
                    window.electron.getClaudeQuota().catch(() => null)
                ])

                setData({
                    statsData: statsData,
                    quotaData,
                    copilotQuota,
                    codexUsage,
                    claudeQuota
                })
            } catch (error) {
                console.error('Failed to load stats:', error)
            } finally {
                setStatsLoading(false)
            }
        }
        void loadStats()
        const interval = setInterval(() => { void loadStats() }, 60000)
        return () => clearInterval(interval)
    }, [statsPeriod, reloadTrigger])

    return useMemo(() => ({
        statsLoading,
        statsPeriod,
        setStatsPeriod,
        ...data,
        setReloadTrigger
    }), [statsLoading, statsPeriod, data])
}
