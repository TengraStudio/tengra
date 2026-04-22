/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CommonBatches } from '@renderer/utils/ipc-batch.util';
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { appLogger } from '@/utils/renderer-logger';

import { DetailedStats } from '../types';

type QuotaPushPayload = {
    timestampMs?: number;
    quotaData?: Awaited<ReturnType<Window['electron']['getQuota']>> | null;
    copilotQuota?: Awaited<ReturnType<Window['electron']['getCopilotQuota']>> | null;
    codexUsage?: Awaited<ReturnType<Window['electron']['getCodexUsage']>> | null;
    claudeQuota?: Awaited<ReturnType<Window['electron']['getClaudeQuota']>> | null;
    error?: string;
};

function hasMeaningfulCodexUsage(payload?: Awaited<ReturnType<Window['electron']['getCodexUsage']>> | null): boolean {
    if (!payload?.accounts || payload.accounts.length === 0) {
        return false;
    }
    return payload.accounts.some(acc => {
        const usage = (acc as { usage?: unknown })?.usage as Record<string, unknown> | undefined;
        if (!usage || typeof usage !== 'object') {
            return false;
        }
        // Any numeric usage signal counts as meaningful.
        return (
            typeof usage.dailyUsedPercent === 'number'
            || typeof usage.weeklyUsedPercent === 'number'
            || typeof usage.remainingRequests === 'number'
            || typeof usage.totalRequests === 'number'
        );
    });
}

function safeJsonStringify(value: unknown): string {
    try {
        return JSON.stringify(value) ?? '';
    } catch {
        return '';
    }
}

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
    const quotaCacheRef = useRef<{
        quotaHash: string;
        copilotHash: string;
        codexHash: string;
        claudeHash: string;
    }>({
        quotaHash: '',
        copilotHash: '',
        codexHash: '',
        claudeHash: '',
    });

    const loadStats = useCallback(async () => {
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
    }, [statsPeriod]);

    const refreshDetailedStatsOnly = useCallback(async () => {
        setStatsLoading(true);
        try {
            const statsData = await window.electron.db.getDetailedStats(statsPeriod).catch(() => null);
            setData(previous => ({
                ...previous,
                statsData
            }));
        } catch (error) {
            appLogger.error('useSettingsStats', 'Failed to refresh detailed stats', error as Error);
        } finally {
            setStatsLoading(false);
        }
    }, [statsPeriod]);

    useEffect(() => {
        void loadStats();
        const interval = setInterval(() => { void refreshDetailedStatsOnly(); }, 60000);
        return () => clearInterval(interval);
    }, [loadStats, refreshDetailedStatsOnly, reloadTrigger]);

    useEffect(() => {
        const unsubscribe = window.electron.on('proxy:quota:updated', (_event, rawPayload) => {
            const payload = (rawPayload ?? {}) as QuotaPushPayload;
            if (payload.error) {
                appLogger.warn('useSettingsStats', `Quota push payload contains error: ${payload.error}`);
            }
            setData(previous => {
                const next = { ...previous };
                let changed = false;

                if (payload.quotaData) {
                    const nextHash = safeJsonStringify(payload.quotaData);
                    if (nextHash && nextHash !== quotaCacheRef.current.quotaHash) {
                        quotaCacheRef.current.quotaHash = nextHash;
                        next.quotaData = payload.quotaData;
                        changed = true;
                    }
                }

                if (payload.copilotQuota) {
                    const nextHash = safeJsonStringify(payload.copilotQuota);
                    if (nextHash && nextHash !== quotaCacheRef.current.copilotHash) {
                        quotaCacheRef.current.copilotHash = nextHash;
                        next.copilotQuota = payload.copilotQuota;
                        changed = true;
                    }
                }

                if (hasMeaningfulCodexUsage(payload.codexUsage)) {
                    const nextHash = safeJsonStringify(payload.codexUsage);
                    if (nextHash && nextHash !== quotaCacheRef.current.codexHash) {
                        quotaCacheRef.current.codexHash = nextHash;
                        next.codexUsage = payload.codexUsage ?? previous.codexUsage;
                        changed = true;
                    }
                }

                if (payload.claudeQuota) {
                    const nextHash = safeJsonStringify(payload.claudeQuota);
                    if (nextHash && nextHash !== quotaCacheRef.current.claudeHash) {
                        quotaCacheRef.current.claudeHash = nextHash;
                        next.claudeQuota = payload.claudeQuota;
                        changed = true;
                    }
                }

                return changed ? next : previous;
            });
        });
        return () => {
            unsubscribe();
        };
    }, []);

    return useMemo(() => ({
        statsLoading,
        statsPeriod,
        setStatsPeriod,
        ...data,
        setReloadTrigger
    }), [statsLoading, statsPeriod, data]);
}
