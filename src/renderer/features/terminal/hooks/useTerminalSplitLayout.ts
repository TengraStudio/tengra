/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useState } from 'react';

import type { TerminalTab } from '@/types';

import {
    DEFAULT_SPLIT_ANALYTICS,
    sanitizeSplitAnalytics,
    sanitizeSplitLayout,
    sanitizeSplitPresets,
    serializeSplitPresets,
    type SplitAnalytics,
    type SplitPreset,
    type SplitViewState,
} from '../utils/split-config';

interface UseTerminalSplitLayoutOptions {
    tabs: TerminalTab[];
    syncInputStorageKey: string;
    splitPresetsStorageKey: string;
    splitLayoutStorageKey: string;
    splitAnalyticsStorageKey: string;
    splitPresetLimit: number;
}

function loadSyncInputEnabled(storageKey: string): boolean {
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
            return false;
        }
        const parsed = JSON.parse(raw) as { enabled?: RendererDataValue };
        return typeof parsed.enabled === 'boolean' ? parsed.enabled : false;
    } catch {
        return false;
    }
}

function loadSplitPresets(storageKey: string, splitPresetLimit: number): SplitPreset[] {
    try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return sanitizeSplitPresets(parsed, splitPresetLimit);
    } catch {
        return [];
    }
}

function loadSplitAnalytics(storageKey: string): SplitAnalytics {
    try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : null;
        return sanitizeSplitAnalytics(parsed);
    } catch {
        return DEFAULT_SPLIT_ANALYTICS;
    }
}

function loadSplitLayout(storageKey: string, tabs: TerminalTab[]): SplitViewState | null {
    if (tabs.length < 2) {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : null;
        return sanitizeSplitLayout(parsed, new Set(tabs.map(tab => tab.id)));
    } catch {
        return null;
    }
}

export function useTerminalSplitLayout({
    tabs,
    syncInputStorageKey,
    splitPresetsStorageKey,
    splitLayoutStorageKey,
    splitAnalyticsStorageKey,
    splitPresetLimit,
}: UseTerminalSplitLayoutOptions) {
    const [splitView, setSplitView] = useState<SplitViewState | null>(() =>
        loadSplitLayout(splitLayoutStorageKey, tabs)
    );
    const [splitFocusedPane, setSplitFocusedPane] = useState<'primary' | 'secondary'>('primary');
    const [isSynchronizedInputEnabled, setIsSynchronizedInputEnabled] = useState<boolean>(() =>
        loadSyncInputEnabled(syncInputStorageKey)
    );
    const [isSplitPresetMenuOpen, setIsSplitPresetMenuOpen] = useState(false);
    const [splitPresets, setSplitPresets] = useState<SplitPreset[]>(() =>
        loadSplitPresets(splitPresetsStorageKey, splitPresetLimit)
    );
    const [splitAnalytics, setSplitAnalytics] = useState<SplitAnalytics>(() =>
        loadSplitAnalytics(splitAnalyticsStorageKey)
    );

    useEffect(() => {
        try {
            window.localStorage.setItem(
                syncInputStorageKey,
                JSON.stringify({ enabled: isSynchronizedInputEnabled })
            );
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [isSynchronizedInputEnabled, syncInputStorageKey]);

    useEffect(() => {
        try {
            const serialized = serializeSplitPresets(splitPresets, splitPresetLimit);
            window.localStorage.setItem(splitPresetsStorageKey, JSON.stringify(serialized));
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [splitPresetLimit, splitPresets, splitPresetsStorageKey]);

    useEffect(() => {
        try {
            window.localStorage.setItem(splitAnalyticsStorageKey, JSON.stringify(splitAnalytics));
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [splitAnalytics, splitAnalyticsStorageKey]);

    useEffect(() => {
        if (!splitView) {
            try {
                window.localStorage.removeItem(splitLayoutStorageKey);
            } catch {
                // Ignore localStorage failures in restricted environments.
            }
            return;
        }
        try {
            window.localStorage.setItem(splitLayoutStorageKey, JSON.stringify(splitView));
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [splitLayoutStorageKey, splitView]);

    return {
        splitView,
        setSplitView,
        splitFocusedPane,
        setSplitFocusedPane,
        isSynchronizedInputEnabled,
        setIsSynchronizedInputEnabled,
        isSplitPresetMenuOpen,
        setIsSplitPresetMenuOpen,
        splitPresets,
        setSplitPresets,
        splitAnalytics,
        setSplitAnalytics,
    };
}
