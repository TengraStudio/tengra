import { ThemeManifest } from '@shared/types/theme';
import { Code, FolderOpen, Palette, Shield, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { confirmDialog } from '@/features/terminal/utils/dialog';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types/settings';
import { appLogger } from '@/utils/renderer-logger';
import { themeIpc } from '@/utils/theme-ipc.util';

import { TerminalAppearanceSection } from './TerminalAppearanceSection';

interface AppearanceTabProps {
    settings: AppSettings | null;
    updateGeneral: (patch: Partial<AppSettings['general']>) => void;
    t: (key: string) => string;
}

interface ThemeSectionProps {
    currentTheme: string;
    onThemeChange: (id: string) => void;
    themes: ThemeManifest[];
    onOpenThemesFolder: () => void;
    onDeleteTheme: (id: string, name: string) => void;
    t: (key: string) => string;
}

export function ThemeSection({
    currentTheme,
    onThemeChange,
    themes,
    onOpenThemesFolder,
    onDeleteTheme,
    t,
}: ThemeSectionProps) {
    return (
        <div className="premium-glass p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/10">
                        <Palette className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-base font-black text-foreground uppercase tracking-tight">
                            {t('settings.theme')}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground/70">
                            {t('appearance.themeDesc')}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onOpenThemesFolder}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/10 hover:bg-muted/20 border border-border/40 hover:border-primary/30 transition-all font-bold uppercase tracking-widest text-xxxs"
                    title={t('appearance.openThemesFolder')}
                >
                    <FolderOpen className="w-4 h-4" />
                    <span className="text-xs font-medium">{t('appearance.themesFolder')}</span>
                </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {themes.map((theme: ThemeManifest) => {
                    const isActive = currentTheme === theme.id;
                    const isBuiltIn = theme.id === 'black' || theme.id === 'white';
                    const displayName = isBuiltIn ? t(`appearance.themes.${theme.id}`) : theme.displayName;

                    return (
                        <div key={theme.id} className="group relative">
                            <button
                                onClick={() => onThemeChange(theme.id)}
                                className={cn(
                                    'w-full flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-500',
                                    isActive
                                        ? 'border-primary/50 bg-primary/10 shadow-xl shadow-primary/5 ring-1 ring-primary/20 scale-102'
                                        : 'border-border/40 bg-muted/5 hover:border-primary/30 hover:bg-muted/10'
                                )}
                            >
                                <div
                                    data-theme={theme.id}
                                    className="h-16 w-16 rounded-2xl border-2 flex items-end p-2.5 transition-all duration-500 group-hover:scale-110 shadow-2xl"
                                    style={{
                                        background: 'hsl(var(--background))',
                                        borderColor: isActive
                                            ? 'hsl(var(--primary))'
                                            : 'hsl(var(--border) / 0.5)',
                                    }}
                                >
                                    <span
                                        className="h-2.5 w-8 rounded-full shadow-sm"
                                        style={{ background: 'hsl(var(--primary))' }}
                                    />
                                </div>
                                <div className="text-center">
                                    <div
                                        className={cn(
                                            'text-xxxs font-black uppercase tracking-widest transition-colors',
                                            isActive ? 'text-primary' : 'text-muted-foreground'
                                        )}
                                    >
                                        {displayName}
                                    </div>
                                    {theme.author && (
                                        <div className="text-xxxs text-muted-foreground/50 font-bold uppercase tracking-tighter mt-1">
                                            by {theme.author}
                                        </div>
                                    )}
                                </div>
                                {isActive && (
                                    <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary border-2 border-background shadow-lg animate-in zoom-in duration-300" />
                                )}
                            </button>
                            {!isActive && !isBuiltIn && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteTheme(theme.id, displayName);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:text-destructive-foreground active:scale-95"
                                    title={t('appearance.deleteTheme') || 'Delete Theme'}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    title: string;
    description: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, title, description }) => (
    <div className="flex items-center justify-between p-5 rounded-2xl border border-border/40 bg-muted/5 hover:bg-muted/10 transition-colors group">
        <div>
            <div className="text-sm font-black text-foreground uppercase tracking-tight">
                {title}
            </div>
            <div className="text-xs font-medium text-muted-foreground/70">{description}</div>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
    </div>
);

interface AccessibilitySectionProps {
    highContrast: boolean;
    reduceMotion: boolean;
    onHighContrastChange: (checked: boolean) => void;
    onReduceMotionChange: (checked: boolean) => void;
    t: (key: string) => string;
}

function AccessibilitySection({
    highContrast,
    reduceMotion,
    onHighContrastChange,
    onReduceMotionChange,
    t,
}: AccessibilitySectionProps) {
    return (
        <div className="premium-glass p-8 space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-warning/10 text-warning border border-warning/20 shadow-lg shadow-warning/10">
                    <Palette className="w-6 h-6 rotate-180" />
                </div>
                <div>
                    <div className="text-base font-black text-foreground uppercase tracking-tight">
                        {t('appearance.accessibility.title')}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground/70">
                        {t('appearance.accessibility.description')}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ToggleSwitch
                    checked={highContrast}
                    onChange={onHighContrastChange}
                    title={t('appearance.highContrast')}
                    description={t('appearance.highContrastDesc')}
                />
                <ToggleSwitch
                    checked={reduceMotion}
                    onChange={onReduceMotionChange}
                    title={t('appearance.reduceMotion')}
                    description={t('appearance.reduceMotionDesc')}
                />
            </div>
        </div>
    );
}

const normalizeTheme = (rawTheme: string): string => {
    if (rawTheme === 'dark' || rawTheme === 'system') {
        return 'black';
    }
    if (rawTheme === 'light') {
        return 'white';
    }
    return rawTheme;
};

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ settings, updateGeneral, t }) => {
    const currentTheme = normalizeTheme(settings?.general.theme ?? 'black');
    const [themes, setThemes] = useState<ThemeManifest[]>([]);

    // Load themes from runtime directory
    useEffect(() => {
        const loadThemes = async () => {
            try {
                const loadedThemes = await themeIpc.getAllThemes();
                setThemes(loadedThemes);
            } catch (error) {
                appLogger.error('AppearanceTab', 'Failed to load themes', error as Error);
            }
        };
        void loadThemes();

        // Listen for theme updates
        if (window.electron?.ipcRenderer) {
            const removeListener = window.electron.ipcRenderer.on('theme:runtime:updated', () => {
                void loadThemes();
            });
            return () => {
                if (typeof removeListener === 'function') {
                    removeListener();
                }
            };
        }
        return undefined;
    }, []);

    const handleThemeChange = (themeId: string): void => {
        updateGeneral({ theme: themeId });
        document.documentElement.setAttribute('data-theme', themeId);
    };

    const handleHighContrastChange = (checked: boolean): void => {
        updateGeneral({ highContrast: checked });
        document.documentElement.classList.toggle('high-contrast', checked);
    };

    const handleReduceMotionChange = (checked: boolean): void => {
        updateGeneral({ reduceMotion: checked });
        document.documentElement.classList.toggle('reduce-motion', checked);
    };

    const handleOpenThemesFolder = (): void => {
        void themeIpc.openThemesDirectory();
    };

    const handleDeleteTheme = async (themeId: string, displayName: string): Promise<void> => {
        const confirmMsg = t('appearance.confirmDeleteTheme') !== 'appearance.confirmDeleteTheme' 
            ? t('appearance.confirmDeleteTheme') 
            : `Are you sure you want to delete '${displayName}'?`;
             
        if (confirmDialog(confirmMsg)) {
            await themeIpc.uninstallTheme(themeId);
        }
    };

    return (
        <div className="space-y-10 pb-20">
            {/* 1. Global Application Theme */}
            <section className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <Palette className="w-5 h-5 text-primary" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-foreground/70">
                        {t('settings.tabs.appearance')} - {t('settings.categories.general') || 'Uygulama Teması'}
                    </h2>
                </div>
                <ThemeSection
                    currentTheme={currentTheme}
                    onThemeChange={handleThemeChange}
                    themes={themes}
                    onOpenThemesFolder={handleOpenThemesFolder}
                    onDeleteTheme={(themeId, displayName) => { void handleDeleteTheme(themeId, displayName); }}
                    t={t}
                />
            </section>

            {/* 2. Terminal Specific Appearance */}
            <section className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <Code className="w-5 h-5 text-primary" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-foreground/70">
                        Terminal Görünümü
                    </h2>
                </div>
                <TerminalAppearanceSection t={t} />
            </section>

            {/* 3. Accessibility */}
            <section className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <Shield className="w-5 h-5 text-primary" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-foreground/70">
                        {t('appearance.accessibility.title')}
                    </h2>
                </div>
                <AccessibilitySection
                    highContrast={Boolean(settings?.general.highContrast)}
                    reduceMotion={Boolean(settings?.general.reduceMotion)}
                    onHighContrastChange={handleHighContrastChange}
                    onReduceMotionChange={handleReduceMotionChange}
                    t={t}
                />
            </section>
        </div>
    );
};

