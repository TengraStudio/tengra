/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type UsagePeriod = 'hourly' | 'daily' | 'weekly';

/** Result of a usage limit check */
interface UsageLimitResult {
    allowed: boolean;
    reason?: string;
}

/**
 * Hook that wires the usage IPC surface into React components.
 * Provides methods to check limits, query counts, and record usage.
 */
export function useUsage() {
    const [usageCount, setUsageCount] = useState<number | null>(null);
    const [limitResult, setLimitResult] = useState<UsageLimitResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const checkLimit = useCallback(async (provider: string, model: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.electron.usage.checkLimit(provider, model);
            if (mountedRef.current) {
                setLimitResult(result);
            }
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (mountedRef.current) {
                setError(message);
            }
            return undefined;
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    const getUsageCount = useCallback(async (period: UsagePeriod, provider?: string, model?: string) => {
        setError(null);
        try {
            const count = await window.electron.usage.getUsageCount(period, provider, model);
            if (mountedRef.current) {
                setUsageCount(count);
            }
            return count;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (mountedRef.current) {
                setError(message);
            }
            return undefined;
        }
    }, []);

    const recordUsage = useCallback(async (provider: string, model: string) => {
        setError(null);
        try {
            await window.electron.usage.recordUsage(provider, model);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (mountedRef.current) {
                setError(message);
            }
        }
    }, []);

    return { usageCount, limitResult, loading, error, checkLimit, getUsageCount, recordUsage };
}
