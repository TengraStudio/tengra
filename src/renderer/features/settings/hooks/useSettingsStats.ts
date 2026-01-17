import { useEffect, useState } from 'react'

import { CodexUsage, CopilotQuota, QuotaResponse } from '@/types'

import { DetailedStats } from '../types'

export function useSettingsStats() {
    const [statsLoading, setStatsLoading] = useState(false)
    const [statsPeriod, setStatsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
    const [statsData, setStatsData] = useState<DetailedStats | null>(null)
    const [quotaData, setQuotaData] = useState<any | null>(null)
    const [copilotQuota, setCopilotQuota] = useState<any | null>(null)
    const [codexUsage, setCodexUsage] = useState<any | null>(null)
    const [claudeQuota, setClaudeQuota] = useState<any | null>(null)
    const [reloadTrigger, setReloadTrigger] = useState(0)

    useEffect(() => {
        const loadStats = async () => {
            setStatsLoading(true)
            try {
                const data = await window.electron.db.getDetailedStats(statsPeriod)
                setStatsData(data)

                try {
                    const quota = await window.electron.getQuota()
                    setQuotaData(quota)
                } catch (e) {
                    console.error('Failed to load quota:', e)
                }

                try {
                    const cpQuota = await window.electron.getCopilotQuota()
                    setCopilotQuota(cpQuota)
                } catch (e) {
                    console.error('Failed to load copilot quota:', e)
                }

                try {
                    const usage = await window.electron.getCodexUsage()
                    setCodexUsage(usage)
                } catch (e) {
                    console.error('Failed to load codex usage:', e)
                }

                try {
                    const cQuota = await window.electron.getClaudeQuota()
                    setClaudeQuota(cQuota)
                } catch (e) {
                    console.error('Failed to load claude quota:', e)
                }
            } catch (error) {
                console.error('Failed to load stats:', error)
            } finally {
                setStatsLoading(false)
            }
        }
        loadStats()
        const interval = setInterval(loadStats, 60000)
        return () => clearInterval(interval)
    }, [statsPeriod, reloadTrigger])

    return {
        statsLoading,
        statsPeriod,
        setStatsPeriod,
        statsData,
        quotaData,
        copilotQuota,
        codexUsage,
        claudeQuota,
        setReloadTrigger
    }
}
