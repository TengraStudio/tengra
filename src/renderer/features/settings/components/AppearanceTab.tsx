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
import {
    Accessibility,
    BaggageClaim,
    Monitor,
    MousePointer2,
    Palette,
    RefreshCw,
    Terminal,
    Type,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { getTerminalTheme } from '@/lib/terminal-theme';
import { resolveAppFontPreset } from '@/lib/typography-settings';
import { cn } from '@/lib/utils';
import { useA11ySettings } from '@/utils/accessibility';
import { themeIpc } from '@/utils/theme-ipc.util';

import type { SettingsSharedProps } from '../types';

type AppearanceTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'updateGeneral' | 't'
>;

interface TerminalPreviewProps {
    cursorStyle: 'bar' | 'block' | 'underline';
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    theme: ReturnType<typeof getTerminalTheme>;
    t: (key: string) => string;
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
        <div className="relative h-full overflow-hidden rounded-[2rem] border border-border/40 bg-[#0c0c0c] p-1">
            <div className="h-full rounded-[1.75rem] border border-white/5 p-8">
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
        <div className="flex flex-col gap-4 rounded-2xl border border-border/15 p-4 transition-colors hover:bg-muted/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {icon}
                    {title}
                </div>
                <div className="max-w-[32rem] text-xs leading-relaxed text-muted-foreground/70">
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
    t,
}) => {
    const [themes, setThemes] = useState<ThemeManifest[]>([]);
    const { settings: a11ySettings, updateSettings } = useA11ySettings();
    const { terminalAppearance, setTerminalAppearance } = useTerminalAppearance({
        storageKey: TERMINAL_APPEARANCE_STORAGE_KEY,
        defaultAppearance: DEFAULT_TERMINAL_APPEARANCE,
    });

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const loadedThemes = await themeIpc.getAllThemes();
                if (!cancelled) {
                    setThemes(loadedThemes);
                }
            } catch {
                if (!cancelled) {
                    setThemes([]);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const themeOptions = useMemo(() => {
        const availableThemes: Array<Pick<ThemeManifest, 'id' | 'displayName' | 'type'>> =
            themes.length > 0
                ? themes
                : [
                    { id: 'graphite', displayName: 'Graphite', type: 'dark' },
                    { id: 'snow', displayName: 'Snow', type: 'light' },
                ];

        return availableThemes.map(theme => ({
            value: theme.id,
            label: theme.displayName,
            type: theme.type,
        }));
    }, [themes]);

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

    return (
        <div className="space-y-8 pb-16 lg:space-y-10">
            <div className="px-1">
                <div className="mb-3 flex items-center gap-4">
                    <div className="rounded-2xl bg-primary/10 p-3.5 text-primary">
                        <Palette className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-semibold leading-none text-foreground">
                            {t('settings.appearanceTitle')}
                        </h3>
                    </div>
                </div>
                <p className="max-w-2xl px-1 text-sm leading-relaxed text-muted-foreground/70">
                    {t('settings.appearanceDescription')}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="space-y-6 rounded-3xl border border-border/20 bg-card p-5 sm:p-6 lg:p-8">
                    <div className="flex items-center gap-3 px-1">
                        <Monitor className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">{t('settings.appearanceTitle')}</h4>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="px-1 text-xs font-medium text-muted-foreground">{t('settings.theme')}</div>
                            <Select
                                value={settings?.general.theme ?? 'graphite'}
                                onValueChange={value => {
                                    void updateGeneral({ theme: value });
                                }}
                            >
                                <SelectTrigger className="h-12 rounded-2xl border-border/40 bg-muted/20 px-6 text-sm focus:ring-primary/20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/40 bg-background/95">
                                    {themeOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                            <div className="flex items-center gap-3">
                                                <span>{opt.label}</span>
                                                <Badge variant="outline" className="h-5 border-border/20 px-2 typo-body opacity-60">
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
                                <div className="px-1 text-xs font-medium text-muted-foreground">{t('settings.baseFontSize')}</div>
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
                                    className="h-12 rounded-2xl border-border/40 bg-muted/20 px-6 text-sm focus-visible:ring-primary/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="px-1 text-xs font-medium text-muted-foreground">{t('settings.typographyScale')}</div>
                                <Select
                                    value={settings?.general.typographyScale ?? 'balanced'}
                                    onValueChange={value => {
                                        void updateGeneral({
                                            typographyScale: value as 'compact' | 'balanced' | 'comfortable',
                                        });
                                    }}
                                >
                                    <SelectTrigger className="h-12 rounded-2xl border-border/40 bg-muted/20 px-6 text-sm focus:ring-primary/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-border/40 bg-background/95">
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

                <div className="flex flex-col justify-between rounded-3xl border border-border/20 bg-card p-5 sm:p-6 lg:p-8">
                    <div className="mb-6 flex items-center gap-3 px-1">
                        <Type className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">{t('settings.livePreview')}</h4>
                    </div>

                    <div className="flex-1 space-y-6">
                        <div className="rounded-[2rem] border border-border/15 bg-muted/10 p-6 sm:p-8">
                            <h2
                                className="mb-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl"
                                style={{ fontFamily: resolvedAppFont.display }}
                            >
                                {t('settings.previewHeading')}
                            </h2>
                            <p
                                className="text-sm leading-8 text-muted-foreground/80"
                                style={{ fontFamily: resolvedAppFont.sans }}
                            >
                                {t('settings.previewBody')}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 border-t border-border/10 px-1 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                            <div className="text-xs font-medium text-primary">
                                {themeOptions.find(option => option.value === (settings?.general.theme ?? 'graphite'))?.label}
                            </div>
                            <div className="h-1 w-1 rounded-full bg-border/40" />
                            <div className="text-xs text-muted-foreground/60">{resolvedAppFont.label}</div>
                        </div>
                        <Badge variant="outline" className="h-6 border-border/40 bg-muted/20 px-3 typo-body text-muted-foreground/60">
                            {settings?.general.fontSize}px
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="space-y-8 rounded-3xl border border-border/20 bg-card p-5 sm:p-6 lg:p-8">
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Terminal className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('settings.terminalAppearanceTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground/70">
                            {t('settings.appearanceDescription')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-10">
                    <div className="space-y-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <div className="px-1 text-xs font-medium text-muted-foreground">{t('terminal.theme')}</div>
                                <Select
                                    value={terminalAppearance.themePresetId}
                                    onValueChange={value => {
                                        setTerminalAppearance(previousValue => ({
                                            ...previousValue,
                                            fontPresetId: DEFAULT_TERMINAL_APPEARANCE.fontPresetId,
                                            themePresetId: value,
                                        }));
                                    }}
                                >
                                    <SelectTrigger className="h-12 rounded-2xl border-border/40 bg-muted/20 px-6 text-sm focus:ring-primary/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-border/40 bg-background/95">
                                        {terminalThemeOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <div className="px-1 text-xs font-medium text-muted-foreground">{t('terminal.cursorStyle')}</div>
                                <Select
                                    value={terminalAppearance.cursorStyle}
                                    onValueChange={value => {
                                        setTerminalAppearance(previousValue => ({
                                            ...previousValue,
                                            fontPresetId: DEFAULT_TERMINAL_APPEARANCE.fontPresetId,
                                            cursorStyle: value as 'block' | 'underline' | 'bar',
                                        }));
                                    }}
                                >
                                    <SelectTrigger className="h-12 rounded-2xl border-border/40 bg-muted/20 px-6 text-sm focus:ring-primary/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-border/40 bg-background/95">
                                        {terminalCursorOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="px-1 text-xs font-medium text-muted-foreground">{t('settings.terminalFontSize')}</div>
                                    <Input
                                        type="number"
                                        min={8}
                                        max={32}
                                        value={terminalAppearance.fontSize}
                                        onChange={event => {
                                            const parsed = Number(event.target.value);
                                            setTerminalAppearance(previousValue => ({
                                                ...previousValue,
                                                fontPresetId: DEFAULT_TERMINAL_APPEARANCE.fontPresetId,
                                                fontSize: clamp(Number.isFinite(parsed) ? parsed : 13, 8, 32),
                                            }));
                                        }}
                                        className="h-12 rounded-2xl border-border/40 bg-muted/20 px-5 text-sm focus-visible:ring-primary/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="px-1 text-xs font-medium text-muted-foreground">{t('terminal.lineHeight')}</div>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={2}
                                        step={0.1}
                                        value={terminalAppearance.lineHeight}
                                        onChange={event => {
                                            const parsed = Number(event.target.value);
                                            setTerminalAppearance(previousValue => ({
                                                ...previousValue,
                                                fontPresetId: DEFAULT_TERMINAL_APPEARANCE.fontPresetId,
                                                lineHeight: clamp(Number.isFinite(parsed) ? parsed : 1.2, 1, 2),
                                            }));
                                        }}
                                        className="h-12 rounded-2xl border-border/40 bg-muted/20 px-5 text-sm focus-visible:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 border-t border-border/10 pt-4">
                            <AppearanceRow
                                title={t('terminal.fontLigatures')}
                                description={t('settings.previewBody')}
                                control={(
                                    <Switch
                                        checked={terminalAppearance.ligatures}
                                        onCheckedChange={checked => {
                                            setTerminalAppearance(previousValue => ({
                                                ...previousValue,
                                                fontPresetId: DEFAULT_TERMINAL_APPEARANCE.fontPresetId,
                                                ligatures: checked,
                                            }));
                                        }}
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
                                        onCheckedChange={checked => {
                                            setTerminalAppearance(previousValue => ({
                                                ...previousValue,
                                                fontPresetId: DEFAULT_TERMINAL_APPEARANCE.fontPresetId,
                                                cursorBlink: checked,
                                            }));
                                        }}
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

            <div className="space-y-8 rounded-3xl border border-border/20 bg-card p-5 sm:p-6 lg:p-8">
                <div className="flex items-center gap-4 px-1">
                    <div className="rounded-2xl bg-primary/10 p-3.5 text-primary">
                        <Accessibility className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('settings.accessibility.title')}
                        </h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-x-10 xl:gap-y-8">
                    <div className="space-y-8">
                        <AppearanceRow
                            title={t('settings.accessibility.highContrast')}
                            description={t('settings.accessibility.highContrastDesc')}
                            control={(
                                <Switch
                                    checked={a11ySettings.highContrast}
                                    onCheckedChange={checked => {
                                        updateSettings({ highContrast: checked });
                                    }}
                                />
                            )}
                            icon={<BaggageClaim className="h-3.5 w-3.5 text-primary opacity-60" />}
                        />
                        <AppearanceRow
                            title={t('settings.accessibility.reducedMotion')}
                            description={t('settings.accessibility.reducedMotionDesc')}
                            control={(
                                <Switch
                                    checked={a11ySettings.reducedMotion}
                                    onCheckedChange={checked => {
                                        updateSettings({ reducedMotion: checked });
                                    }}
                                />
                            )}
                            icon={<RefreshCw className="h-3.5 w-3.5 text-primary opacity-60" />}
                        />
                    </div>

                    <div className="space-y-8">
                        <AppearanceRow
                            title={t('settings.accessibility.enhancedFocus')}
                            description={t('settings.accessibility.enhancedFocusDesc')}
                            control={(
                                <Switch
                                    checked={a11ySettings.enhancedFocusIndicators}
                                    onCheckedChange={checked => {
                                        updateSettings({ enhancedFocusIndicators: checked });
                                    }}
                                />
                            )}
                            icon={<MousePointer2 className="h-3.5 w-3.5 text-primary opacity-60" />}
                        />
                        <AppearanceRow
                            title={t('settings.accessibility.screenReader')}
                            description={t('settings.accessibility.screenReaderDesc')}
                            control={(
                                <Switch
                                    checked={a11ySettings.screenReaderAnnouncements}
                                    onCheckedChange={checked => {
                                        updateSettings({ screenReaderAnnouncements: checked });
                                    }}
                                />
                            )}
                            icon={<RefreshCw className="h-3.5 w-3.5 text-primary opacity-60" />}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
