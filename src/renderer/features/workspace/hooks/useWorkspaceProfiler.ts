/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@system/utils/renderer-logger';
import { useCallback, useRef } from 'react';

const IS_DEV = process.env.NODE_ENV === 'development';

/** Threshold in ms above which a render is considered slow and logged as a warning. */
const SLOW_RENDER_THRESHOLD_MS = 16;

/** Maximum number of entries kept per component to avoid unbounded growth. */
const MAX_ENTRIES = 50;

interface RenderEntry {
    timestamp: number;
    phase: 'mount' | 'update' | 'nested-update';
    actualDuration: number;
    baseDuration: number;
}

interface ProfilerMetrics {
    /** Total number of renders observed. */
    renderCount: number;
    /** Average actual render duration in ms. */
    averageDuration: number;
    /** Max actual render duration in ms. */
    maxDuration: number;
    /** Number of renders that exceeded the slow threshold. */
    slowRenderCount: number;
}

/**
 * Provides a React.Profiler onRender callback and metrics accessor for workspace sub-sections.
 * Only collects data in development mode; no-op in production.
 */
export function useWorkspaceProfiler() {
    const metricsMap = useRef<Map<string, RenderEntry[]>>(new Map());

    const onRender = useCallback(
        (
            id: string,
            phase: 'mount' | 'update' | 'nested-update',
            actualDuration: number,
            baseDuration: number,
        ) => {
            if (!IS_DEV) { return; }

            let entries = metricsMap.current.get(id);
            if (!entries) {
                entries = [];
                metricsMap.current.set(id, entries);
            }

            if (entries.length >= MAX_ENTRIES) {
                entries.shift();
            }

            entries.push({ timestamp: Date.now(), phase, actualDuration, baseDuration });

            if (actualDuration > SLOW_RENDER_THRESHOLD_MS) {
                appLogger.warn('WorkspaceProfiler', `Slow render: ${id} (${phase}) took ${actualDuration.toFixed(1)}ms`);
            }
        },
        [],
    );

    const getMetrics = useCallback((id: string): ProfilerMetrics | null => {
        const entries = metricsMap.current.get(id);
        if (!entries || entries.length === 0) { return null; }

        const durations = entries.map(e => e.actualDuration);
        const total = durations.reduce((sum, d) => sum + d, 0);
        return {
            renderCount: entries.length,
            averageDuration: total / entries.length,
            maxDuration: Math.max(...durations),
            slowRenderCount: durations.filter(d => d > SLOW_RENDER_THRESHOLD_MS).length,
        };
    }, []);

    const getAllMetrics = useCallback((): Record<string, ProfilerMetrics> => {
        const result: Record<string, ProfilerMetrics> = {};
        for (const [id] of metricsMap.current) {
            const m = getMetrics(id);
            if (m) { result[id] = m; }
        }
        return result;
    }, [getMetrics]);

    return { onRender, getMetrics, getAllMetrics };
}

