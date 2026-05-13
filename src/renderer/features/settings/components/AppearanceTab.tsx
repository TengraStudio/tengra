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
import { IconAccessible, IconChevronDown, IconColumns, IconDeviceDesktop, IconLuggage, IconMaximize, IconPalette, IconPlus, IconPointer, IconRefresh, IconTerminal, IconTrash, IconTypography, IconX } from '@tabler/icons-react';
import React, { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectValue,
} from '@/components/ui/select';
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
import { themeRegistry } from '@/themes/theme-registry.service';
import { useA11ySettings } from '@/utils/accessibility';

import type { SettingsSharedProps } from '../types';

import {
    SettingsField,
    SettingsInput,
    SettingsPanel,
    SettingsSelectContent,
    SettingsSelectItem,
    SettingsSelectTrigger,
    SettingsSwitch,
    SettingsTabHeader,
    SettingsTabLayout,
    SettingsToggleRow,
} from './SettingsPrimitives';

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
}

function TerminalPreview({
    cursorStyle,
    fontFamily,
    fontSize,
    lineHeight,
    theme,
}: TerminalPreviewProps): JSX.Element {
    return (
        <div className="group relative h-80 w-full overflow-hidden rounded-xl border border-border/40 bg-[#0c0c0c] shadow-2xl transition-all hover:border-border/60">
            {/* VS Code Style Header */}
            <div className="flex h-9 items-center justify-between border-b border-white/5 bg-white/[0.02] px-3">
                <div className="flex h-full items-center">
                    <div className="flex h-full items-center border-b-2 border-primary px-3 text-[11px] font-bold tracking-wider text-foreground">
                        TERMINAL
                    </div>
                    <div className="flex h-full items-center px-3 text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer">
                        OUTPUT
                    </div>
                    <div className="flex h-full items-center px-3 text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer">
                        DEBUG CONSOLE
                    </div>
                </div>

                <div className="flex items-center gap-3 pr-1 text-muted-foreground/40">
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors cursor-pointer">
                        <span className="text-[10px] font-mono opacity-60">1: zsh</span>
                        <IconChevronDown className="h-3 w-3" />
                    </div>
                    <div className="h-3 w-[1px] bg-white/5" />
                    <div className="flex items-center gap-2">
                        <IconPlus className="h-3.5 w-3.5 hover:text-foreground transition-colors cursor-pointer" />
                        <IconColumns className="h-3.5 w-3.5 hover:text-foreground transition-colors cursor-pointer" />
                        <IconTrash className="h-3.5 w-3.5 hover:text-foreground transition-colors cursor-pointer" />
                        <IconX className="h-3.5 w-3.5 hover:text-foreground transition-colors cursor-pointer" />
                    </div>
                </div>
            </div>

            {/* Terminal Body */}
            <div
                className="h-full overflow-y-auto p-4 font-mono selection:bg-primary/30 custom-scrollbar"
                style={{
                    color: theme.foreground,
                    backgroundColor: theme.background,
                    fontFamily,
                    fontSize: `${fontSize}px`,
                    lineHeight,
                }}
            >
                <div className="space-y-1.5 opacity-90">
                    <div className="flex flex-wrap items-center gap-x-2 pb-1">
                        <span style={{ color: theme.cyan }}>➜</span>
                        <span style={{ color: theme.green }}>~</span>
                        <span style={{ color: theme.blue }}>projects/tengra</span>
                        <span className="text-white/30 font-light text-[0.85em]">git:(<span style={{ color: theme.red }}>main</span>)</span>
                        <span className="text-white/60">npm start</span>
                    </div>

                    <div className="text-[0.9em] leading-relaxed">
                        <span className="text-white/40">[{new Date().toLocaleTimeString()}]</span>
                        <span className="ml-2" style={{ color: theme.yellow }}>[info]</span>
                        <span className="ml-2">Initializing Tengra Core v1.2.0...</span>
                    </div>

                    <div className="text-[0.9em] leading-relaxed">
                        <span className="text-white/40">[{new Date().toLocaleTimeString()}]</span>
                        <span className="ml-2" style={{ color: theme.blue }}>[debug]</span>
                        <span className="ml-2">Loading model registry (34 models found)</span>
                    </div>

                    <div className="pt-1 flex items-center gap-3">
                        <div className="h-1.5 w-32 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full w-2/3 bg-primary animate-[terminal-progress_2s_ease-in-out_infinite]" />
                        </div>
                        <span className="text-[0.85em] text-white/30">Optimizing JIT clusters...</span>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-2">
                        <span style={{ color: theme.green }}>SUCCESS</span>
                        <span className="text-white/70">Build completed in 1.4s</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <span style={{ color: theme.cyan }}>➜</span>
                        <span style={{ color: theme.green }}>~</span>
                        <div
                            className={cn(
                                'shadow-[0_0_12px_rgba(var(--primary-rgb),0.6)]',
                                cursorStyle === 'block' && 'h-[1.1em] w-[0.55em] bg-primary',
                                cursorStyle === 'underline' && 'mt-[0.9em] h-[2px] w-[0.6em] bg-primary',
                                cursorStyle === 'bar' && 'h-[1.1em] w-[2px] bg-primary',
                                'animate-[terminal-blink_1s_step-end_infinite]'
                            )}
                        />
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes terminal-blink {
                    from, to { opacity: 1; }
                    50% { opacity: 0; }
                }
                @keyframes terminal-progress {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0); }
                    100% { transform: translateX(100%); }
                }
            `}} />
        </div>
    );
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
    settings,
    updateGeneral,
    updateWindow: _updateWindow,
    t,
}) => {
    const { settings: a11ySettings, updateSettings } = useA11ySettings();
    const { terminalAppearance, setTerminalAppearance } = useTerminalAppearance({
        storageKey: TERMINAL_APPEARANCE_STORAGE_KEY,
        defaultAppearance: DEFAULT_TERMINAL_APPEARANCE,
    });
    const themeImportInputRef = useRef<HTMLInputElement>(null);
    const themeRegistryVersion = useSyncExternalStore(
        themeRegistry.subscribe,
        themeRegistry.getSnapshot,
        themeRegistry.getSnapshot
    );
    void themeRegistryVersion;
    const availableThemes = themeRegistry.getAllThemes().length > 0
        ? themeRegistry.getAllThemes()
        : BUILTIN_THEME_MANIFESTS;

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
        { value: 'compact', label: t('frontend.settings.typographyScaleCompact') },
        { value: 'balanced', label: t('frontend.settings.typographyScaleBalanced') },
        { value: 'comfortable', label: t('frontend.settings.typographyScaleComfortable') },
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
    const handleImportTheme = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        try {
            const themeManifest = JSON.parse(await file.text()) as ThemeManifest;
            await window.electron.theme.runtime.install(themeManifest);
            await themeRegistry.reloadThemes();
        } catch (error) {
            void error;
        }
    }, []);

    const resolutionOptions = [
        { value: 'auto', label: 'Auto (Recommended)' },
        { value: '1280x720', label: '1280 x 720 (HD)' },
        { value: '1600x900', label: '1600 x 900' },
        { value: '1920x1080', label: '1920 x 1080 (FHD)' },
        { value: '2560x1440', label: '2560 x 1440 (QHD)' },
    ];

    return (
        <SettingsTabLayout className="animate-in fade-in duration-500">
            <input
                ref={themeImportInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={event => {
                    void handleImportTheme(event);
                }}
            />

            <SettingsPanel
                title={t('frontend.settings.interfaceConfiguration')}
                icon={IconDeviceDesktop}
            >
                <div className="px-6 py-2 space-y-4">
                    <SettingsField label={t('frontend.settings.theme')}>
                        <Select
                            value={settings?.general.theme ?? 'tengra-black'}
                            onValueChange={value => {
                                void updateGeneral({ theme: value });
                            }}
                        >
                            <SettingsSelectTrigger>
                                <SelectValue />
                            </SettingsSelectTrigger>
                            <SettingsSelectContent>
                                {themeOptions.map(opt => (
                                    <SettingsSelectItem key={opt.value} value={opt.value}>
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium">{opt.label}</span>
                                            <Badge variant="outline" className={cn(UI_PRIMITIVES.BADGE_MUTED, 'uppercase')}>
                                                {opt.type}
                                            </Badge>
                                        </div>
                                    </SettingsSelectItem>
                                ))}
                            </SettingsSelectContent>
                        </Select>
                    </SettingsField>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                        <SettingsField label={t('frontend.settings.baseFontSize')}>
                            <SettingsInput
                                type="number"
                                min={12}
                                max={18}
                                value={settings?.general.fontSize ?? 14}
                                onChange={event => {
                                    const parsed = Number.parseInt(event.target.value, 10);
                                    const nextValue = Number.isNaN(parsed) ? 14 : clamp(parsed, 12, 18);
                                    void updateGeneral({ fontSize: nextValue });
                                }}
                            />
                        </SettingsField>
                        <SettingsField label={t('frontend.settings.typographyScale')}>
                            <Select
                                value={settings?.general.typographyScale ?? 'balanced'}
                                onValueChange={value => {
                                    void updateGeneral({
                                        typographyScale: value as 'compact' | 'balanced' | 'comfortable',
                                    });
                                }}
                            >
                                <SettingsSelectTrigger>
                                    <SelectValue />
                                </SettingsSelectTrigger>
                                <SettingsSelectContent>
                                    {typographyScaleOptions.map(opt => (
                                        <SettingsSelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SettingsSelectItem>
                                    ))}
                                </SettingsSelectContent>
                            </Select>
                        </SettingsField>
                    </div>
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('frontend.settings.windowConfigurationTitle')}
                description={t('frontend.settings.windowConfigurationDesc')}
                icon={IconMaximize}
            >
                <div className="px-6 py-2 space-y-4">
                    <SettingsField label={t('frontend.settings.windowResolution')}>
                    <Select
                        value={settings?.general.resolution ?? 'auto'}
                        onValueChange={value => {
                            void updateGeneral({ resolution: value });
                        }}
                    >
                        <SettingsSelectTrigger>
                            <SelectValue />
                        </SettingsSelectTrigger>
                        <SettingsSelectContent>
                            {resolutionOptions.map(opt => (
                                <SettingsSelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SettingsSelectItem>
                            ))}
                        </SettingsSelectContent>
                    </Select>
                </SettingsField>
                </div>
                
            </SettingsPanel>

            <SettingsPanel
                title={t('frontend.settings.terminalAppearanceTitle')}
                description={t('frontend.settings.appearanceDescription')}
                icon={IconTerminal}
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 px-6 py-2">
                    <SettingsField label={t('frontend.terminal.theme')}>
                        <Select
                            value={terminalAppearance.themePresetId}
                            onValueChange={value => {
                                setTerminalAppearance(p => ({ ...p, themePresetId: value }));
                            }}
                        >
                            <SettingsSelectTrigger>
                                <SelectValue />
                            </SettingsSelectTrigger>
                            <SettingsSelectContent>
                                {terminalThemeOptions.map(opt => (
                                    <SettingsSelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SettingsSelectItem>
                                ))}
                            </SettingsSelectContent>
                        </Select>
                    </SettingsField>

                    <SettingsField label={t('frontend.terminal.cursorStyle')}>
                        <Select
                            value={terminalAppearance.cursorStyle}
                            onValueChange={value => {
                                setTerminalAppearance(p => ({
                                    ...p,
                                    cursorStyle: value as typeof p.cursorStyle
                                }));
                            }}
                        >
                            <SettingsSelectTrigger>
                                <SelectValue />
                            </SettingsSelectTrigger>
                            <SettingsSelectContent>
                                {terminalCursorOptions.map(opt => (
                                    <SettingsSelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SettingsSelectItem>
                                ))}
                            </SettingsSelectContent>
                        </Select>
                    </SettingsField>

                    <SettingsField label={t('frontend.settings.terminalFontSize')}>
                        <SettingsInput
                            type="number"
                            min={8}
                            max={32}
                            value={terminalAppearance.fontSize}
                            onChange={event => {
                                const p = Number(event.target.value);
                                setTerminalAppearance(prev => ({ ...prev, fontSize: clamp(Number.isFinite(p) ? p : 13, 8, 32) }));
                            }}
                        />
                    </SettingsField>

                    <SettingsField label={t('frontend.terminal.lineHeight')}>
                        <SettingsInput
                            type="number"
                            min={1}
                            max={2}
                            step={0.1}
                            value={terminalAppearance.lineHeight}
                            onChange={event => {
                                const p = Number(event.target.value);
                                setTerminalAppearance(prev => ({ ...prev, lineHeight: clamp(Number.isFinite(p) ? p : 1.2, 1, 2) }));
                            }}
                        />
                    </SettingsField>
                </div>

                <div className="px-6 py-2 space-y-3 border-t border-border/10 pt-4">
                    <SettingsToggleRow
                        title={t('frontend.terminal.fontLigatures')}
                        description={t('frontend.settings.previewBody')}
                        control={(
                            <SettingsSwitch
                                checked={terminalAppearance.ligatures}
                                onCheckedChange={checked => setTerminalAppearance(prev => ({ ...prev, ligatures: checked }))}
                            />
                        )}
                        icon={IconLuggage}
                    />
                    <SettingsToggleRow
                        title={t('frontend.terminal.cursorBlink')}
                        description={t('frontend.settings.terminalAppearanceTitle')}
                        control={(
                            <SettingsSwitch
                                checked={terminalAppearance.cursorBlink}
                                onCheckedChange={checked => setTerminalAppearance(prev => ({ ...prev, cursorBlink: checked }))}
                            />
                        )}
                        icon={IconRefresh}
                    />
                    <SettingsToggleRow
                        title={t('frontend.terminal.bellEnabled')}
                        description={t('frontend.terminal.bellEnabledDesc')}
                        control={(
                            <SettingsSwitch
                                checked={terminalAppearance.bellEnabled}
                                onCheckedChange={checked => setTerminalAppearance(prev => ({ ...prev, bellEnabled: checked }))}
                            />
                        )}
                        icon={IconTerminal}
                    />
                    {terminalAppearance.bellEnabled && (
                        <SettingsField label={t('frontend.terminal.bellStyle')}>
                            <Select
                                value={terminalAppearance.bellStyle}
                                onValueChange={value => {
                                    setTerminalAppearance(p => ({
                                        ...p,
                                        bellStyle: value as 'none' | 'sound' | 'visual' | 'both'
                                    }));
                                }}
                            >
                                <SettingsSelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SettingsSelectTrigger>
                                <SettingsSelectContent>
                                    <SettingsSelectItem value="none">None</SettingsSelectItem>
                                    <SettingsSelectItem value="sound">Sound</SettingsSelectItem>
                                    <SettingsSelectItem value="visual">Visual</SettingsSelectItem>
                                    <SettingsSelectItem value="both">Both</SettingsSelectItem>
                                </SettingsSelectContent>
                            </Select>
                        </SettingsField>
                    )}
                </div>

                <div className="min-w-0 py-2 px-6">
                    <TerminalPreview
                        cursorStyle={terminalAppearance.cursorStyle}
                        fontFamily={resolvedTerminalAppearance.fontFamily}
                        fontSize={resolvedTerminalAppearance.fontSize}
                        lineHeight={resolvedTerminalAppearance.lineHeight}
                        theme={resolvedTerminalAppearance.theme}
                    />
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('frontend.settings.accessibility.title')}
                icon={IconAccessible}
            >
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 px-6 py-2">
                    <SettingsToggleRow
                        title={t('frontend.settings.accessibility.highContrast')}
                        description={t('frontend.settings.accessibility.highContrastDesc')}
                        control={(
                            <SettingsSwitch
                                checked={a11ySettings.highContrast}
                                onCheckedChange={checked => updateSettings({ highContrast: checked })}
                            />
                        )}
                        icon={IconLuggage}
                    />
                    <SettingsToggleRow
                        title={t('frontend.settings.accessibility.reducedMotion')}
                        description={t('frontend.settings.accessibility.reducedMotionDesc')}
                        control={(
                            <SettingsSwitch
                                checked={a11ySettings.reducedMotion}
                                onCheckedChange={checked => updateSettings({ reducedMotion: checked })}
                            />
                        )}
                        icon={IconRefresh}
                    />
                    <SettingsToggleRow
                        title={t('frontend.settings.accessibility.enhancedFocus')}
                        description={t('frontend.settings.accessibility.enhancedFocusDesc')}
                        control={(
                            <SettingsSwitch
                                checked={a11ySettings.enhancedFocusIndicators}
                                onCheckedChange={checked => updateSettings({ enhancedFocusIndicators: checked })}
                            />
                        )}
                        icon={IconPointer}
                    />
                    <SettingsToggleRow
                        title={t('frontend.settings.accessibility.screenReader')}
                        description={t('frontend.settings.accessibility.screenReaderDesc')}
                        control={(
                            <SettingsSwitch
                                checked={a11ySettings.screenReaderAnnouncements}
                                onCheckedChange={checked => updateSettings({ screenReaderAnnouncements: checked })}
                            />
                        )}
                        icon={IconRefresh}
                    />
                </div>
            </SettingsPanel>
        </SettingsTabLayout>
    );
};
