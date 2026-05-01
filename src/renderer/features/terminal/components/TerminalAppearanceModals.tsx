/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconPalette } from '@tabler/icons-react';
import type { ChangeEventHandler, Ref } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/hooks/useTheme';
import { resolveCssColorValueAsHex, resolveCssColorVariable } from '@/lib/theme-css';
import { cn } from '@/lib/utils';

import type { ResolvedTerminalAppearance, TerminalAppearancePreferences } from '../types/terminal-appearance';
import type { TerminalShortcutPresetId } from '../utils/shortcut-config';

import { TerminalShortcutModals } from './TerminalShortcutModals';

/* Batch-02: Extracted Long Classes */
const C_TERMINALAPPEARANCEMODALS_1 = "w-full px-2 py-1 rounded-sm text-left typo-caption hover:bg-accent/50 transition-colors flex items-center justify-between gap-2";
const C_TERMINALAPPEARANCEMODALS_2 = "w-full px-2 py-1 rounded border border-border typo-overline text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors";


interface ThemePreset {
    id: string;
    name: string;
    category: 'default' | 'community';
    theme: object;
}

interface FontPreset {
    id: string;
    name: string;
}

interface CursorStyleOption {
    id: TerminalAppearancePreferences['cursorStyle'];
    name: string;
}

interface TerminalAppearanceModalsProps {
    inputRef: Ref<HTMLInputElement>;
    onImport: ChangeEventHandler<HTMLInputElement>;
    isAppearanceMenuOpen: boolean;
    setIsAppearanceMenuOpen: (open: boolean) => void;
    title: string;
    t: (key: string, options?: Record<string, string | number>) => string;
    terminalAppearance: TerminalAppearancePreferences;
    resolvedTerminalAppearance: ResolvedTerminalAppearance;
    themePresets: ThemePreset[];
    fontPresets: FontPreset[];
    cursorStyles: CursorStyleOption[];
    themeCategoryLabel: (preset: ThemePreset) => string;
    applyAppearancePatch: (patch: Partial<TerminalAppearancePreferences>) => void;
    exportAppearancePreferences: () => void;
    openAppearanceImportDialog: () => void;
    shortcutInputRef: Ref<HTMLInputElement>;
    onShortcutImport: ChangeEventHandler<HTMLInputElement>;
    shortcutPreset: TerminalShortcutPresetId;
    applyShortcutPreset: (presetId: TerminalShortcutPresetId) => void;
    exportShortcutPreferences: () => void;
    openShortcutImportDialog: () => void;
    shareShortcutPreferences: () => Promise<void>;
    importShortcutShareCode: () => void;
}

export function TerminalAppearanceModals({
    inputRef,
    onImport,
    isAppearanceMenuOpen,
    setIsAppearanceMenuOpen,
    title,
    t,
    terminalAppearance,
    resolvedTerminalAppearance,
    themePresets,
    fontPresets,
    cursorStyles,
    themeCategoryLabel,
    applyAppearancePatch,
    exportAppearancePreferences,
    openAppearanceImportDialog,
    shortcutInputRef,
    onShortcutImport,
    shortcutPreset,
    applyShortcutPreset,
    exportShortcutPreferences,
    openShortcutImportDialog,
    shareShortcutPreferences,
    importShortcutShareCode,
}: TerminalAppearanceModalsProps) {
    useTheme();

    const previewBackground =
        resolvedTerminalAppearance.theme.background && resolvedTerminalAppearance.theme.background !== 'transparent'
            ? resolvedTerminalAppearance.theme.background
            : resolveCssColorVariable('terminal-preview-background', 'hsl(222 27% 12%)');
    const backgroundPickerValue = terminalAppearance.customTheme?.background
        ?? resolveCssColorValueAsHex(previewBackground, 'black');
    const foregroundPickerValue = terminalAppearance.customTheme?.foreground
        ?? resolveCssColorValueAsHex(
            resolvedTerminalAppearance.theme.foreground ?? 'hsl(215 32% 88%)',
            'white'
        );
    const cursorPickerValue = terminalAppearance.customTheme?.cursor
        ?? resolveCssColorValueAsHex(
            resolvedTerminalAppearance.theme.cursor ?? resolvedTerminalAppearance.theme.foreground ?? 'hsl(215 32% 88%)',
            'white'
        );
    const selectionPickerValue = terminalAppearance.customTheme?.selectionBackground
        ?? resolveCssColorValueAsHex(
            resolvedTerminalAppearance.theme.selectionBackground
                ?? resolveCssColorVariable('terminal-selection-background', 'hsl(209 50% 31%)'),
            'hsl(209 50% 31%)'
        );

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onImport}
            />
            <Popover open={isAppearanceMenuOpen} onOpenChange={setIsAppearanceMenuOpen}>
                <PopoverTrigger asChild>
                    <button
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title={title}
                    >
                        <IconPalette className="w-3.5 h-3.5" />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={8}
                    className="w-300 p-2 bg-popover border border-border rounded-lg space-y-2"
                >
                    <div className="typo-overline text-muted-foreground">
                        {t('frontend.terminal.theme')}
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1">
                        {themePresets.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => {
                                    applyAppearancePatch({ themePresetId: preset.id });
                                }}
                                className={C_TERMINALAPPEARANCEMODALS_1}
                            >
                                <span className="truncate">{preset.name}</span>
                                <span className="typo-overline text-muted-foreground">
                                    {themeCategoryLabel(preset)}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div
                        className="rounded border border-border/50 p-1.5 typo-overline font-mono overflow-hidden"
                        style={{
                            backgroundColor: previewBackground,
                            color: resolvedTerminalAppearance.theme.foreground,
                            fontFamily: resolvedTerminalAppearance.fontFamily,
                            fontSize: `${Math.min(terminalAppearance.fontSize, 11)}px`,
                            lineHeight: terminalAppearance.lineHeight,
                        }}
                    >
                        <div>{t('frontend.terminal.previewCommand')}</div>
                        <div style={{ color: resolvedTerminalAppearance.theme.green }}>{t('frontend.terminal.previewSuccess')}</div>
                        <div style={{ color: resolvedTerminalAppearance.theme.red }}>{t('frontend.terminal.previewError')}</div>
                        <div style={{ color: resolvedTerminalAppearance.theme.yellow }}>{t('frontend.terminal.previewWarning')}</div>
                    </div>
                    <div className="typo-overline text-muted-foreground">
                        {t('frontend.terminal.font')}
                    </div>
                    <div className="space-y-1">
                        {fontPresets.map(fontPreset => (
                            <button
                                key={fontPreset.id}
                                onClick={() => {
                                    applyAppearancePatch({ fontPresetId: fontPreset.id });
                                }}
                                className={cn(
                                    'w-full px-2 py-1 rounded-sm text-left typo-caption hover:bg-accent/50 transition-colors',
                                    terminalAppearance.fontPresetId === fontPreset.id && 'bg-accent/40'
                                )}
                            >
                                {fontPreset.name}
                            </button>
                        ))}
                    </div>
                    <label className="flex items-center justify-between gap-3 typo-caption">
                        <span>{t('frontend.terminal.fontLigatures')}</span>
                        <input
                            type="checkbox"
                            checked={terminalAppearance.ligatures}
                            onChange={event => {
                                applyAppearancePatch({ ligatures: event.target.checked });
                            }}
                            className="h-3.5 w-3.5 rounded border-border bg-background"
                        />
                    </label>
                    <div className="pt-1 border-t border-border/50 space-y-1">
                        <div className="typo-overline text-muted-foreground">
                            {t('frontend.terminal.cursorStyle')}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {cursorStyles.map(cursorStyle => (
                                <button
                                    key={cursorStyle.id}
                                    onClick={() => {
                                        applyAppearancePatch({ cursorStyle: cursorStyle.id });
                                    }}
                                    className={cn(
                                        'px-2 py-1 rounded-sm typo-overline border transition-colors',
                                        terminalAppearance.cursorStyle === cursorStyle.id
                                            ? 'bg-accent border-border text-foreground'
                                            : 'bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/30'
                                    )}
                                >
                                    {cursorStyle.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="flex items-center justify-between gap-3 typo-caption">
                        <span>{t('frontend.terminal.cursorBlink')}</span>
                        <input
                            type="checkbox"
                            checked={terminalAppearance.cursorBlink}
                            onChange={event => {
                                applyAppearancePatch({ cursorBlink: event.target.checked });
                            }}
                            className="h-3.5 w-3.5 rounded border-border bg-background"
                        />
                    </label>
                    <label className="flex items-center gap-2 typo-caption">
                        <span className="w-20 shrink-0 text-muted-foreground">
                            {t('frontend.terminal.fontSize')}
                        </span>
                        <input
                            type="range"
                            min={8}
                            max={32}
                            step={1}
                            value={terminalAppearance.fontSize}
                            onChange={event => {
                                applyAppearancePatch({ fontSize: Number(event.target.value) });
                            }}
                            className="flex-1"
                        />
                        <span className="w-6 text-right text-muted-foreground">
                            {terminalAppearance.fontSize}
                        </span>
                    </label>
                    <label className="flex items-center gap-2 typo-caption">
                        <span className="w-20 shrink-0 text-muted-foreground">
                            {t('frontend.terminal.lineHeight')}
                        </span>
                        <input
                            type="range"
                            min={1}
                            max={2}
                            step={0.1}
                            value={terminalAppearance.lineHeight}
                            onChange={event => {
                                applyAppearancePatch({ lineHeight: Number(event.target.value) });
                            }}
                            className="flex-1"
                        />
                        <span className="w-6 text-right text-muted-foreground">
                            {terminalAppearance.lineHeight.toFixed(1)}
                        </span>
                    </label>
                    <TerminalShortcutModals
                        t={t}
                        inputRef={shortcutInputRef}
                        onImport={onShortcutImport}
                        shortcutPreset={shortcutPreset}
                        applyShortcutPreset={applyShortcutPreset}
                        exportShortcutPreferences={exportShortcutPreferences}
                        openImportDialog={openShortcutImportDialog}
                        shareShortcutPreferences={shareShortcutPreferences}
                        importShortcutShareCode={importShortcutShareCode}
                    />
                    <label className="flex items-center gap-2 typo-caption">
                        <span className="w-20 shrink-0 text-muted-foreground">
                            {t('frontend.terminal.transparency')}
                        </span>
                        <input
                            type="range"
                            min={0.6}
                            max={1}
                            step={0.02}
                            value={terminalAppearance.surfaceOpacity}
                            onChange={event => {
                                applyAppearancePatch({ surfaceOpacity: Number(event.target.value) });
                            }}
                            className="flex-1"
                        />
                    </label>
                    <label className="flex items-center gap-2 typo-caption">
                        <span className="w-20 shrink-0 text-muted-foreground">{t('frontend.terminal.blur')}</span>
                        <input
                            type="range"
                            min={0}
                            max={24}
                            step={1}
                            value={terminalAppearance.surfaceBlur}
                            onChange={event => {
                                applyAppearancePatch({ surfaceBlur: Number(event.target.value) });
                            }}
                            className="flex-1"
                        />
                    </label>
                    <div className="pt-1 border-t border-border/50 space-y-1">
                        <div className="typo-overline text-muted-foreground">
                            {t('frontend.terminal.customTheme')}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <label className="flex items-center gap-1.5 typo-overline">
                                <input
                                    type="color"
                                    value={backgroundPickerValue}
                                    onChange={event => {
                                        applyAppearancePatch({
                                            customTheme: {
                                                ...terminalAppearance.customTheme,
                                                background: event.target.value,
                                            },
                                        });
                                    }}
                                    className="w-5 h-5 rounded border border-border cursor-pointer"
                                />
                                <span className="text-muted-foreground">{t('frontend.terminal.colorBackground')}</span>
                            </label>
                            <label className="flex items-center gap-1.5 typo-overline">
                                <input
                                    type="color"
                                    value={foregroundPickerValue}
                                    onChange={event => {
                                        applyAppearancePatch({
                                            customTheme: {
                                                ...terminalAppearance.customTheme,
                                                foreground: event.target.value,
                                            },
                                        });
                                    }}
                                    className="w-5 h-5 rounded border border-border cursor-pointer"
                                />
                                <span className="text-muted-foreground">{t('frontend.terminal.colorForeground')}</span>
                            </label>
                            <label className="flex items-center gap-1.5 typo-overline">
                                <input
                                    type="color"
                                    value={cursorPickerValue}
                                    onChange={event => {
                                        applyAppearancePatch({
                                            customTheme: {
                                                ...terminalAppearance.customTheme,
                                                cursor: event.target.value,
                                            },
                                        });
                                    }}
                                    className="w-5 h-5 rounded border border-border cursor-pointer"
                                />
                                <span className="text-muted-foreground">{t('frontend.terminal.colorCursor')}</span>
                            </label>
                            <label className="flex items-center gap-1.5 typo-overline">
                                <input
                                    type="color"
                                    value={selectionPickerValue}
                                    onChange={event => {
                                        applyAppearancePatch({
                                            customTheme: {
                                                ...terminalAppearance.customTheme,
                                                selectionBackground: event.target.value,
                                            },
                                        });
                                    }}
                                    className="w-5 h-5 rounded border border-border cursor-pointer"
                                />
                                <span className="text-muted-foreground">{t('frontend.terminal.colorSelection')}</span>
                            </label>
                        </div>
                        {terminalAppearance.customTheme && (
                            <button
                                onClick={() => {
                                    applyAppearancePatch({ customTheme: null });
                                }}
                                className={C_TERMINALAPPEARANCEMODALS_2}
                            >
                                {t('frontend.terminal.resetToDefault')}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/60">
                        <button
                            onClick={exportAppearancePreferences}
                            className="px-2 py-1 rounded border border-border typo-caption hover:bg-accent/50 transition-colors"
                        >
                            {t('frontend.terminal.exportTheme')}
                        </button>
                        <button
                            onClick={openAppearanceImportDialog}
                            className="px-2 py-1 rounded border border-border typo-caption hover:bg-accent/50 transition-colors"
                        >
                            {t('frontend.terminal.importTheme')}
                        </button>
                    </div>
                </PopoverContent>
            </Popover>
        </>
    );
}
