import { Palette, Type } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { AppSettings } from '@/types/settings';

interface AppearanceTabProps {
    settings: AppSettings | null
    updateGeneral: (patch: Partial<AppSettings['general']>) => void
    t: (key: string) => string
}

interface ThemeOption { id: string; label: string }
interface FontOption { id: string; label: string }

const getThemeOptions = (t: (key: string) => string): ThemeOption[] => [
    { id: 'black', label: t('appearance.themes.black') },
    { id: 'white', label: t('appearance.themes.white') }
];

const createFontOptions = (t: (key: string) => string): FontOption[] => [
    { id: "'Inter', system-ui, sans-serif", label: `Inter (${t('appearance.default')})` },
    { id: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
    { id: "'Roboto', sans-serif", label: 'Roboto' },
    { id: "'Outfit', sans-serif", label: 'Outfit' },
    { id: "system-ui, sans-serif", label: t('appearance.system') }
];

interface ThemeSectionProps {
    currentTheme: string;
    onThemeChange: (id: string) => void;
    t: (key: string) => string;
}

const ThemeSection: React.FC<ThemeSectionProps> = ({ currentTheme, onThemeChange, t }) => (
    <div className="premium-glass p-8 space-y-8">
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/10">
                <Palette className="w-6 h-6" />
            </div>
            <div>
                <div className="text-base font-black text-foreground uppercase tracking-tight">{t('settings.theme')}</div>
                <div className="text-xs font-medium text-muted-foreground/70">{t('appearance.themeDesc')}</div>
            </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {getThemeOptions(t).map((theme: ThemeOption) => {
                const isActive = currentTheme === theme.id;
                return (
                    <button
                        key={theme.id}
                        onClick={() => onThemeChange(theme.id)}
                        className={cn(
                            "group relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-500",
                            isActive
                                ? "border-primary/50 bg-primary/10 shadow-xl shadow-primary/5 ring-1 ring-primary/20 scale-[1.02]"
                                : "border-border/40 bg-muted/5 hover:border-primary/30 hover:bg-muted/10"
                        )}
                    >
                        <div
                            data-theme={theme.id}
                            className="h-16 w-16 rounded-2xl border-2 flex items-end p-2.5 transition-all duration-500 group-hover:scale-110 shadow-2xl"
                            style={{
                                background: 'hsl(var(--background))',
                                borderColor: isActive ? 'hsl(var(--primary))' : 'hsl(var(--border) / 0.5)'
                            }}
                        >
                            <span className="h-2.5 w-8 rounded-full shadow-sm" style={{ background: 'hsl(var(--primary))' }} />
                        </div>
                        <div className="text-center">
                            <div className={cn("text-xs font-black uppercase tracking-widest transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
                                {theme.label}
                            </div>
                        </div>
                        {isActive && (
                            <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary border-2 border-background shadow-lg animate-in zoom-in duration-300" />
                        )}
                    </button>
                );
            })}
        </div>
    </div>
);

interface TypographySectionProps {
    currentFont: string;
    fontSize: number;
    fontOptions: FontOption[];
    onFontChange: (id: string) => void;
    onFontSizeChange: (size: number) => void;
    t: (key: string) => string;
}

const TypographySection: React.FC<TypographySectionProps> = ({ currentFont, fontSize, fontOptions, onFontChange, onFontSizeChange, t }) => (
    <div className="premium-glass p-8 space-y-8">
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-success/10 text-success border border-success/20 shadow-lg shadow-success/10">
                <Type className="w-6 h-6" />
            </div>
            <div>
                <div className="text-base font-black text-foreground uppercase tracking-tight">{t('appearance.font')}</div>
                <div className="text-xs font-medium text-muted-foreground/70">{t('appearance.fontDesc')}</div>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-1">{t('appearance.fontFamily')}</div>
                <div className="grid gap-2">
                    {fontOptions.map((font) => (
                        <button
                            key={font.id}
                            onClick={() => onFontChange(font.id)}
                            className={cn(
                                "w-full px-5 py-4 rounded-xl border text-left text-sm transition-all duration-300",
                                currentFont === font.id
                                    ? "border-primary/50 bg-primary/10 text-primary shadow-lg shadow-primary/5 ring-1 ring-primary/20"
                                    : "border-border/40 bg-muted/5 text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                            )}
                            style={{ fontFamily: font.id }}
                        >
                            {font.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-1 flex justify-between">
                    <span>{t('appearance.fontSize')}</span>
                    <span className="text-primary">{fontSize}px</span>
                </div>
                <div className="p-8 rounded-3xl bg-muted/5 border border-border/40 flex flex-col items-center gap-8 shadow-inner">
                    <div className="text-center transition-all bg-background/50 backdrop-blur-md p-6 rounded-2xl border border-border/40 w-full shadow-2xl" style={{ fontSize: `${fontSize}px`, fontFamily: currentFont }}>
                        {t('appearance.previewText')}
                    </div>
                    <div className="w-full space-y-2">
                        <input
                            type="range"
                            min="12"
                            max="20"
                            step="1"
                            value={fontSize}
                            onChange={e => onFontSizeChange(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xxxs font-black text-muted-foreground uppercase opacity-50 px-1">
                            <span>12px</span>
                            <span>20px</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    title: string;
    description: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, title, description }) => (
    <div className="flex items-center justify-between p-5 rounded-2xl border border-border/40 bg-muted/5 hover:bg-muted/10 transition-colors group">
        <div>
            <div className="text-sm font-black text-foreground uppercase tracking-tight">{title}</div>
            <div className="text-xs font-medium text-muted-foreground/70">{description}</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer scale-110">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
            <div className="w-12 h-6.5 bg-muted/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:shadow-lg after:transition-all peer-checked:bg-primary border border-border/20"></div>
        </label>
    </div>
);

interface AccessibilitySectionProps {
    highContrast: boolean;
    reduceMotion: boolean;
    onHighContrastChange: (checked: boolean) => void;
    onReduceMotionChange: (checked: boolean) => void;
    t: (key: string) => string;
}

const AccessibilitySection: React.FC<AccessibilitySectionProps> = ({ highContrast, reduceMotion, onHighContrastChange, onReduceMotionChange, t }) => (
    <div className="premium-glass p-8 space-y-8">
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-warning/10 text-orange border border-warning/20 shadow-lg shadow-warning/10">
                <Palette className="w-6 h-6 rotate-180" />
            </div>
            <div>
                <div className="text-base font-black text-foreground uppercase tracking-tight">{t('appearance.accessibility')}</div>
                <div className="text-xs font-medium text-muted-foreground/70">{t('appearance.accessibilityDesc')}</div>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSwitch checked={highContrast} onChange={onHighContrastChange} title={t('appearance.highContrast')} description={t('appearance.highContrastDesc')} />
            <ToggleSwitch checked={reduceMotion} onChange={onReduceMotionChange} title={t('appearance.reduceMotion')} description={t('appearance.reduceMotionDesc')} />
        </div>
    </div>
);

const normalizeTheme = (rawTheme: string): string => {
    if (rawTheme === 'dark' || rawTheme === 'system') { return 'graphite'; }
    if (rawTheme === 'light') { return 'snow'; }
    return rawTheme;
};

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ settings, updateGeneral, t }) => {
    const fontOptions = createFontOptions(t);
    const currentTheme = normalizeTheme(settings?.general.theme ?? 'black');
    const currentFont = settings?.general.fontFamily ?? fontOptions[0].id;
    const fontSize = settings?.general.fontSize ?? 14;

    const handleThemeChange = (themeId: string) => {
        updateGeneral({ theme: themeId });
        document.documentElement.setAttribute('data-theme', themeId);
    };

    const handleFontChange = (fontId: string) => {
        updateGeneral({ fontFamily: fontId });
        document.documentElement.style.setProperty('--font-family', fontId);
    };

    const handleHighContrastChange = (checked: boolean) => {
        updateGeneral({ highContrast: checked });
        document.documentElement.classList.toggle('high-contrast', checked);
    };

    const handleReduceMotionChange = (checked: boolean) => {
        updateGeneral({ reduceMotion: checked });
        document.documentElement.classList.toggle('reduce-motion', checked);
    };

    return (
        <div className="space-y-6">
            <ThemeSection currentTheme={currentTheme} onThemeChange={handleThemeChange} t={t} />
            <TypographySection currentFont={currentFont} fontSize={fontSize} fontOptions={fontOptions} onFontChange={handleFontChange} onFontSizeChange={size => updateGeneral({ fontSize: size })} t={t} />
            <AccessibilitySection
                highContrast={Boolean(settings?.general.highContrast)}
                reduceMotion={Boolean(settings?.general.reduceMotion)}
                onHighContrastChange={handleHighContrastChange}
                onReduceMotionChange={handleReduceMotionChange}
                t={t}
            />
        </div>
    );
};
