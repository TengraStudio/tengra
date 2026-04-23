/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Badge } from '@renderer/components/ui/badge';
import { Input } from '@renderer/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import { UI_PRIMITIVES } from '@renderer/constants/ui-primitives';
import {
    clamp,
    DEFAULT_TERMINAL_APPEARANCE,
    resolveTerminalAppearance,
    TERMINAL_APPEARANCE_STORAGE_KEY,
    TERMINAL_CURSOR_STYLES,
    TERMINAL_THEME_PRESETS,
} from '@renderer/features/terminal/constants/terminal-panel-constants';
import { useTerminalAppearance } from '@renderer/features/terminal/hooks/useTerminalAppearance';
import type { ThemeManifest } from '@shared/types/theme';
import { BUILTIN_THEME_MANIFESTS } from '@shared/theme/builtin-theme-manifests';
import {
    Accessibility,
    BaggageClaim,
    Maximize,
    Monitor,
    MousePointer2,
    Palette,
    RefreshCw,
    Terminal,
    Type,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
        <div className="relative h-full overflow-hidden rounded-card-lg border border-border/40 bg-background p-1">
            <div className="h-full rounded-card-2xl border border-border/20 p-8">
                <div className="mb-8 flex items-center gap-2 opacity-40">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                </div>

                <div
                    className="space-y-4"
                    style={{
                        color: theme.foreground,
                        fontFamily,
                        fontSize: `${fontSize}px`,
                        lineHeight,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <span className="shrink-0 text-primary">➜</span>
                        <span className="shrink-0 text-success/80">~</span>
                        <span className="truncate opacity-90">{t('settings.terminalPreview.command')}</span>
                    </div>
                    <div className="flex items-center gap-3 pl-6">
                        <div className="h-4 w-1.5 rounded-full bg-success/20" />
                        <span style={{ color: theme.green }} className="typo-body font-medium">
                            {t('settings.terminalPreview.workspaceReady')}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 pl-6">
                        <div className="h-4 w-1.5 rounded-full bg-warning/20" />
                        <span style={{ color: theme.yellow }} className="typo-body font-medium">
                            {t('settings.terminalPreview.jobsPaused')}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 pl-6">
                        <div className="h-4 w-1.5 rounded-full bg-blue-500/20" />
                        <span style={{ color: theme.blue }} className="typo-body font-medium">
                            {t('settings.terminalPreview.suggestionsEnabled')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                        <span className="text-primary">➜</span>
                        <div
                            className={cn(
                                'animate-pulse bg-primary transition-all',
                                cursorStyle === 'block' && 'h-5 w-2.5',
                                cursorStyle === 'underline' && 'mt-4 h-0.5 w-3',
                                cursorStyle === 'bar' && 'h-5 w-0.5'
                            )}
                        />
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
                        <Palette className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold tracking-tight text-foreground">
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
                        <Monitor className="h-4 w-4 text-primary/80" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                            {t('settings.interfaceConfiguration')}
                        </h4>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="px-1 text-xs font-semibold text-muted-foreground">
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
                                <label className="px-1 text-xs font-semibold text-muted-foreground">
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
                                <label className="px-1 text-xs font-semibold text-muted-foreground">
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
                        <Type className="h-4 w-4 text-primary/80" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                            {t('settings.livePreview')}
                        </h4>
                    </div>

                    <div className={cn(UI_PRIMITIVES.PREVIEW_BOX, "flex-1 flex flex-col justify-center")}>
                        <h2
                            className="mb-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl tracking-tight"
                            style={{ fontFamily: resolvedAppFont.display }}
                        >
                            {t('settings.previewHeading')}
                        </h2>
                        <p
                            className="text-sm leading-relaxed text-muted-foreground/80"
                            style={{ fontFamily: resolvedAppFont.sans }}
                        >
                            {t('settings.previewBody')}
                        </p>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 border-t border-border/10 px-1 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-xxs uppercase tracking-widest text-muted-foreground/50">
                            <span className="text-primary/70">
                                {themeOptions.find(option => option.value === (settings?.general.theme ?? 'graphite'))?.label}
                            </span>
                            <div className="h-1 w-1 rounded-full bg-border/40" />
                            <span>{resolvedAppFont.label}</span>
                        </div>
                        <Badge variant="outline" className="h-6 border-border/40 bg-muted/20 px-3 font-mono text-muted-foreground/60">
                            {settings?.general.fontSize}px
                        </Badge>
                    </div>
                </div>
            </div>

            <div className={cn(SECTION_CONTAINER_CLASS, "space-y-6")}>
                <div className="flex items-center gap-4">
                    <div className={UI_PRIMITIVES.ICON_WRAPPER}>
                        <Palette className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground">
                            {t('settings.themeManifestTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground/70">
                            {t('settings.themeManifestDescription')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-balance-95-105">
                    <div className="rounded-card-lg border border-border/20 bg-muted/10 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-semibold text-foreground">
                                {currentThemeManifest?.displayName ?? t('settings.theme')}
                            </h4>
                            {currentThemeManifest && (
                                <>
                                    <Badge variant="outline" className="uppercase">
                                        {currentThemeManifest.type}
                                    </Badge>
                                    {currentThemeManifest.category && (
                                        <Badge variant="outline">
                                            {currentThemeManifest.category}
                                        </Badge>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="rounded-2xl border border-border/20 bg-background/70 p-3">
                                <div className="typo-caption text-muted-foreground">
                                    {t('settings.themeManifestInstalledCount')}
                                </div>
                                <div className="mt-1 text-lg font-semibold text-foreground">
                                    {availableThemes.length}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-border/20 bg-background/70 p-3">
                                <div className="typo-caption text-muted-foreground">
                                    {t('settings.themeManifestColorCount')}
                                </div>
                                <div className="mt-1 text-lg font-semibold text-foreground">
                                    {currentThemeColors.length}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-border/20 bg-background/70 p-3">
                                <div className="typo-caption text-muted-foreground">
                                    {t('settings.themeManifestVarCount')}
                                </div>
                                <div className="mt-1 text-lg font-semibold text-foreground">
                                    {currentThemeVars.length}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-border/20 bg-background/70 p-3">
                                <div className="typo-caption text-muted-foreground">
                                    {t('settings.themeManifestCurrentId')}
                                </div>
                                <div className="mt-1 truncate text-sm font-semibold text-foreground">
                                    {currentThemeId}
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => themeImportInputRef.current?.click()}
                                className="rounded-2xl border border-border/30 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
                            >
                                {t('settings.themeManifestImport')}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadCurrentTheme}
                                disabled={!currentThemeManifest}
                                className="rounded-2xl border border-border/30 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t('settings.themeManifestDownload')}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleOpenThemesDirectory()}
                                className="rounded-2xl border border-border/30 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
                            >
                                {t('settings.themeManifestOpenFolder')}
                            </button>
                        </div>

                        {themeActionStatus && (
                            <div className={cn(
                                'mt-4 rounded-2xl border px-4 py-3 text-sm',
                                themeActionStatus.tone === 'success'
                                    ? 'border-success/30 bg-success/10 text-success'
                                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                            )}>
                                {themeActionStatus.message}
                            </div>
                        )}
                    </div>

                    <div className="rounded-card-lg border border-border/20 bg-muted/10 p-5">
                        <div className="flex items-center justify-between gap-3">
                            <h4 className="text-lg font-semibold text-foreground">
                                {t('settings.themeManifestTokenCoverage')}
                            </h4>
                            <Badge variant="outline">
                                {currentThemeVars.length} {t('settings.themeManifestVarsLabel')}
                            </Badge>
                        </div>

                        {currentThemeVars.length > 0 ? (
                            <>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    {currentThemeVarGroups.map(group => (
                                        <div key={group.label} className="rounded-2xl border border-border/20 bg-background/70 p-3">
                                            <div className="typo-caption text-muted-foreground">
                                                {group.label}
                                            </div>
                                            <div className="mt-1 text-lg font-semibold text-foreground">
                                                {group.count}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {currentThemeVars.slice(0, 16).map(([key]) => (
                                        <code
                                            key={key}
                                            className="rounded-full border border-border/30 bg-background/80 px-3 py-1 text-xxs text-muted-foreground"
                                        >
                                            {key}
                                        </code>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="mt-4 rounded-2xl border border-border/20 bg-background/70 p-4 text-sm text-muted-foreground">
                                {t('settings.themeManifestNoVars')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Window Configuration Section */}
            <div className={cn(SECTION_CONTAINER_CLASS, "space-y-8")}>
                <div className="flex items-center gap-4">
                    <div className={UI_PRIMITIVES.ICON_WRAPPER}>
                        <Maximize className="h-7 w-7" />
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
                            <label className="px-1 text-xs font-semibold text-muted-foreground">
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

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="px-1 text-xs font-semibold text-muted-foreground">{t('settings.windowWidth')}</label>
                                <Input
                                    type="number"
                                    min={800}
                                    max={7680}
                                    value={settings?.window?.width ?? 1280}
                                    onChange={event => {
                                        const p = Number(event.target.value);
                                        updateWindow?.({ width: clamp(Number.isFinite(p) ? p : 1280, 800, 7680) });
                                    }}
                                    className={UI_PRIMITIVES.CONTROL_INPUT}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="px-1 text-xs font-semibold text-muted-foreground">{t('settings.windowHeight')}</label>
                                <Input
                                    type="number"
                                    min={600}
                                    max={4320}
                                    value={settings?.window?.height ?? 720}
                                    onChange={event => {
                                        const p = Number(event.target.value);
                                        updateWindow?.({ height: clamp(Number.isFinite(p) ? p : 720, 600, 4320) });
                                    }}
                                    className={UI_PRIMITIVES.CONTROL_INPUT}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 border-t border-border/10 pt-6">
                            <AppearanceRow
                                title={t('settings.windowStartOnStartup')}
                                description={t('settings.windowStartOnStartupDesc')}
                                control={(
                                    <Switch
                                        checked={settings?.window?.startOnStartup ?? false}
                                        onCheckedChange={checked => updateWindow?.({ startOnStartup: checked })}
                                    />
                                )}
                                icon={<RefreshCw className="h-3.5 w-3.5 text-primary opacity-60" />}
                            />
                            <AppearanceRow
                                title={t('settings.workAtBackground')}
                                description={t('settings.workAtBackgroundDesc')}
                                control={(
                                    <Switch
                                        checked={settings?.window?.workAtBackground ?? true}
                                        onCheckedChange={checked => updateWindow?.({ workAtBackground: checked })}
                                    />
                                )}
                                icon={<RefreshCw className="h-3.5 w-3.5 text-primary opacity-60" />}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Terminal Appearance Section */}
            <div className={cn(SECTION_CONTAINER_CLASS, "space-y-8")}>
                <div className="flex items-center gap-4">
                    <div className={UI_PRIMITIVES.ICON_WRAPPER}>
                        <Terminal className="h-7 w-7" />
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
                                    <label className="px-1 text-xs font-semibold text-muted-foreground">{t('terminal.theme')}</label>
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
                                    <label className="px-1 text-xs font-semibold text-muted-foreground">{t('terminal.cursorStyle')}</label>
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
                                    <label className="px-1 text-xs font-semibold text-muted-foreground">{t('settings.terminalFontSize')}</label>
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
                                    <label className="px-1 text-xs font-semibold text-muted-foreground">{t('terminal.lineHeight')}</label>
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
                                icon={<BaggageClaim className="h-3.5 w-3.5 text-primary opacity-60" />}
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
                                icon={<RefreshCw className="h-3.5 w-3.5 text-primary opacity-60" />}
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
                        <Accessibility className="h-7 w-7" />
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
                            icon={<BaggageClaim className="h-3.5 w-3.5 text-success opacity-60" />}
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
                            icon={<RefreshCw className="h-3.5 w-3.5 text-success opacity-60" />}
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
                            icon={<MousePointer2 className="h-3.5 w-3.5 text-success opacity-60" />}
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
                            icon={<RefreshCw className="h-3.5 w-3.5 text-success opacity-60" />}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
