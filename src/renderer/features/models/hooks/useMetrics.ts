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

/** Provider-level stats returned by the metrics bridge */
interface ProviderStats {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgLatencyMs: number;
}

/** Aggregate summary returned by the metrics bridge */
interface MetricsSummary {
    totalRequests: number;
    successRate: number;
    avgLatencyMs: number;
    providers: string[];
}

/**
 * Hook that wires the metrics IPC surface into React components.
 * Provides methods to query provider stats, summaries, and reset metrics.
 */
export function useMetrics() {
    const [summary, setSummary] = useState<MetricsSummary | null>(null);
    const [providerStats, setProviderStats] = useState<Record<string, ProviderStats>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchSummary = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.electron.metrics.getSummary();
            if (mountedRef.current) {
                setSummary(result);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (mountedRef.current) {
                setError(message);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    const fetchProviderStats = useCallback(async (provider?: string) => {
        setError(null);
        try {
            const result = await window.electron.metrics.getProviderStats(provider);
            if (mountedRef.current) {
                setProviderStats(result);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (mountedRef.current) {
                setError(message);
            }
        }
    }, []);

    const reset = useCallback(async () => {
        setError(null);
        try {
            await window.electron.metrics.reset();
            if (mountedRef.current) {
                setSummary(null);
                setProviderStats({});
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (mountedRef.current) {
                setError(message);
            }
        }
    }, []);

    return { summary, providerStats, loading, error, fetchSummary, fetchProviderStats, reset };
}

