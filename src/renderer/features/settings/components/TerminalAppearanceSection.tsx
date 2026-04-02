import { Label } from '@renderer/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { Switch } from '@renderer/components/ui/switch';
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
import { getTerminalTheme } from '@renderer/lib/terminal-theme';
import React from 'react';

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
                <div className="text-base font-bold text-foreground">
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
                <div style={{ color: resolvedAppearance.theme.green }}>
                    {t('terminal.previewSuccess')}
                </div>
                <div style={{ color: resolvedAppearance.theme.red }}>
                    {t('terminal.previewError')}
                </div>
                <div style={{ color: resolvedAppearance.theme.yellow }}>
                    {t('terminal.previewWarning')}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                        {t('terminal.theme')}
                    </Label>
                    <Select
                        value={terminalAppearance.themePresetId}
                        onValueChange={(value: string) => updateAppearance({ themePresetId: value })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TERMINAL_THEME_PRESETS.map(preset => (
                                <SelectItem key={preset.id} value={preset.id}>
                                    {t(`terminal.themes.${preset.id}`) || preset.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                        {t('terminal.font')}
                    </Label>
                    <Select
                        value={terminalAppearance.fontPresetId}
                        onValueChange={(value: string) => updateAppearance({ fontPresetId: value })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TERMINAL_FONT_PRESETS.map(preset => (
                                <SelectItem key={preset.id} value={preset.id}>
                                    {t(`terminal.fonts.${preset.id}`) || preset.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                        {t('terminal.cursorStyle')}
                    </Label>
                    <Select
                        value={terminalAppearance.cursorStyle}
                        onValueChange={(
                            value: TerminalAppearancePreferences['cursorStyle']
                        ) => updateAppearance({ cursorStyle: value })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TERMINAL_CURSOR_STYLES.map(cursorStyle => (
                                <SelectItem key={cursorStyle.id} value={cursorStyle.id}>
                                    {t(`terminal.cursors.${cursorStyle.id}`) || cursorStyle.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-muted/10 px-4 py-3 transition-colors">
                    <Label
                        htmlFor="ligatures-toggle"
                        className="text-sm font-medium text-muted-foreground cursor-pointer"
                    >
                        {t('terminal.fontLigatures')}
                    </Label>
                    <Switch
                        id="ligatures-toggle"
                        checked={terminalAppearance.ligatures}
                        onCheckedChange={(checked: boolean) =>
                            updateAppearance({ ligatures: checked })
                        }
                    />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-muted/10 px-4 py-3 transition-colors">
                    <Label
                        htmlFor="cursor-blink-toggle"
                        className="text-sm font-medium text-muted-foreground cursor-pointer"
                    >
                        {t('terminal.cursorBlink')}
                    </Label>
                    <Switch
                        id="cursor-blink-toggle"
                        checked={terminalAppearance.cursorBlink}
                        onCheckedChange={(checked: boolean) =>
                            updateAppearance({ cursorBlink: checked })
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="grid gap-4">
                    <Label className="text-xs font-medium text-muted-foreground flex justify-between">
                        <span>{t('terminal.fontSize')}</span>
                        <span className="text-primary font-bold">
                            {terminalAppearance.fontSize}
                        </span>
                    </Label>
                    <Slider
                        min={8}
                        max={32}
                        step={1}
                        value={[terminalAppearance.fontSize]}
                        onValueChange={(values: number[]) =>
                            updateAppearance({ fontSize: values[0] })
                        }
                    />
                </div>
                <div className="grid gap-4">
                    <Label className="text-xs font-medium text-muted-foreground flex justify-between">
                        <span>{t('terminal.lineHeight')}</span>
                        <span className="text-primary font-bold">
                            {terminalAppearance.lineHeight.toFixed(1)}
                        </span>
                    </Label>
                    <Slider
                        min={1}
                        max={2}
                        step={0.1}
                        value={[terminalAppearance.lineHeight]}
                        onValueChange={(values: number[]) =>
                            updateAppearance({ lineHeight: values[0] })
                        }
                    />
                </div>
                <div className="grid gap-4">
                    <Label className="text-xs font-medium text-muted-foreground flex justify-between">
                        <span>{t('terminal.transparency')}</span>
                        <span className="text-primary font-bold">
                            {terminalAppearance.surfaceOpacity.toFixed(2)}
                        </span>
                    </Label>
                    <Slider
                        min={0.6}
                        max={1}
                        step={0.05}
                        value={[terminalAppearance.surfaceOpacity]}
                        onValueChange={(values: number[]) =>
                            updateAppearance({ surfaceOpacity: values[0] })
                        }
                    />
                </div>
                <div className="grid gap-4">
                    <Label className="text-xs font-medium text-muted-foreground flex justify-between">
                        <span>{t('terminal.blur')}</span>
                        <span className="text-primary font-bold">
                            {terminalAppearance.surfaceBlur}
                        </span>
                    </Label>
                    <Slider
                        min={0}
                        max={24}
                        step={1}
                        value={[terminalAppearance.surfaceBlur]}
                        onValueChange={(values: number[]) =>
                            updateAppearance({ surfaceBlur: values[0] })
                        }
                    />
                </div>
            </div>
        </div>
    );
};

