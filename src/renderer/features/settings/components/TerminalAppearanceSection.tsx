import {
    clamp,
    DEFAULT_TERMINAL_APPEARANCE,
    resolveTerminalAppearance,
    TERMINAL_APPEARANCE_STORAGE_KEY,
    TERMINAL_CURSOR_STYLES,
    TERMINAL_FONT_PRESETS,
    TERMINAL_THEME_PRESETS,
} from '@renderer/features/terminal/constants/terminal-panel-constants';
import { useTerminalAppearance } from '@renderer/features/terminal/hooks/useTerminalAppearance';
import type { TerminalAppearancePreferences } from '@renderer/features/terminal/types/terminal-appearance';
import React from 'react';

import { getTerminalTheme } from '@/lib/terminal-theme';
import { cn } from '@/lib/utils';

interface TerminalAppearanceSectionProps {
    t: (key: string) => string;
}

function applyTerminalAppearancePatch(
    previousValue: TerminalAppearancePreferences,
    patch: Partial<TerminalAppearancePreferences>
): TerminalAppearancePreferences {
    return {
        themePresetId: patch.themePresetId ?? previousValue.themePresetId,
        fontPresetId: patch.fontPresetId ?? previousValue.fontPresetId,
        ligatures: patch.ligatures ?? previousValue.ligatures,
        surfaceOpacity: clamp(patch.surfaceOpacity ?? previousValue.surfaceOpacity, 0.6, 1),
        surfaceBlur: clamp(patch.surfaceBlur ?? previousValue.surfaceBlur, 0, 24),
        cursorStyle: patch.cursorStyle ?? previousValue.cursorStyle,
        cursorBlink: patch.cursorBlink ?? previousValue.cursorBlink,
        fontSize: clamp(patch.fontSize ?? previousValue.fontSize, 8, 32),
        lineHeight: clamp(patch.lineHeight ?? previousValue.lineHeight, 1, 2),
        customTheme: patch.customTheme !== undefined ? patch.customTheme : previousValue.customTheme,
    };
}

export const TerminalAppearanceSection: React.FC<TerminalAppearanceSectionProps> = ({ t }) => {
    const { terminalAppearance, setTerminalAppearance } = useTerminalAppearance({
        storageKey: TERMINAL_APPEARANCE_STORAGE_KEY,
        defaultAppearance: DEFAULT_TERMINAL_APPEARANCE,
    });
    const resolvedAppearance = React.useMemo(
        () => resolveTerminalAppearance(getTerminalTheme(), terminalAppearance),
        [terminalAppearance]
    );

    const updateAppearance = React.useCallback(
        (patch: Partial<TerminalAppearancePreferences>) => {
            setTerminalAppearance(previousValue =>
                applyTerminalAppearancePatch(previousValue, patch)
            );
        },
        [setTerminalAppearance]
    );

    return (
        <div className="premium-glass p-8 space-y-8">
            <div>
                <div className="text-base font-black text-foreground uppercase tracking-tight">
                    {t('terminal.appearance')}
                </div>
                <div className="text-xs font-medium text-muted-foreground/70">
                    {t('tips.tip5')}
                </div>
            </div>

            <div
                className="rounded-2xl border border-border/40 p-4 font-mono text-xs shadow-inner"
                style={{
                    backgroundColor: resolvedAppearance.theme.background,
                    color: resolvedAppearance.theme.foreground,
                    fontFamily: resolvedAppearance.fontFamily,
                    fontSize: `${resolvedAppearance.fontSize}px`,
                    lineHeight: resolvedAppearance.lineHeight,
                    opacity: terminalAppearance.surfaceOpacity,
                    backdropFilter: `blur(${terminalAppearance.surfaceBlur}px)`,
                }}
            >
                <div>{t('terminal.previewCommand')}</div>
                <div style={{ color: resolvedAppearance.theme.green }}>{t('terminal.previewSuccess')}</div>
                <div style={{ color: resolvedAppearance.theme.red }}>{t('terminal.previewError')}</div>
                <div style={{ color: resolvedAppearance.theme.yellow }}>{t('terminal.previewWarning')}</div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                    <span>{t('terminal.theme')}</span>
                    <select
                        value={terminalAppearance.themePresetId}
                        onChange={event => updateAppearance({ themePresetId: event.target.value })}
                        className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm text-foreground"
                    >
                        {TERMINAL_THEME_PRESETS.map(preset => (
                            <option key={preset.id} value={preset.id}>
                                {t(`terminal.themes.${preset.id}`) || preset.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                    <span>{t('terminal.font')}</span>
                    <select
                        value={terminalAppearance.fontPresetId}
                        onChange={event => updateAppearance({ fontPresetId: event.target.value })}
                        className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm text-foreground"
                    >
                        {TERMINAL_FONT_PRESETS.map(preset => (
                            <option key={preset.id} value={preset.id}>
                                {t(`terminal.fonts.${preset.id}`) || preset.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                    <span>{t('terminal.cursorStyle')}</span>
                    <select
                        value={terminalAppearance.cursorStyle}
                        onChange={event =>
                            updateAppearance({
                                cursorStyle: event.target.value as TerminalAppearancePreferences['cursorStyle'],
                            })
                        }
                        className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm text-foreground"
                    >
                        {TERMINAL_CURSOR_STYLES.map(cursorStyle => (
                            <option key={cursorStyle.id} value={cursorStyle.id}>
                                {t(`terminal.cursors.${cursorStyle.id}`) || cursorStyle.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <button
                    type="button"
                    onClick={() => updateAppearance({ ligatures: !terminalAppearance.ligatures })}
                    className={cn(
                        'flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors',
                        terminalAppearance.ligatures
                            ? 'border-primary/40 bg-primary/10 text-foreground'
                            : 'border-border/40 bg-muted/10 text-muted-foreground'
                    )}
                >
                    <span>{t('terminal.fontLigatures')}</span>
                    <span
                        aria-hidden="true"
                        className={cn(
                            'h-2.5 w-2.5 rounded-full border',
                            terminalAppearance.ligatures
                                ? 'border-primary bg-primary'
                                : 'border-border bg-transparent'
                        )}
                    />
                </button>
                <button
                    type="button"
                    onClick={() => updateAppearance({ cursorBlink: !terminalAppearance.cursorBlink })}
                    className={cn(
                        'flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors',
                        terminalAppearance.cursorBlink
                            ? 'border-primary/40 bg-primary/10 text-foreground'
                            : 'border-border/40 bg-muted/10 text-muted-foreground'
                    )}
                >
                    <span>{t('terminal.cursorBlink')}</span>
                    <span
                        aria-hidden="true"
                        className={cn(
                            'h-2.5 w-2.5 rounded-full border',
                            terminalAppearance.cursorBlink
                                ? 'border-primary bg-primary'
                                : 'border-border bg-transparent'
                        )}
                    />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                    <span>{t('terminal.fontSize')}: {terminalAppearance.fontSize}</span>
                    <input
                        type="range"
                        min={8}
                        max={32}
                        step={1}
                        value={terminalAppearance.fontSize}
                        onChange={event => updateAppearance({ fontSize: Number(event.target.value) })}
                    />
                </label>
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                    <span>{t('terminal.lineHeight')}: {terminalAppearance.lineHeight.toFixed(1)}</span>
                    <input
                        type="range"
                        min={1}
                        max={2}
                        step={0.1}
                        value={terminalAppearance.lineHeight}
                        onChange={event => updateAppearance({ lineHeight: Number(event.target.value) })}
                    />
                </label>
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                    <span>{t('terminal.transparency')}: {terminalAppearance.surfaceOpacity.toFixed(2)}</span>
                    <input
                        type="range"
                        min={0.6}
                        max={1}
                        step={0.05}
                        value={terminalAppearance.surfaceOpacity}
                        onChange={event => updateAppearance({ surfaceOpacity: Number(event.target.value) })}
                    />
                </label>
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                    <span>{t('terminal.blur')}: {terminalAppearance.surfaceBlur}</span>
                    <input
                        type="range"
                        min={0}
                        max={24}
                        step={1}
                        value={terminalAppearance.surfaceBlur}
                        onChange={event => updateAppearance({ surfaceBlur: Number(event.target.value) })}
                    />
                </label>
            </div>
        </div>
    );
};
