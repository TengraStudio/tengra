import { Palette } from 'lucide-react';
import type { ChangeEventHandler, Ref } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { ResolvedTerminalAppearance, TerminalAppearancePreferences } from '../types/terminal-appearance';
import type { TerminalShortcutPresetId } from '../utils/shortcut-config';

import { TerminalShortcutModals } from './TerminalShortcutModals';

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
                        <Palette className="w-3.5 h-3.5" />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={8}
                    className="tw-w-300 p-2 bg-popover border border-border rounded-lg space-y-2"
                >
                    <div className="tw-text-10 text-muted-foreground">
                        {t('terminal.theme')}
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1">
                        {themePresets.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => {
                                    applyAppearancePatch({ themePresetId: preset.id });
                                }}
                                className="w-full px-2 py-1 rounded-sm text-left typo-caption hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                            >
                                <span className="truncate">{preset.name}</span>
                                <span className="tw-text-10 text-muted-foreground">
                                    {themeCategoryLabel(preset)}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div
                        className="rounded border border-border/50 p-1.5 tw-text-10 font-mono overflow-hidden"
                        style={{
                            backgroundColor: resolvedTerminalAppearance.theme.background,
                            color: resolvedTerminalAppearance.theme.foreground,
                            fontFamily: resolvedTerminalAppearance.fontFamily,
                            fontSize: `${Math.min(terminalAppearance.fontSize, 11)}px`,
                            lineHeight: terminalAppearance.lineHeight,
                        }}
                    >
                        <div>{t('terminal.previewCommand')}</div>
                        <div style={{ color: resolvedTerminalAppearance.theme.green }}>{t('terminal.previewSuccess')}</div>
                        <div style={{ color: resolvedTerminalAppearance.theme.red }}>{t('terminal.previewError')}</div>
                        <div style={{ color: resolvedTerminalAppearance.theme.yellow }}>{t('terminal.previewWarning')}</div>
                    </div>
                    <div className="tw-text-10 text-muted-foreground">
                        {t('terminal.font')}
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
                        <span>{t('terminal.fontLigatures')}</span>
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
                        <div className="tw-text-10 text-muted-foreground">
                            {t('terminal.cursorStyle')}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {cursorStyles.map(cursorStyle => (
                                <button
                                    key={cursorStyle.id}
                                    onClick={() => {
                                        applyAppearancePatch({ cursorStyle: cursorStyle.id });
                                    }}
                                    className={cn(
                                        'px-2 py-1 rounded-sm tw-text-11 border transition-colors',
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
                        <span>{t('terminal.cursorBlink')}</span>
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
                            {t('terminal.fontSize')}
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
                            {t('terminal.lineHeight')}
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
                            {t('terminal.transparency')}
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
                        <span className="w-20 shrink-0 text-muted-foreground">{t('terminal.blur')}</span>
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
                        <div className="tw-text-10 text-muted-foreground">
                            {t('terminal.customTheme')}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <label className="flex items-center gap-1.5 tw-text-11">
                                <input
                                    type="color"
                                    value={terminalAppearance.customTheme?.background ?? '#1e1e1e'}
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
                                <span className="text-muted-foreground">{t('terminal.colorBackground')}</span>
                            </label>
                            <label className="flex items-center gap-1.5 tw-text-11">
                                <input
                                    type="color"
                                    value={terminalAppearance.customTheme?.foreground ?? '#d4d4d4'}
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
                                <span className="text-muted-foreground">{t('terminal.colorForeground')}</span>
                            </label>
                            <label className="flex items-center gap-1.5 tw-text-11">
                                <input
                                    type="color"
                                    value={terminalAppearance.customTheme?.cursor ?? '#d4d4d4'}
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
                                <span className="text-muted-foreground">{t('terminal.colorCursor')}</span>
                            </label>
                            <label className="flex items-center gap-1.5 tw-text-11">
                                <input
                                    type="color"
                                    value={
                                        terminalAppearance.customTheme?.selectionBackground ??
                                        '#264f78'
                                    }
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
                                <span className="text-muted-foreground">{t('terminal.colorSelection')}</span>
                            </label>
                        </div>
                        {terminalAppearance.customTheme && (
                            <button
                                onClick={() => {
                                    applyAppearancePatch({ customTheme: null });
                                }}
                                className="w-full px-2 py-1 rounded border border-border tw-text-11 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                            >
                                {t('terminal.resetToDefault')}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/60">
                        <button
                            onClick={exportAppearancePreferences}
                            className="px-2 py-1 rounded border border-border typo-caption hover:bg-accent/50 transition-colors"
                        >
                            {t('terminal.exportTheme')}
                        </button>
                        <button
                            onClick={openAppearanceImportDialog}
                            className="px-2 py-1 rounded border border-border typo-caption hover:bg-accent/50 transition-colors"
                        >
                            {t('terminal.importTheme')}
                        </button>
                    </div>
                </PopoverContent>
            </Popover>
        </>
    );
}
