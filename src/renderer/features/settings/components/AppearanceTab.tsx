import { Palette, Type } from 'lucide-react'
import React from 'react'

import { cn } from '@/lib/utils'
import { AppSettings } from '@/types/settings'

interface AppearanceTabProps {
    settings: AppSettings | null
    updateGeneral: (patch: Partial<AppSettings['general']>) => void
    t: (key: string) => string
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ settings, updateGeneral, t }) => {
    const themeOptions = [
        { id: 'graphite', label: t('appearance.themes.graphite') }, { id: 'obsidian', label: t('appearance.themes.obsidian') }, { id: 'midnight', label: t('appearance.themes.midnight') },
        { id: 'deep-forest', label: t('appearance.themes.deepForest') }, { id: 'dracula', label: t('appearance.themes.dracula') }, { id: 'cyberpunk', label: t('appearance.themes.cyberpunk') },
        { id: 'matrix', label: t('appearance.themes.matrix') }, { id: 'synthwave', label: t('appearance.themes.synthwave') }, { id: 'lava', label: t('appearance.themes.lava') },
        { id: 'aurora', label: t('appearance.themes.aurora') }, { id: 'snow', label: t('appearance.themes.snow') }, { id: 'sand', label: t('appearance.themes.sand') },
        { id: 'sky', label: t('appearance.themes.sky') }, { id: 'minimal', label: t('appearance.themes.minimal') }, { id: 'paper', label: t('appearance.themes.paper') },
        { id: 'gold', label: t('appearance.themes.gold') }, { id: 'ocean', label: t('appearance.themes.ocean') }, { id: 'rose', label: t('appearance.themes.rose') },
        { id: 'coffee', label: t('appearance.themes.coffee') }, { id: 'serenity', label: t('appearance.themes.serenity') }, { id: 'neon-pulse', label: t('appearance.themes.neonPulse') },
        { id: 'cyber-future', label: t('appearance.themes.cyberFuture') }, { id: 'soft-velvet', label: t('appearance.themes.softVelvet') }
    ]

    const fontOptions = [
        { id: "'Inter', system-ui, sans-serif", label: `Inter (${t('appearance.default')})` },
        { id: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
        { id: "'Roboto', sans-serif", label: 'Roboto' },
        { id: "'Outfit', sans-serif", label: 'Outfit' },
        { id: "system-ui, sans-serif", label: t('appearance.system') }
    ]

    const rawTheme = settings?.general?.theme || 'graphite'
    const currentTheme = rawTheme === 'dark' || rawTheme === 'system' ? 'graphite' : rawTheme === 'light' ? 'snow' : rawTheme
    const currentFont = settings?.general?.fontFamily || fontOptions[0]!.id

    const handleThemeChange = (themeId: string) => {
        updateGeneral({ theme: themeId })
        document.documentElement.setAttribute('data-theme', themeId)
    }

    const handleFontChange = (fontId: string) => {
        updateGeneral({ fontFamily: fontId })
        document.documentElement.style.setProperty('--font-family', fontId)
    }

    return (
        <div className="space-y-6">
            {/* Theme Section */}
            <div className="bg-card p-6 rounded-2xl border border-border space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Palette className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-foreground">{t('settings.theme')}</div>
                        <div className="text-xs text-muted-foreground">{t('appearance.themeDesc')}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {themeOptions.map((theme) => {
                        const isActive = currentTheme === theme.id
                        return (
                            <button
                                key={theme.id}
                                onClick={() => handleThemeChange(theme.id)}
                                className={cn(
                                    "w-full p-3 rounded-xl border transition-all text-left group",
                                    isActive
                                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                                        : "border-border bg-accent/30 hover:bg-accent/50"
                                )}
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
                        )
                    })}
                </div>
            </div>

            {/* Typography Section */}
            <div className="bg-card p-6 rounded-2xl border border-border space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                        <Type className="w-5 h-5" />
                    </div>
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
                                    onClick={() => handleFontChange(font.id)}
                                    className={cn(
                                        "w-full px-4 py-3 rounded-xl border text-left text-sm transition-all",
                                        currentFont === font.id
                                            ? "border-primary bg-primary/5 text-primary"
                                            : "border-border bg-accent/30 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                    )}
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
                            <span className="text-primary">{settings?.general?.fontSize || 14}px</span>
                        </div>
                        <div className="p-6 rounded-2xl bg-accent/30 border border-border flex flex-col items-center gap-6">
                            <div
                                className="text-center transition-all bg-background p-4 rounded-xl border border-border w-full"
                                style={{ fontSize: `${settings?.general?.fontSize || 14}px`, fontFamily: currentFont }}
                            >
                                {t('appearance.previewText')}
                            </div>
                            <input
                                type="range"
                                min="12"
                                max="20"
                                step="1"
                                value={settings?.general?.fontSize || 14}
                                onChange={e => updateGeneral({ fontSize: parseInt(e.target.value) })}
                                className="w-full accent-primary"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Accessibility Section */}
            <div className="bg-card p-6 rounded-2xl border border-border space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                        <Type className="w-5 h-5" /> {/* Using Type temporarily or import Eye */}
                    </div>
                    <div>
                        <div className="text-sm font-bold text-foreground">{t('appearance.accessibility')}</div>
                        <div className="text-xs text-muted-foreground">{t('appearance.accessibilityDesc')}</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-accent/30">
                        <div>
                            <div className="text-sm font-bold text-foreground">{t('appearance.highContrast')}</div>
                            <div className="text-xs text-muted-foreground">{t('appearance.highContrastDesc')}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!settings?.general?.highContrast}
                                onChange={e => {
                                    updateGeneral({ highContrast: e.target.checked });
                                    document.documentElement.classList.toggle('high-contrast', e.target.checked);
                                }}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-accent/30">
                        <div>
                            <div className="text-sm font-bold text-foreground">{t('appearance.reduceMotion')}</div>
                            <div className="text-xs text-muted-foreground">{t('appearance.reduceMotionDesc')}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!settings?.general?.reduceMotion}
                                onChange={e => {
                                    updateGeneral({ reduceMotion: e.target.checked });
                                    document.documentElement.classList.toggle('reduce-motion', e.target.checked);
                                }}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    )
}
