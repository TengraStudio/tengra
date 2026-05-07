/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconColumns2, IconLayoutRows } from '@tabler/icons-react';

import type { SplitAnalytics, SplitPreset, SplitViewState } from '../utils/split-config';

interface TerminalSplitControlsProps {
    t: (key: string, options?: Record<string, string | number>) => string;
    isSplitPresetMenuOpen: boolean;
    setIsSplitPresetMenuOpen: (value: boolean) => void;
    splitView: SplitViewState | null;
    splitPresetOptions: SplitPreset[];
    splitAnalytics: SplitAnalytics;
    isSynchronizedInputEnabled: boolean;
    saveCurrentSplitAsPreset: () => void;
    applySplitPreset: (preset: SplitPreset) => void;
    renameSplitPreset: (presetId: string) => void;
    deleteSplitPreset: (presetId: string) => void;
    resetSplitAnalytics: () => void;
    toggleSynchronizedInput: () => void;
    toggleSplitOrientation: () => void;
    closeSplitView: () => void;
    handleSplitDown: () => void;
    handleSplitUp: () => void;
}

export function TerminalSplitControls({
    t,
    isSplitPresetMenuOpen,
    setIsSplitPresetMenuOpen,
    splitView,
    splitPresetOptions,
    splitAnalytics,
    isSynchronizedInputEnabled,
    saveCurrentSplitAsPreset,
    applySplitPreset,
    renameSplitPreset,
    deleteSplitPreset,
    resetSplitAnalytics,
    toggleSynchronizedInput,
    toggleSplitOrientation,
    closeSplitView,
    handleSplitDown,
    handleSplitUp,
}: TerminalSplitControlsProps) {
    void isSplitPresetMenuOpen;
    void setIsSplitPresetMenuOpen;
    void splitPresetOptions;
    void splitAnalytics;
    void isSynchronizedInputEnabled;
    void saveCurrentSplitAsPreset;
    void renameSplitPreset;
    void deleteSplitPreset;
    void resetSplitAnalytics;
    void toggleSynchronizedInput;
    void toggleSplitOrientation;
    void closeSplitView;
    void applySplitPreset;
    void splitView;

    return (
        <>
            <button
                type="button"
                onClick={handleSplitUp}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                title={t('frontend.terminal.splitPresetsTitle')}
            >
                <IconColumns2 className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={handleSplitDown}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                title={t('frontend.terminal.splitPresetsTitle')}
            >
                <IconLayoutRows className="w-3.5 h-3.5" />
            </button>
        </>
    );
}

