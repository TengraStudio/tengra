/**
 * Theme Store Component
 * Browse, preview, and install themes for the application.
 */

import { Check, Download, Moon, Palette, Search, Star, Sun } from 'lucide-react'
import React, { useMemo,useState } from 'react'

import { cn } from '@/lib/utils'

interface Theme {
    id: string
    name: string
    author: string
    description: string
    preview: string
    colors: {
        primary: string
        background: string
        foreground: string
        accent: string
    }
    downloads: number
    rating: number
    isInstalled?: boolean
    isPremium?: boolean
}

const BUILT_IN_THEMES: Theme[] = [
    {
        id: 'dark-default',
        name: 'Dark Default',
        author: 'Orbit Team',
        description: 'The default dark theme with purple accents',
        preview: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        colors: { primary: '#8b5cf6', background: '#0f0f14', foreground: '#f4f4f5', accent: '#6366f1' },
        downloads: 10000,
        rating: 4.8,
        isInstalled: true
    },
    {
        id: 'light-default',
        name: 'Light Default',
        author: 'Orbit Team',
        description: 'A clean light theme for daytime use',
        preview: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        colors: { primary: '#6366f1', background: '#ffffff', foreground: '#1f2937', accent: '#8b5cf6' },
        downloads: 5000,
        rating: 4.5,
        isInstalled: false
    },
    {
        id: 'nord',
        name: 'Nord',
        author: 'Arctic Ice Studio',
        description: 'An arctic, north-bluish color palette',
        preview: 'linear-gradient(135deg, #2e3440 0%, #3b4252 100%)',
        colors: { primary: '#88c0d0', background: '#2e3440', foreground: '#eceff4', accent: '#81a1c1' },
        downloads: 8500,
        rating: 4.9,
        isInstalled: false
    },
    {
        id: 'dracula',
        name: 'Dracula',
        author: 'Dracula Theme',
        description: 'A dark theme with vibrant colors',
        preview: 'linear-gradient(135deg, #282a36 0%, #44475a 100%)',
        colors: { primary: '#bd93f9', background: '#282a36', foreground: '#f8f8f2', accent: '#ff79c6' },
        downloads: 12000,
        rating: 4.7,
        isInstalled: false
    },
    {
        id: 'monokai',
        name: 'Monokai Pro',
        author: 'Monokai',
        description: 'Professional dark theme with warm accents',
        preview: 'linear-gradient(135deg, #2d2a2e 0%, #403e41 100%)',
        colors: { primary: '#ffd866', background: '#2d2a2e', foreground: '#fcfcfa', accent: '#a9dc76' },
        downloads: 7200,
        rating: 4.6,
        isInstalled: false,
        isPremium: true
    },
    {
        id: 'github-dark',
        name: 'GitHub Dark',
        author: 'GitHub',
        description: 'The official GitHub dark theme',
        preview: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
        colors: { primary: '#58a6ff', background: '#0d1117', foreground: '#c9d1d9', accent: '#238636' },
        downloads: 9800,
        rating: 4.8,
        isInstalled: false
    },
    {
        id: 'solarized-dark',
        name: 'Solarized Dark',
        author: 'Ethan Schoonover',
        description: 'Precision colors for machines and people',
        preview: 'linear-gradient(135deg, #002b36 0%, #073642 100%)',
        colors: { primary: '#268bd2', background: '#002b36', foreground: '#839496', accent: '#2aa198' },
        downloads: 6100,
        rating: 4.4,
        isInstalled: false
    },
    {
        id: 'tokyo-night',
        name: 'Tokyo Night',
        author: 'enkia',
        description: 'A clean theme celebrating the lights of Tokyo',
        preview: 'linear-gradient(135deg, #1a1b26 0%, #24283b 100%)',
        colors: { primary: '#7aa2f7', background: '#1a1b26', foreground: '#a9b1d6', accent: '#bb9af7' },
        downloads: 11000,
        rating: 4.9,
        isInstalled: false
    }
]

interface ThemeStoreProps {
    onInstallTheme?: (themeId: string) => void
    onApplyTheme?: (themeId: string) => void
    currentThemeId?: string
}

export const ThemeStore: React.FC<ThemeStoreProps> = ({
    onApplyTheme,
    currentThemeId = 'dark-default'
}) => {
    const [searchQuery, setSearchQuery] = useState('')
    const [filter, setFilter] = useState<'all' | 'installed' | 'dark' | 'light'>('all')
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)

    const filteredThemes = useMemo(() => {
        let themes = BUILT_IN_THEMES

        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            themes = themes.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.author.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q)
            )
        }

        if (filter === 'installed') {
            themes = themes.filter(t => t.isInstalled)
        } else if (filter === 'dark') {
            themes = themes.filter(t => t.name.toLowerCase().includes('dark') || t.colors.background.startsWith('#0') || t.colors.background.startsWith('#1') || t.colors.background.startsWith('#2'))
        } else if (filter === 'light') {
            themes = themes.filter(t => t.name.toLowerCase().includes('light') || t.colors.background.startsWith('#f') || t.colors.background.startsWith('#e'))
        }

        return themes
    }, [searchQuery, filter])

    const ThemeCard = ({ theme }: { theme: Theme }) => {
        const isActive = currentThemeId === theme.id

        return (
            <div
                onClick={() => setSelectedTheme(theme)}
                className={cn(
                    "group relative rounded-xl overflow-hidden border transition-all cursor-pointer",
                    isActive
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border/30 hover:border-border/60"
                )}
            >
                {/* Preview */}
                <div
                    className="h-32 w-full"
                    style={{ background: theme.preview }}
                >
                    <div className="absolute top-2 right-2 flex gap-1">
                        {theme.isPremium && (
                            <span className="px-2 py-0.5 bg-amber-500/90 text-white text-[10px] font-bold rounded-full">PRO</span>
                        )}
                        {isActive && (
                            <span className="px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> Active
                            </span>
                        )}
                    </div>

                    {/* Color swatches */}
                    <div className="absolute bottom-2 left-2 flex gap-1">
                        {Object.values(theme.colors).map((color, i) => (
                            <div
                                key={i}
                                className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                                style={{ background: color }}
                            />
                        ))}
                    </div>
                </div>

                {/* Info */}
                <div className="p-3 bg-card/50">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-sm truncate">{theme.name}</h3>
                        <div className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-xs">{theme.rating}</span>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{theme.author}</p>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-muted-foreground/60">
                            <Download className="w-3 h-3 inline mr-1" />
                            {theme.downloads.toLocaleString()}
                        </span>
                        {!isActive && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onApplyTheme?.(theme.id)
                                }}
                                className="px-2 py-1 text-[10px] font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
                            >
                                Apply
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border/30">
                <div className="flex items-center gap-3 mb-4">
                    <Palette className="w-6 h-6 text-primary" />
                    <div>
                        <h1 className="text-lg font-bold">Theme Store</h1>
                        <p className="text-xs text-muted-foreground">Customize your workspace appearance</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                        type="text"
                        placeholder="Search themes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-muted/30 border border-border/30 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/50"
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                    {[
                        { id: 'all', label: 'All', icon: Palette },
                        { id: 'installed', label: 'Installed', icon: Check },
                        { id: 'dark', label: 'Dark', icon: Moon },
                        { id: 'light', label: 'Light', icon: Sun }
                    ].map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setFilter(id as typeof filter)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                filter === id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Theme Grid */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredThemes.map(theme => (
                        <ThemeCard key={theme.id} theme={theme} />
                    ))}
                </div>

                {filteredThemes.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                        <Palette className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm">No themes found</p>
                    </div>
                )}
            </div>

            {/* Theme Preview Modal */}
            {selectedTheme && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setSelectedTheme(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-card rounded-xl max-w-lg w-full overflow-hidden shadow-2xl"
                    >
                        <div className="h-40" style={{ background: selectedTheme.preview }} />
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold">{selectedTheme.name}</h2>
                                <div className="flex items-center gap-1 text-amber-500">
                                    <Star className="w-4 h-4 fill-current" />
                                    <span>{selectedTheme.rating}</span>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">by {selectedTheme.author}</p>
                            <p className="text-sm mb-4">{selectedTheme.description}</p>

                            <div className="flex gap-2 mb-4">
                                {Object.entries(selectedTheme.colors).map(([name, color]) => (
                                    <div key={name} className="flex flex-col items-center">
                                        <div
                                            className="w-8 h-8 rounded-lg border border-border/30 shadow-sm"
                                            style={{ background: color }}
                                        />
                                        <span className="text-[10px] text-muted-foreground mt-1 capitalize">{name}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        onApplyTheme?.(selectedTheme.id)
                                        setSelectedTheme(null)
                                    }}
                                    className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90"
                                >
                                    Apply Theme
                                </button>
                                <button
                                    onClick={() => setSelectedTheme(null)}
                                    className="px-4 py-2 bg-muted text-muted-foreground rounded-lg font-medium text-sm hover:bg-muted/80"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ThemeStore
