/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BUILTIN_THEME_MANIFESTS } from '@shared/theme/builtin-theme-manifests';
import type { ThemeManifest } from '@shared/types/theme';
import { IconAccessible, IconDeviceDesktop, IconLuggage, IconMaximize, IconPalette, IconPointer, IconRefresh, IconTerminal, IconTypography } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import {
    clamp,
    DEFAULT_TERMINAL_APPEARANCE,
    resolveTerminalAppearance,
    TERMINAL_APPEARANCE_STORAGE_KEY,
    TERMINAL_CURSOR_STYLES,
    TERMINAL_THEME_PRESETS,
} from '@/features/terminal/constants/terminal-panel-constants';
import { useTerminalAppearance } from '@/features/terminal/hooks/useTerminalAppearance';
import { getTerminalTheme } from '@/lib/terminal-theme';
import { resolveAppFontPreset } from '@/lib/typography-settings';
import { cn } from '@/lib/utils';
import { useA11ySettings } from '@/utils/accessibility';
import { themeIpc } from '@/utils/theme-ipc.util';

import type { SettingsSharedProps } from '../types';

const APPEARANCE_ROW_CLASS = UI_PRIMITIVES.SETTINGS_ROW;
const SECTION_CONTAINER_CLASS = UI_PRIMITIVES.SECTION_CARD;

type AppearanceTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'updateGeneral' | 'updateWindow' | 't'
>;

interface TerminalPreviewProps {
    cursorStyle: 'bar' | 'block' | 'underline';
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    theme: ReturnType<typeof getTerminalTheme>;
    t: (key: string) => string;
}

interface ThemeActionStatus {
    message: string;
    tone: 'success' | 'error';
}

function TerminalPreview({
    cursorStyle,
    fontFamily,
    fontSize,
    lineHeight,
    theme,
    t,
}: TerminalPreviewProps): JSX.Element {
    return (
        <div className="group relative h-72 w-full overflow-hidden rounded-2xl border border-border/40 bg-[#0c0c0c] shadow-2xl transition-all hover:border-border/60">
            {/* Terminal Window Header */}
            <div className="flex h-11 items-center border-b border-white/5 bg-white/[0.03] px-4">
                <div className="flex gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#ff5f56] opacity-80 hover:opacity-100" />
                    <div className="h-3 w-3 rounded-full bg-[#ffbd2e] opacity-80 hover:opacity-100" />
                    <div className="h-3 w-3 rounded-full bg-[#27c93f] opacity-80 hover:opacity-100" />
                </div>
                <div className="ml-4 flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                    <IconTerminal className="h-3 w-3" />
                    <span>zsh — tengra-terminal</span>
                </div>
            </div>

            {/* Terminal Body */}
            <div
                className="h-full overflow-y-auto p-6 font-mono selection:bg-primary/30"
                style={{
                    color: theme.foreground,
                    fontFamily,
                    fontSize: `${fontSize}px`,
                    lineHeight,
                }}
            >
                <div className="space-y-2 opacity-90">
                    <div className="flex flex-wrap items-center gap-x-2">
                        <span style={{ color: theme.cyan }}>➜</span>
                        <span style={{ color: theme.green }}>~</span>
                        <span style={{ color: theme.blue }}>projects/tengra</span>
                        <span className="text-white/30 font-light text-[0.9em]">git:(<span style={{ color: theme.red }}>main</span>)</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span style={{ color: theme.cyan }}>➜</span>
                        <span className="text-white/90">npm run dev</span>
                    </div>

                    <div className="pt-2 text-white/30 text-[0.95em]">
                        {`> tengra@1.0.46 dev`}
                        <br />
                        {`> vite --config vite.config.ts`}
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                        <span style={{ color: theme.green }}>✓</span> 
                        <span className="text-white/80">VITE v8.0.10 ready in 432ms</span>
                    </div>

                    <div className="text-white/50 text-[0.9em]">
                        <span className="opacity-40">  ➜  </span>
                        <span className="font-bold text-white/70">Local:</span>
                        <span className="text-primary/80 underline ml-2 decoration-primary/30">http://localhost:5173/</span>
                    </div>

                    <div className="flex items-center gap-2 pt-3">
                        <span style={{ color: theme.cyan }}>➜</span>
                        <div
                            className={cn(
                                'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]',
                                cursorStyle === 'block' && 'h-[1.2em] w-[0.6em]',
                                cursorStyle === 'underline' && 'mt-[1em] h-[2px] w-[0.6em]',
                                cursorStyle === 'bar' && 'h-[1.2em] w-[2px]',
                                'animate-[terminal-blink_1.2s_step-end_infinite]'
                            )}
                        />
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes terminal-blink {
                    from, to { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}} />
        </div>
    );
}

function LiveAppPreview({ 
    font, 
    fontSize, 
    t 
}: { 
    font: { display: string; sans: string }; 
    fontSize: number; 
    t: (key: string) => string 
}) {
    return (
        <div className="group relative h-72 w-full overflow-hidden rounded-2xl border border-border/40 bg-background shadow-2xl transition-all hover:border-border/60">
            {/* App Header */}
            <div className="flex h-11 items-center border-b border-border/10 bg-muted/20 px-4">
                <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-border/20" />
                    <div className="h-2.5 w-2.5 rounded-full bg-border/20" />
                    <div className="h-2.5 w-2.5 rounded-full bg-border/20" />
                </div>
                <div className="mx-auto text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.3em] select-none">
                    {t('app.name')}
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* App Body (Mini Chat View) */}
            <div className="p-6 space-y-5">
                <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10 shadow-sm">
                         <div className="h-4 w-4 rounded-sm bg-primary/30 animate-pulse" />
                    </div>
                    <div className="space-y-2.5 flex-1 pt-1.5">
                        <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
                        <div className="h-2 w-1/2 rounded-full bg-foreground/5" />
                    </div>
                </div>

                <div className="flex flex-row-reverse items-start gap-4 pt-1">
                    <div className="h-9 w-9 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0 border border-border/10 shadow-sm" />
                    <div className="space-y-2.5 flex-1 pt-1.5 items-end flex flex-col">
                        <div className="h-2 w-2/3 rounded-full bg-primary/15" />
                        <div className="h-2 w-1/3 rounded-full bg-primary/5" />
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border border-border/15 bg-muted/30 p-5 shadow-inner transition-colors group-hover:bg-muted/40">
                    <div 
                        className="text-2xl font-bold text-foreground mb-2 leading-none"
                        style={{ fontFamily: font.display }}
                    >
                        {t('settings.previewHeading')}
                    </div>
                    <div 
                        className="text-sm text-muted-foreground/80 leading-relaxed"
                        style={{ 
                            fontFamily: font.sans,
                            fontSize: `${fontSize}px`
                        }}
                    >
                        {t('settings.previewBody')}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AppearanceRow({
    title,
    description,
    control,
    icon,
}: {
    title: string
    description: string
    control: React.ReactNode
    icon: React.ReactNode
}): JSX.Element {
    return (
        <div className={APPEARANCE_ROW_CLASS}>
            <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {icon}
                    {title}
                </div>
                <div className="max-w-lg typo-caption leading-relaxed text-muted-foreground/70">
                    {description}
                </div>
            </div>
            <div className="w-full sm:w-auto">{control}</div>
        </div>
    );
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
    settings,
    updateGeneral,
    updateWindow,
    t,
}) => {
    const [themes, setThemes] = useState<ThemeManifest[]>([]);
    const [themeActionStatus, setThemeActionStatus] = useState<ThemeActionStatus | null>(null);
    const { settings: a11ySettings, updateSettings } = useA11ySettings();
    const { terminalAppearance, setTerminalAppearance } = useTerminalAppearance({
        storageKey: TERMINAL_APPEARANCE_STORAGE_KEY,
        defaultAppearance: DEFAULT_TERMINAL_APPEARANCE,
    });
    const themeImportInputRef = useRef<HTMLInputElement>(null);

    const refreshThemes = useCallback(async () => {
        try {
            const loadedThemes = await themeIpc.getAllThemes();
            setThemes(loadedThemes.length > 0 ? loadedThemes : BUILTIN_THEME_MANIFESTS);
        } catch {
            setThemes(BUILTIN_THEME_MANIFESTS);
        }
    }, []);

    useEffect(() => {
        void refreshThemes();
    }, [refreshThemes]);

    const availableThemes = themes.length > 0 ? themes : BUILTIN_THEME_MANIFESTS;

    const themeOptions = useMemo(() => {
        const manifestOptions: Array<Pick<ThemeManifest, 'id' | 'displayName' | 'type'>> =
            availableThemes.length > 0
                ? availableThemes
                : BUILTIN_THEME_MANIFESTS;

        return manifestOptions.map(theme => ({
            value: theme.id,
            label: theme.displayName,
            type: theme.type,
        }));
    }, [availableThemes]);

    const typographyScaleOptions = [
        { value: 'compact', label: t('settings.typographyScaleCompact') },
        { value: 'balanced', label: t('settings.typographyScaleBalanced') },
        { value: 'comfortable', label: t('settings.typographyScaleComfortable') },
    ];

    const terminalThemeOptions = TERMINAL_THEME_PRESETS.map(preset => ({
        value: preset.id,
        label: preset.name,
    }));

    const terminalCursorOptions = TERMINAL_CURSOR_STYLES.map(cursorStyle => ({
        value: cursorStyle.id,
        label: cursorStyle.name,
    }));

    const resolvedAppFont = resolveAppFontPreset();
    const resolvedTerminalAppearance = useMemo(
        () => resolveTerminalAppearance(getTerminalTheme(), terminalAppearance),
        [terminalAppearance]
    );
    const currentThemeId = settings?.general.theme ?? 'graphite';
    const currentThemeManifest = useMemo(
        () => availableThemes.find(theme => theme.id === currentThemeId) ?? null,
        [availableThemes, currentThemeId]
    );
    const currentThemeVars = useMemo(
        () => Object.entries(currentThemeManifest?.vars ?? {}),
        [currentThemeManifest]
    );
    const currentThemeColors = useMemo(
        () => Object.entries(currentThemeManifest?.colors ?? {}),
        [currentThemeManifest]
    );
    const currentThemeVarGroups = useMemo(() => {
        const keys = currentThemeVars.map(([key]) => key);
        const layoutVars = keys.filter(key => key.startsWith('tengra-')).length;
        const terminalVars = keys.filter(key => key.startsWith('terminal-')).length;
        const iconVars = keys.filter(key => key.startsWith('icon-')).length;
        const featureVars = keys.length - layoutVars - terminalVars - iconVars;

        return [
            { label: t('settings.themeManifestLayoutVars'), count: layoutVars },
            { label: t('settings.themeManifestTerminalVars'), count: terminalVars },
            { label: t('settings.themeManifestIconVars'), count: iconVars },
            { label: t('settings.themeManifestFeatureVars'), count: featureVars },
        ].filter(group => group.count > 0);
    }, [currentThemeVars, t]);

    const handleImportTheme = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        try {
            const themeManifest = JSON.parse(await file.text()) as ThemeManifest;
            await themeIpc.installTheme(themeManifest);
            await refreshThemes();
            setThemeActionStatus({
                tone: 'success',
                message: t('settings.themeManifestImportSuccess', {
                    name: themeManifest.displayName ?? themeManifest.id,
                }),
            });
        } catch (error) {
            setThemeActionStatus({
                tone: 'error',
                message:
                    error instanceof SyntaxError
                        ? t('settings.themeManifestImportInvalidJson')
                        : t('settings.themeManifestImportFailed'),
            });
        }
    }, [refreshThemes, t]);

    const handleDownloadCurrentTheme = useCallback(() => {
        if (!currentThemeManifest) {
            return;
        }

        const payload = JSON.stringify(currentThemeManifest, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${currentThemeManifest.id}.theme.json`;
        anchor.click();
        URL.revokeObjectURL(url);

        setThemeActionStatus({
            tone: 'success',
            message: t('settings.themeManifestDownloadSuccess', {
                name: currentThemeManifest.displayName,
            }),
        });
    }, [currentThemeManifest, t]);

    const handleOpenThemesDirectory = useCallback(async () => {
        try {
            await themeIpc.openThemesDirectory();
            setThemeActionStatus({
                tone: 'success',
                message: t('settings.themeManifestOpenFolderSuccess'),
            });
        } catch {
            setThemeActionStatus({
                tone: 'error',
                message: t('settings.themeManifestOpenFolderFailed'),
            });
        }
    }, [t]);

    const resolutionOptions = [
        { value: 'auto', label: 'Auto (Recommended)' },
        { value: '1280x720', label: '1280 x 720 (HD)' },
        { value: '1600x900', label: '1600 x 900' },
        { value: '1920x1080', label: '1920 x 1080 (FHD)' },
        { value: '2560x1440', label: '2560 x 1440 (QHD)' },
    ];

    return (
        <div className="space-y-8 pb-16 lg:space-y-10 animate-in fade-in duration-500">
            <input
                ref={themeImportInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportTheme}
            />
            <div className="px-1">
                <div className="mb-3 flex items-center gap-4">
                    <div className={UI_PRIMITIVES.ICON_WRAPPER}>
                        <IconPalette className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-foreground">
                            {t('settings.appearanceTitle')}
                        </h3>
                    </div>
                </div>
                <p className="max-w-2xl px-1 text-sm leading-relaxed text-muted-foreground/70">
                    {t('settings.appearanceDescription')}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-balance-95-105">
                <div className={SECTION_CONTAINER_CLASS}>
                    <div className="flex items-center gap-2 px-1">
                        <IconDeviceDesktop className="h-4 w-4 text-primary/80" />
                        <h4 className="text-sm font-bold uppercase text-muted-foreground/80">
                            {t('settings.interfaceConfiguration')}
                        </h4>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="px-1 text-sm font-semibold text-muted-foreground">
                                {t('settings.theme')}
                            </label>
                            <Select
                                value={settings?.general.theme ?? 'graphite'}
                                onValueChange={value => {
                                    void updateGeneral({ theme: value });
                                }}
                            >
                                <SelectTrigger className={UI_PRIMITIVES.CONTROL_BASE}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/40 bg-background/95 backdrop-blur-md">
                                    {themeOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                            <div className="flex items-center gap-3">
                                                <span className="font-medium">{opt.label}</span>
                                                <Badge variant="outline" className={cn(UI_PRIMITIVES.BADGE_MUTED, "uppercase")}>
                                                    {opt.type}
                                                </Badge>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                            <div className="space-y-2">
                                <label className="px-1 text-sm font-semibold text-muted-foreground">
                                    {t('settings.baseFontSize')}
                                </label>
                                <Input
                                    type="number"
                                    min={12}
                                    max={18}
                                    value={settings?.general.fontSize ?? 14}
                                    onChange={event => {
                                        const parsed = Number.parseInt(event.target.value, 10);
                                        const nextValue = Number.isNaN(parsed) ? 14 : clamp(parsed, 12, 18);
                                        void updateGeneral({ fontSize: nextValue });
                                    }}
                                    className={UI_PRIMITIVES.CONTROL_INPUT}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="px-1 text-sm font-semibold text-muted-foreground">
                                    {t('settings.typographyScale')}
                                </label>
                                <Select
                                    value={settings?.general.typographyScale ?? 'balanced'}
                                    onValueChange={value => {
                                        void updateGeneral({
                                            typographyScale: value as 'compact' | 'balanced' | 'comfortable',
                                        });
                                    }}
                                >
                                    <SelectTrigger className={UI_PRIMITIVES.CONTROL_BASE}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-border/40 bg-background/95 backdrop-blur-md">
                                        {typographyScaleOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={cn(SECTION_CONTAINER_CLASS, "flex flex-col")}>
                    <div className="mb-6 flex items-center gap-2 px-1">
                        <IconTypography className="h-4 w-4 text-primary/80" />
                        <h4 className="text-sm font-bold uppercase text-muted-foreground/80">
                            {t('settings.livePreview')}
                        </h4>
                    </div>

                    <div className="flex-1 flex flex-col justify-center min-w-0">
                        <LiveAppPreview 
                            font={resolvedAppFont}
                            fontSize={settings?.general.fontSize ?? 14}
                            t={t}
                        />
                    </div>

                    <div className="mt-8 flex flex-col gap-3 border-t border-border/10 px-1 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
                            <span className="text-primary/70 font-bold">
                                {themeOptions.find(option => option.value === (settings?.general.theme ?? 'graphite'))?.label}
                            </span>
                            <div className="h-1 w-1 rounded-full bg-border/40" />
                            <span>{resolvedAppFont.label}</span>
                        </div>
                        <Badge variant="outline" className="h-6 border-border/40 bg-muted/20 px-3 font-mono text-[10px] font-bold text-muted-foreground/60">
                            {settings?.general.fontSize}PX
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Window Configuration Section */}
            <div className={cn(SECTION_CONTAINER_CLASS, "space-y-8")}>
                <div className="flex items-center gap-4">
                    <div className={UI_PRIMITIVES.ICON_WRAPPER}>
                        <IconMaximize className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground">
                            {t('settings.windowConfigurationTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground/70">
                            {t('settings.windowConfigurationDesc')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-balance-95-105 xl:gap-10">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="px-1 text-sm font-semibold text-muted-foreground">
                                {t('settings.windowResolution')}
                            </label>
                            <Select
                                value={settings?.general.resolution ?? 'auto'}
                                onValueChange={value => {
                                    void updateGeneral({ resolution: value });
                                }}
                            >
                                <SelectTrigger className={UI_PRIMITIVES.CONTROL_BASE}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/40 bg-background/95 backdrop-blur-md">
                                    {resolutionOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div> 
                    </div>
                </div>
            </div>

            {/* Terminal Appearance Section */}
            <div className={cn(SECTION_CONTAINER_CLASS, "space-y-8")}>
                <div className="flex items-center gap-4">
                    <div className={UI_PRIMITIVES.ICON_WRAPPER}>
                        <IconTerminal className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground">
                            {t('settings.terminalAppearanceTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground/70">
                            {t('settings.appearanceDescription')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-balance-95-105 xl:gap-10">
                    <div className="space-y-8">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="px-1 text-sm font-semibold text-muted-foreground">{t('terminal.theme')}</label>
                                    <Select
                                        value={terminalAppearance.themePresetId}
                                        onValueChange={value => {
                                            setTerminalAppearance(p => ({ ...p, themePresetId: value }));
                                        }}
                                    >
                                        <SelectTrigger className={UI_PRIMITIVES.CONTROL_BASE}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-border/40 bg-background/95 backdrop-blur-md">
                                            {terminalThemeOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="px-1 text-sm font-semibold text-muted-foreground">{t('terminal.cursorStyle')}</label>
                                    <Select
                                        value={terminalAppearance.cursorStyle}
                                        onValueChange={value => {
                                            setTerminalAppearance(p => ({
                                                ...p,
                                                cursorStyle: value as typeof p.cursorStyle
                                            }));
                                        }}
                                    >
                                        <SelectTrigger className={UI_PRIMITIVES.CONTROL_BASE}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-border/40 bg-background/95 backdrop-blur-md">
                                            {terminalCursorOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="px-1 text-sm font-semibold text-muted-foreground">{t('settings.terminalFontSize')}</label>
                                    <Input
                                        type="number"
                                        min={8}
                                        max={32}
                                        value={terminalAppearance.fontSize}
                                        onChange={event => {
                                            const p = Number(event.target.value);
                                            setTerminalAppearance(prev => ({ ...prev, fontSize: clamp(Number.isFinite(p) ? p : 13, 8, 32) }));
                                        }}
                                        className={UI_PRIMITIVES.CONTROL_INPUT}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="px-1 text-sm font-semibold text-muted-foreground">{t('terminal.lineHeight')}</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={2}
                                        step={0.1}
                                        value={terminalAppearance.lineHeight}
                                        onChange={event => {
                                            const p = Number(event.target.value);
                                            setTerminalAppearance(prev => ({ ...prev, lineHeight: clamp(Number.isFinite(p) ? p : 1.2, 1, 2) }));
                                        }}
                                        className={UI_PRIMITIVES.CONTROL_INPUT}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 border-t border-border/10 pt-6">
                            <AppearanceRow
                                title={t('terminal.fontLigatures')}
                                description={t('settings.previewBody')}
                                control={(
                                    <Switch
                                        checked={terminalAppearance.ligatures}
                                        onCheckedChange={checked => setTerminalAppearance(prev => ({ ...prev, ligatures: checked }))}
                                    />
                                )}
                                icon={<IconLuggage className="h-3.5 w-3.5 text-primary opacity-60" />}
                            />
                            <AppearanceRow
                                title={t('terminal.cursorBlink')}
                                description={t('settings.terminalAppearanceTitle')}
                                control={(
                                    <Switch
                                        checked={terminalAppearance.cursorBlink}
                                        onCheckedChange={checked => setTerminalAppearance(prev => ({ ...prev, cursorBlink: checked }))}
                                    />
                                )}
                                icon={<IconRefresh className="h-3.5 w-3.5 text-primary opacity-60" />}
                            />
                        </div>
                    </div>

                    <div className="min-w-0">
                        <TerminalPreview
                            cursorStyle={terminalAppearance.cursorStyle}
                            fontFamily={resolvedTerminalAppearance.fontFamily}
                            fontSize={resolvedTerminalAppearance.fontSize}
                            lineHeight={resolvedTerminalAppearance.lineHeight}
                            theme={resolvedTerminalAppearance.theme}
                            t={t}
                        />
                    </div>
                </div>
            </div>

            {/* Accessibility Section */}
            <div className={cn(SECTION_CONTAINER_CLASS, "space-y-8")}>
                <div className="flex items-center gap-4 px-1">
                    <div className={cn(UI_PRIMITIVES.ICON_WRAPPER, "bg-success/10 text-success shadow-success/10")}>
                        <IconAccessible className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground">
                            {t('settings.accessibility.title')}
                        </h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-x-10 xl:gap-y-6">
                    <div className="space-y-4">
                        <AppearanceRow
                            title={t('settings.accessibility.highContrast')}
                            description={t('settings.accessibility.highContrastDesc')}
                            control={(
                                <Switch
                                    checked={a11ySettings.highContrast}
                                    onCheckedChange={checked => updateSettings({ highContrast: checked })}
                                />
                            )}
                            icon={<IconLuggage className="h-3.5 w-3.5 text-success opacity-60" />}
                        />
                        <AppearanceRow
                            title={t('settings.accessibility.reducedMotion')}
                            description={t('settings.accessibility.reducedMotionDesc')}
                            control={(
                                <Switch
                                    checked={a11ySettings.reducedMotion}
                                    onCheckedChange={checked => updateSettings({ reducedMotion: checked })}
                                />
                            )}
                            icon={<IconRefresh className="h-3.5 w-3.5 text-success opacity-60" />}
                        />
                    </div>

                    <div className="space-y-4">
                        <AppearanceRow
                            title={t('settings.accessibility.enhancedFocus')}
                            description={t('settings.accessibility.enhancedFocusDesc')}
                            control={(
                                <Switch
                                    checked={a11ySettings.enhancedFocusIndicators}
                                    onCheckedChange={checked => updateSettings({ enhancedFocusIndicators: checked })}
                                />
                            )}
                            icon={<IconPointer className="h-3.5 w-3.5 text-success opacity-60" />}
                        />
                        <AppearanceRow
                            title={t('settings.accessibility.screenReader')}
                            description={t('settings.accessibility.screenReaderDesc')}
                            control={(
                                <Switch
                                    checked={a11ySettings.screenReaderAnnouncements}
                                    onCheckedChange={checked => updateSettings({ screenReaderAnnouncements: checked })}
                                />
                            )}
                            icon={<IconRefresh className="h-3.5 w-3.5 text-success opacity-60" />}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
