import React from 'react'
import { cn } from '@/lib/utils'
import { AppSettings } from '../../hooks/useSettingsLogic'

interface AppearanceTabProps {
    settings: AppSettings | null
    updateGeneral: (patch: Partial<AppSettings['general']>) => void
    t: any
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ settings, updateGeneral, t }) => {
    const themeOptions = [
        { id: 'graphite', label: 'Graphite' }, { id: 'obsidian', label: 'Obsidian' }, { id: 'midnight', label: 'Midnight' },
        { id: 'deep-forest', label: 'Deep Forest' }, { id: 'dracula', label: 'Dracula' }, { id: 'cyberpunk', label: 'Cyberpunk' },
        { id: 'matrix', label: 'Matrix' }, { id: 'synthwave', label: 'Synthwave' }, { id: 'lava', label: 'Lava' },
        { id: 'aurora', label: 'Aurora' }, { id: 'snow', label: 'Snow' }, { id: 'sand', label: 'Sand' },
        { id: 'sky', label: 'Sky' }, { id: 'minimal', label: 'Minimal' }, { id: 'paper', label: 'Paper' },
        { id: 'gold', label: 'Gold' }, { id: 'ocean', label: 'Ocean' }, { id: 'rose', label: 'Rose' },
        { id: 'coffee', label: 'Coffee' }, { id: 'serenity', label: 'Serenity' }, { id: 'neon-pulse', label: 'Neon Pulse' },
        { id: 'cyber-future', label: 'Cyber Future' }, { id: 'soft-velvet', label: 'Soft Velvet' }
    ]
    const rawTheme = settings?.general?.theme || 'graphite'
    const currentTheme = rawTheme === 'dark' || rawTheme === 'system' ? 'graphite' : rawTheme === 'light' ? 'snow' : rawTheme

    return (
        <div className="space-y-6">
            <div className="bg-card p-5 rounded-xl border border-border space-y-4">
                <div>
                    <div className="text-sm font-bold text-white">{t('settings.theme') || 'Tema'}</div>
                    <div className="text-xs text-muted-foreground">Tema paletlerini secin.</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {themeOptions.map((theme) => {
                        const isActive = currentTheme === theme.id
                        return (
                            <button key={theme.id} onClick={() => updateGeneral({ theme: theme.id })} className={cn("w-full p-3 rounded-xl border transition-colors text-left", isActive ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/5 hover:bg-white/10")}>
                                <div className="flex items-center gap-3 w-full">
                                    <div data-theme={theme.id} className="h-10 w-10 rounded-xl border flex items-end p-2" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
                                        <span className="h-2 w-6 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-white">{theme.label}</div>
                                        <div className="text-xs text-muted-foreground">{theme.id}</div>
                                    </div>
                                    {isActive && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
            <div className="bg-card p-5 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-bold text-white">{t('settings.font') || 'Yazi Boyutu'}</div>
                        <div className="text-xs text-muted-foreground">Arayuz olcegi</div>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{settings?.general?.fontSize || 14}px</span>
                </div>
                <input type="range" min="12" max="20" step="1" value={settings?.general?.fontSize || 14} onChange={e => updateGeneral({ fontSize: parseInt(e.target.value) })} className="w-full accent-primary" />
            </div>
        </div>
    )
}
