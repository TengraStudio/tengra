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

const THEME_OPTIONS: ThemeOption[] = [
    { id: 'black', label: 'Black' },
    { id: 'white', label: 'White' }
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
    <div className="bg-card p-6 rounded-2xl border border-border space-y-6">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary"><Palette className="w-5 h-5" /></div>
            <div>
                <div className="text-sm font-bold text-foreground">{t('settings.theme')}</div>
                <div className="text-xs text-muted-foreground">{t('appearance.themeDesc')}</div>
            </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {THEME_OPTIONS.map((theme) => {
                const isActive = currentTheme === theme.id;
                return (
                    <button
                        key={theme.id}
                        onClick={() => onThemeChange(theme.id)}
                        className={cn("w-full p-3 rounded-xl border transition-all text-left group", isActive ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-accent/30 hover:bg-accent/50")}
                    >
                        <div className="flex items-center gap-3 w-full">
                            <div data-theme={theme.id} className="h-10 w-10 rounded-xl border flex items-end p-2 transition-transform group-hover:scale-105" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
                                <span className="h-2 w-6 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-foreground truncate">{theme.label}</div>
                                <div className="text-[10px] text-muted-foreground truncate">{theme.id}</div>
                            </div>
                            {isActive && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
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
    <div className="bg-card p-6 rounded-2xl border border-border space-y-6">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-success/10 text-success"><Type className="w-5 h-5" /></div>
            <div>
                <div className="text-sm font-bold text-foreground">{t('appearance.font')}</div>
                <div className="text-xs text-muted-foreground">{t('appearance.fontDesc')}</div>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('appearance.fontFamily')}</div>
                <div className="grid gap-2">
                    {fontOptions.map((font) => (
                        <button
                            key={font.id}
                            onClick={() => onFontChange(font.id)}
                            className={cn("w-full px-4 py-3 rounded-xl border text-left text-sm transition-all", currentFont === font.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-accent/30 text-muted-foreground hover:bg-accent/50 hover:text-foreground")}
                            style={{ fontFamily: font.id }}
                        >
                            {font.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                    <span>{t('appearance.fontSize')}</span>
                    <span className="text-primary">{fontSize}px</span>
                </div>
                <div className="p-6 rounded-2xl bg-accent/30 border border-border flex flex-col items-center gap-6">
                    <div className="text-center transition-all bg-background p-4 rounded-xl border border-border w-full" style={{ fontSize: `${fontSize}px`, fontFamily: currentFont }}>
                        {t('appearance.previewText')}
                    </div>
                    <input type="range" min="12" max="20" step="1" value={fontSize} onChange={e => onFontSizeChange(parseInt(e.target.value))} className="w-full accent-primary" />
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
    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-accent/30">
        <div>
            <div className="text-sm font-bold text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
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
    <div className="bg-card p-6 rounded-2xl border border-border space-y-6">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange/10 text-orange"><Type className="w-5 h-5" /></div>
            <div>
                <div className="text-sm font-bold text-foreground">{t('appearance.accessibility')}</div>
                <div className="text-xs text-muted-foreground">{t('appearance.accessibilityDesc')}</div>
            </div>
        </div>
        <div className="space-y-4">
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
    const currentTheme = normalizeTheme(settings?.general.theme ?? 'graphite');
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
