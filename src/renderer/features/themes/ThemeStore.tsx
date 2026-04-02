/**
 * Theme Store Component
 * Browse, preview, and install themes for the application.
 */

import { Check, Download, Moon, Palette, Search, Star, Sun } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

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
        id: 'black',
        name: 'themeStore.themes.black.name',
        author: 'themeStore.authorTengraTeam',
        description: 'themeStore.themes.black.description',
        preview: '#000000',
        colors: { primary: '#0ea5e9', background: '#000000', foreground: 'white', accent: '#0c4a6e' },
        downloads: 0,
        rating: 5.0,
        isInstalled: true
    },
    {
        id: 'white',
        name: 'themeStore.themes.white.name',
        author: 'themeStore.authorTengraTeam',
        description: 'themeStore.themes.white.description',
        preview: 'white',
        colors: { primary: '#4f46e5', background: 'white', foreground: '#000000', accent: '#eef2ff' },
        downloads: 0,
        rating: 5.0,
        isInstalled: true
    }
];

const ThemeCard: React.FC<{
    theme: Theme;
    currentThemeId: string;
    onApplyTheme?: (id: string) => void;
    onSelect: (theme: Theme) => void;
    t: (key: string) => string;
}> = ({ theme, currentThemeId, onApplyTheme, onSelect, t }) => {
    const isActive = currentThemeId === theme.id;
    return (
        <div
            onClick={() => onSelect(theme)}
            className={cn(
                "group relative rounded-xl overflow-hidden border transition-all cursor-pointer",
                isActive ? "border-primary ring-2 ring-primary/20" : "border-border/50 hover:border-border transition-all duration-200"
            )}
        >
            <div className="h-32 w-full" style={{ background: theme.preview }}>
                <div className="absolute top-2 right-2 flex gap-1">
                    {theme.isPremium && <span className="px-2 py-0.5 bg-warning/90 text-primary-foreground text-xxs font-bold rounded-full">{t('themeStore.pro')}</span>}
                    {isActive && <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xxs font-bold rounded-full flex items-center gap-1"><Check className="w-3 h-3" /> {t('themeStore.active')}</span>}
                </div>
                <div className="absolute bottom-2 left-2 flex gap-1">
                    {Object.values(theme.colors).map((color, i) => (
                        <div key={i} className="w-4 h-4 rounded-full border border-border/20 shadow-sm" style={{ background: color }} />
                    ))}
                </div>
            </div>
            <div className="p-3 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-sm truncate">{theme.name}</h3>
                    <div className="flex items-center gap-1 text-warning"><Star className="w-3 h-3 fill-current" /><span className="text-xs">{theme.rating}</span></div>
                </div>
                <p className="text-xs text-muted-foreground truncate">{theme.author}</p>
                <div className="flex items-center justify-between mt-2">
                    <span className="text-xxs text-muted-foreground/60"><Download className="w-3 h-3 inline mr-1" />{theme.downloads.toLocaleString()}</span>
                    {!isActive && (
                        <button
                            onClick={(e) => { e.stopPropagation(); void onApplyTheme?.(theme.id); }}
                            className="px-2 py-1 text-xxs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
                        >{t('themeStore.apply')}</button>
                    )}
                </div>
            </div>
        </div>
    );
};

const ThemePreviewModal: React.FC<{
    theme: Theme;
    onApply: (id: string) => void;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ theme, onApply, onClose, t }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="flex max-h-[min(88vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/30 bg-card shadow-lg">
            <div className="h-32 sm:h-40" style={{ background: theme.preview }} />
            <div className="overflow-y-auto p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-semibold">{theme.name}</h2>
                    <div className="flex items-center gap-1 text-warning"><Star className="w-4 h-4 fill-current" /><span>{theme.rating}</span></div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{t('themeStore.by')} {theme.author}</p>
                <p className="text-sm mb-4">{theme.description}</p>
                <div className="mb-4 flex flex-wrap gap-2">
                    {Object.entries(theme.colors).map(([name, color]) => (
                        <div key={name} className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-lg border border-border/30" style={{ background: color }} />
                            <span className="text-xxs text-muted-foreground mt-1 capitalize">{name}</span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button onClick={() => onApply(theme.id)} className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{t('themeStore.apply')}</button>
                    <button onClick={onClose} className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80">{t('common.cancel')}</button>
                </div>
            </div>
        </div>
    </div>
);

const useThemeStoreLogic = (language: Language) => {
    const { t } = useTranslation(language);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'installed' | 'dark' | 'light'>('all');
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

    const builtInThemes = useMemo(() => BUILT_IN_THEMES.map(theme => ({
        ...theme,
        name: t(theme.name),
        author: t(theme.author),
        description: t(theme.description)
    })), [t]);

    const filteredThemes = useMemo(() => {
        let themes = builtInThemes;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            themes = themes.filter(t => t.name.toLowerCase().includes(q) || t.author.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
        }
        if (filter === 'installed') {
            themes = themes.filter(t => t.isInstalled);
        } else if (filter === 'dark') {
            themes = themes.filter(t => t.id.includes('dark') || t.name.toLowerCase().includes('dark') || t.id === 'black');
        } else if (filter === 'light') {
            themes = themes.filter(t => t.id.includes('light') || t.name.toLowerCase().includes('light') || t.id === 'white');
        }
        return themes;
    }, [searchQuery, filter, builtInThemes]);

    return {
        t,
        searchQuery,
        setSearchQuery,
        filter,
        setFilter,
        selectedTheme,
        setSelectedTheme,
        filteredThemes
    };
};

interface ThemeStoreProps {
    onApplyTheme?: (themeId: string) => void
    currentThemeId?: string
    language: Language
}

export const ThemeStore: React.FC<ThemeStoreProps> = ({
    onApplyTheme,
    currentThemeId = 'dark-default',
    language
}) => {
    const {
        t, searchQuery, setSearchQuery, filter, setFilter, selectedTheme, setSelectedTheme, filteredThemes
    } = useThemeStoreLogic(language);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                    <Palette className="w-6 h-6 text-primary" />
                    <div>
                        <h1 className="text-lg font-bold">{t('themeStore.title')}</h1>
                        <p className="text-xs text-muted-foreground">{t('themeStore.subtitle')}</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                        type="text"
                        placeholder={t('themeStore.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-muted/30 border border-border/30 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/50"
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                    {[
                        { id: 'all', label: t('themeStore.filterAll'), icon: Palette },
                        { id: 'installed', label: t('themeStore.filterInstalled'), icon: Check },
                        { id: 'dark', label: t('themeStore.filterDark'), icon: Moon },
                        { id: 'light', label: t('themeStore.filterLight'), icon: Sun }
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

            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredThemes.map(theme => (
                        <ThemeCard
                            key={theme.id}
                            theme={theme}
                            currentThemeId={currentThemeId}
                            onApplyTheme={onApplyTheme}
                            onSelect={setSelectedTheme}
                            t={t}
                        />
                    ))}
                </div>

                {filteredThemes.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                        <Palette className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm">{t('themeStore.noThemes')}</p>
                    </div>
                )}
            </div>

            {/* Theme Preview Modal */}
            {selectedTheme && (
                <ThemePreviewModal
                    theme={selectedTheme}
                    onApply={(id) => { onApplyTheme?.(id); setSelectedTheme(null); }}
                    onClose={() => setSelectedTheme(null)}
                    t={t}
                />
            )}
        </div>
    );
};

export default ThemeStore;


