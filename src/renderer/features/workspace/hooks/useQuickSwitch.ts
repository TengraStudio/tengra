/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useMemo, useState } from 'react';

import type { EditorTab } from '@/types';

interface QuickSwitchItem {
    id: string;
    label: string;
    path: string | undefined;
}

/**
 * Encapsulates quick-switch modal and shortcut-help overlay state.
 */
export function useQuickSwitch(openTabs: EditorTab[]) {
    const [showShortcutHelp, setShowShortcutHelp] = useState(false);
    const [showQuickSwitch, setShowQuickSwitch] = useState(false);
    const [quickSwitchQuery, setQuickSwitchQuery] = useState('');
    const [rawQuickSwitchIndex, setQuickSwitchIndex] = useState(0);

    const quickSwitchItems: QuickSwitchItem[] = useMemo(
        () =>
            openTabs
                .map(tab => ({
                    id: tab.id,
                    label: tab.name,
                    path: tab.path,
                }))
                .filter(tab =>
                    `${tab.label} ${tab.path ?? ''}`
                        .toLowerCase()
                        .includes(quickSwitchQuery.trim().toLowerCase())
                )
                .slice(0, 12),
        [quickSwitchQuery, openTabs]
    );

    // Derive a clamped index so we never point past the filtered list
    const quickSwitchIndex = useMemo(() => {
        if (quickSwitchItems.length === 0) {
            return 0;
        }
        return Math.min(rawQuickSwitchIndex, quickSwitchItems.length - 1);
    }, [rawQuickSwitchIndex, quickSwitchItems.length]);

    return {
        showShortcutHelp,
        setShowShortcutHelp,
        showQuickSwitch,
        setShowQuickSwitch,
        quickSwitchQuery,
        setQuickSwitchQuery,
        quickSwitchIndex,
        setQuickSwitchIndex,
        quickSwitchItems,
    };
}

