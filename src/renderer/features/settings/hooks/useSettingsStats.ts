import { CommonBatches } from '@renderer/utils/ipc-batch.util';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';

import { appLogger } from '@/utils/renderer-logger';

import { DetailedStats } from '../types';

export function useSettingsStats(): {
    statsLoading: boolean;
    statsPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly';
    setStatsPeriod: (period: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
    statsData: DetailedStats | null;
    quotaData: Awaited<ReturnType<Window['electron']['getQuota']>> | null;
    copilotQuota: Awaited<ReturnType<Window['electron']['getCopilotQuota']>> | null;
    codexUsage: Awaited<ReturnType<Window['electron']['getCodexUsage']>> | null;
    claudeQuota: Awaited<ReturnType<Window['electron']['getClaudeQuota']>> | null;
    setReloadTrigger: Dispatch<SetStateAction<number>>;
} {
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsPeriod, setStatsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
    const [reloadTrigger, setReloadTrigger] = useState(0);

    const [data, setData] = useState({
        statsData: null as DetailedStats | null,
        quotaData: null as Awaited<ReturnType<Window['electron']['getQuota']>> | null,
        copilotQuota: null as Awaited<ReturnType<Window['electron']['getCopilotQuota']>> | null,
        codexUsage: null as Awaited<ReturnType<Window['electron']['getCodexUsage']>> | null,
        claudeQuota: null as Awaited<ReturnType<Window['electron']['getClaudeQuota']>> | null
    });

    useEffect(() => {
        const loadStats = async () => {
            setStatsLoading(true);
            try {
                // Use batching for efficient loading of all settings data
                const batchedData = await CommonBatches.loadSettingsData();

                // Load detailed stats separately as it needs the period parameter
                const statsData = await window.electron.db.getDetailedStats(statsPeriod).catch(() => null);

                setData({
                    statsData,
                    quotaData: batchedData.quota ?? null,
                    copilotQuota: batchedData.copilotQuota ?? null,
                    codexUsage: batchedData.codexUsage ?? null,
                    claudeQuota: batchedData.claudeQuota ?? null
                });
            } catch (error) {
                appLogger.error('useSettingsStats', 'Failed to load stats', error as Error);
            } finally {
                setStatsLoading(false);
            }
        };
        void loadStats();
        const interval = setInterval(() => { void loadStats(); }, 60000);
        return () => clearInterval(interval);
    }, [statsPeriod, reloadTrigger]);

    return useMemo(() => ({
        statsLoading,
        statsPeriod,
        setStatsPeriod,
        ...data,
        setReloadTrigger
    }), [statsLoading, statsPeriod, data]);
}
