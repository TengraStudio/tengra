/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Columns2, Rows2, X } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { SplitAnalytics, SplitPreset, SplitViewState } from '../utils/split-config';

/* Batch-02: Extracted Long Classes */
const C_TERMINALSPLITCONTROLS_1 = "px-2 py-1 rounded border border-border text-11 hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const C_TERMINALSPLITCONTROLS_2 = "flex-1 px-1.5 py-0.5 rounded-sm text-left typo-caption hover:bg-accent/50 transition-colors flex items-center justify-between gap-2";
const C_TERMINALSPLITCONTROLS_3 = "px-1.5 py-0.5 rounded text-10 border border-border/60 text-muted-foreground hover:text-destructive hover:bg-destructive/10";


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
}: TerminalSplitControlsProps) {
    return (
        <>
            <Popover open={isSplitPresetMenuOpen} onOpenChange={setIsSplitPresetMenuOpen}>
                <PopoverTrigger asChild>
                    <button
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title={t('terminal.splitPresetsTitle')}
                    >
                        <Rows2 className="w-3.5 h-3.5" />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={8}
                    className="w-260 p-2 bg-popover border border-border rounded-lg space-y-2"
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-10 text-muted-foreground">
                            {t('terminal.splitPresetsLabel')}
                        </div>
                        <button
                            onClick={saveCurrentSplitAsPreset}
                            disabled={!splitView}
                            className={C_TERMINALSPLITCONTROLS_1}
                        >
                            {t('terminal.saveCurrent')}
                        </button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                        {splitPresetOptions.map(preset => (
                            <div
                                key={preset.id}
                                className="w-full rounded-sm border border-border/50 bg-background/30 px-1 py-1 flex items-center gap-1"
                            >
                                <button
                                    onClick={() => {
                                        applySplitPreset(preset);
                                    }}
                                    className={C_TERMINALSPLITCONTROLS_2}
                                >
                                    <span className="truncate">{preset.name}</span>
                                    <span className="text-10 text-muted-foreground capitalize">
                                        {preset.orientation}
                                    </span>
                                </button>
                                {preset.source === 'custom' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                renameSplitPreset(preset.id);
                                            }}
                                            className="px-1.5 py-0.5 rounded text-10 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                                            title={t('terminal.renamePresetTitle')}
                                        >
                                            {t('terminal.editShort')}
                                        </button>
                                        <button
                                            onClick={() => {
                                                deleteSplitPreset(preset.id);
                                            }}
                                            className={C_TERMINALSPLITCONTROLS_3}
                                            title={t('terminal.deletePresetTitle')}
                                        >
                                            {t('terminal.deleteShort')}
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="pt-1 border-t border-border/50 space-y-0.5 text-10 text-muted-foreground">
                        <div>{t('terminal.analyticsCreated')}: {splitAnalytics.splitCreatedCount}</div>
                        <div>{t('terminal.analyticsClosed')}: {splitAnalytics.splitClosedCount}</div>
                        <div>
                            {t('terminal.analyticsOrientationToggles')}: {splitAnalytics.splitOrientationToggleCount}
                        </div>
                        <div>{t('terminal.analyticsPresetsApplied')}: {splitAnalytics.splitPresetApplyCount}</div>
                        <div className="pt-1 flex items-center justify-between gap-2">
                            <span>
                                {t('terminal.analyticsLastAction')}:{' '}
                                {splitAnalytics.lastSplitActionAt
                                    ? new Date(splitAnalytics.lastSplitActionAt).toLocaleTimeString()
                                    : t('terminal.notAvailable')}
                            </span>
                            <button
                                onClick={resetSplitAnalytics}
                                className="px-1.5 py-0.5 rounded border border-border/60 text-10 hover:bg-accent/40"
                            >
                                {t('common.reset')}
                            </button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
            {splitView && (
                <>
                    <button
                        onClick={toggleSynchronizedInput}
                        className={cn(
                            'px-1.5 py-1 text-10 font-semibold rounded border transition-colors',
                            isSynchronizedInputEnabled
                                ? 'border-primary/60 text-primary bg-primary/10'
                                : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/40'
                        )}
                        title={t('terminal.syncInputTitle')}
                    >
                        {t('terminal.syncShort')}
                    </button>
                    <button
                        onClick={toggleSplitOrientation}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title={t('terminal.toggleSplitOrientation')}
                    >
                        {splitView.orientation === 'vertical' ? (
                            <Rows2 className="w-3.5 h-3.5" />
                        ) : (
                            <Columns2 className="w-3.5 h-3.5" />
                        )}
                    </button>
                    <button
                        onClick={closeSplitView}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title={t('terminal.closeSplit')}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </>
            )}
        </>
    );
}
