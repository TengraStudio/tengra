import { Download, FileText, Loader2, Minus, Puzzle, Search, Square, X } from 'lucide-react';
import { type CSSProperties, ReactNode, useEffect, useMemo, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import changelogIndex from '@/data/changelog.index.json';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface TitleBarProps {
    children?: ReactNode;
    leftContent?: ReactNode;
    className?: string;
    onExtensionClick?: () => void;
}

export function TitleBar({ children, leftContent, className, onExtensionClick }: TitleBarProps) {
    const translation = useTranslation();
    const t = translation.t;
    const language: string =
        'language' in translation && typeof translation.language === 'string'
            ? translation.language
            : 'en';
    const [isChangelogOpen, setIsChangelogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem('changelog.search.history');
            return raw ? JSON.parse(raw) as string[] : [];
        } catch {
            return [];
        }
    });
    const [lazyStatus, setLazyStatus] = useState<{ loaded: number; registered: number; loading: number }>({
        loaded: 0,
        registered: 0,
        loading: 0
    });
    type AppRegionStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };
    const dragStyle: AppRegionStyle = { WebkitAppRegion: 'drag' };
    const noDragStyle: AppRegionStyle = { WebkitAppRegion: 'no-drag' };
    const changelogGroups = useMemo(() => {
        const grouped = new Map<string, ChangelogIndexEntry[]>();

        for (const entry of changelogIndex.entries as ChangelogIndexEntry[]) {
            const bucket = grouped.get(entry.date) ?? [];
            bucket.push(entry);
            grouped.set(entry.date, bucket);
        }

        return Array.from(grouped.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, items]) => ({ date, items }));
    }, []);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const status = await window.electron.lazyServices.getStatus();
                if (!mounted) {
                    return;
                }
                setLazyStatus({
                    loaded: status.totals.loaded,
                    registered: status.totals.registered,
                    loading: status.totals.loading
                });
            } catch {
                // noop
            }
        };
        void load();
        const timer = window.setInterval(() => {
            void load();
        }, 5000);
        return () => {
            mounted = false;
            window.clearInterval(timer);
        };
    }, []);

    const filteredGroups = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const fromMs = dateFrom ? Date.parse(dateFrom) : undefined;
        const toMs = dateTo ? Date.parse(dateTo) : undefined;

        return changelogGroups
            .map(group => {
                const nextItems = group.items.filter(item => {
                    const entryDateMs = Date.parse(item.date);
                    if (fromMs && entryDateMs < fromMs) {
                        return false;
                    }
                    if (toMs && entryDateMs > toMs) {
                        return false;
                    }
                    if (typeFilter !== 'all' && item.type !== typeFilter) {
                        return false;
                    }
                    if (!q) {
                        return true;
                    }
                    const content = getLocaleContent(item, language);
                    const haystack = [
                        content.title,
                        content.summary ?? '',
                        ...content.items,
                        item.type,
                        item.status,
                        ...item.components ?? []
                    ].join(' ').toLowerCase();
                    return haystack.includes(q);
                });
                return { ...group, items: nextItems };
            })
            .filter(group => group.items.length > 0);
    }, [changelogGroups, dateFrom, dateTo, language, searchQuery, typeFilter]);

    const typeOptions = useMemo(() => {
        const set = new Set<string>();
        for (const group of changelogGroups) {
            for (const item of group.items) {
                set.add(item.type);
            }
        }
        return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [changelogGroups]);

    const suggestions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) {
            return searchHistory.slice(0, 5);
        }
        const words = new Set<string>();
        for (const group of changelogGroups) {
            for (const item of group.items) {
                const content = getLocaleContent(item, language);
                const tokens = `${content.title} ${content.summary ?? ''}`.toLowerCase().split(/\s+/);
                for (const token of tokens) {
                    if (token.startsWith(q) && token.length > 2) {
                        words.add(token);
                    }
                }
            }
        }
        return Array.from(words).slice(0, 5);
    }, [changelogGroups, language, searchHistory, searchQuery]);

    const commitSearch = (forcedQuery?: string) => {
        const query = (forcedQuery ?? searchQuery).trim();
        if (!query) {
            return;
        }
        const nextHistory = [query, ...searchHistory.filter(item => item !== query)].slice(0, 12);
        setSearchHistory(nextHistory);
        localStorage.setItem('changelog.search.history', JSON.stringify(nextHistory));

        const analytics = {
            lastQuery: query,
            totalSearches: 1,
            lastSearchedAt: Date.now(),
        };
        try {
            const raw = localStorage.getItem('changelog.search.analytics');
            if (raw) {
                const parsed = JSON.parse(raw) as { totalSearches?: number };
                analytics.totalSearches = (parsed.totalSearches ?? 0) + 1;
            }
        } catch {
            // noop
        }
        localStorage.setItem('changelog.search.analytics', JSON.stringify(analytics));
    };

    const exportFilteredResults = () => {
        const exportPayload = filteredGroups.flatMap(group => group.items.map(item => ({
            id: item.id,
            date: item.date,
            type: item.type,
            status: item.status,
            content: getLocaleContent(item, language)
        })));
        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `changelog-search-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <header
                className={cn(
                    'h-12 border-b border-border/40 flex items-center justify-between px-6 bg-card/40 backdrop-blur-md z-40 select-none',
                    className
                )}
                style={dragStyle}
            >
                <div className="flex items-center gap-4" style={noDragStyle}>
                    <div className="flex items-center gap-2">
                        <img
                            src="@renderer/assets/logo.png"
                            alt={t('app.name')}
                            className="w-8 h-8 object-contain"
                        />
                        <span className="text-xs font-bold tracking-widest text-foreground/80 uppercase">
                            {t('app.name')}
                        </span>
                    </div>
                    {leftContent}
                </div>

                {/* Center Content (e.g. Token Counter) */}
                {children}

                <div className="flex items-center gap-2" style={noDragStyle}>
                    <div className="flex gap-2 titlebar-controls px-2">
                        <div
                            className="px-2 py-1 rounded-md border border-border/60 text-xxs text-muted-foreground flex items-center gap-1"
                            title={`Lazy services: ${lazyStatus.loaded}/${lazyStatus.registered} loaded`}
                        >
                            {lazyStatus.loading > 0 && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>{lazyStatus.loaded}/{lazyStatus.registered}</span>
                        </div>
                        <button
                            onClick={() => setIsChangelogOpen(true)}
                            className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-md transition-all duration-200 text-muted-foreground"
                            title={t('titleBar.changelog')}
                            aria-label={t('titleBar.changelog')}
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                        {onExtensionClick && (
                            <button
                                onClick={onExtensionClick}
                                className="p-1.5 hover:bg-info/10 hover:text-info rounded-md transition-all duration-200 text-muted-foreground"
                                title={t('titleBar.extension')}
                                aria-label={t('titleBar.extension')}
                            >
                                <Puzzle className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => window.electron.minimize()}
                            className="p-1.5 hover:bg-muted/50 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                            title={t('titleBar.minimize')}
                            aria-label={t('titleBar.minimize')}
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => window.electron.maximize()}
                            className="p-1.5 hover:bg-muted/50 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                            title={t('titleBar.maximize')}
                            aria-label={t('titleBar.maximize')}
                        >
                            <Square className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => window.electron.close()}
                            className="p-1.5 hover:bg-destructive hover:text-destructive-foreground rounded-md transition-all duration-200 text-muted-foreground"
                            title={t('titleBar.close')}
                            aria-label={t('titleBar.close')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            <Modal
                isOpen={isChangelogOpen}
                onClose={() => setIsChangelogOpen(false)}
                title={t('titleBar.changelogTitle')}
                size="4xl"
                height="auto"
            >
                {changelogGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('titleBar.changelogEmpty')}</p>
                ) : (
                    <div className="space-y-6">
                        <section className="rounded-xl border border-border/50 p-4 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <div className="flex-1 min-w-[240px] flex items-center gap-2 px-2 border border-border rounded-md bg-background">
                                    <Search className="w-4 h-4 text-muted-foreground" />
                                    <input
                                        value={searchQuery}
                                        onChange={event => setSearchQuery(event.target.value)}
                                        onBlur={() => commitSearch()}
                                        onKeyDown={event => {
                                            if (event.key === 'Enter') {
                                                commitSearch();
                                            }
                                        }}
                                        placeholder={t('common.search')}
                                        className="w-full bg-transparent text-xs py-2 outline-none"
                                        aria-label={t('common.search')}
                                    />
                                </div>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={event => setDateFrom(event.target.value)}
                                    className="text-xs px-2 py-2 rounded-md border border-border bg-background"
                                    aria-label={t('titleBar.changelogFromDate')}
                                />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={event => setDateTo(event.target.value)}
                                    className="text-xs px-2 py-2 rounded-md border border-border bg-background"
                                    aria-label={t('titleBar.changelogToDate')}
                                />
                                <select
                                    value={typeFilter}
                                    onChange={event => setTypeFilter(event.target.value)}
                                    className="text-xs px-2 py-2 rounded-md border border-border bg-background"
                                    aria-label={t('titleBar.changelogType')}
                                >
                                    {typeOptions.map(option => (
                                        <option key={option} value={option}>
                                            {option === 'all' ? t('common.all') : option}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={exportFilteredResults}
                                    className="px-2 py-2 rounded-md border border-border hover:bg-muted/40 text-xs flex items-center gap-1"
                                    title={t('titleBar.exportFilteredResults')}
                                    aria-label={t('titleBar.exportFilteredResults')}
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    {t('common.export')}
                                </button>
                            </div>
                            {suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {suggestions.map(suggestion => (
                                        <button
                                            key={suggestion}
                                            type="button"
                                        onClick={() => {
                                            setSearchQuery(suggestion);
                                            commitSearch(suggestion);
                                        }}
                                            className="px-2 py-1 text-xxs rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                        {filteredGroups.map((group) => (
                            <section key={group.date} className="rounded-xl border border-border/50 p-4">
                                <h4 className="text-sm font-bold tracking-wide text-primary mb-3">
                                    {group.date}
                                </h4>
                                <div className="space-y-4">
                                    {group.items.map((item, index) => (
                                        (() => {
                                            const content = getLocaleContent(item, language);
                                            return (
                                                <article key={`${group.date}-${item.id}-${index}`} className="space-y-2">
                                                    {content.summary && (
                                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                                            {content.summary}
                                                        </p>
                                                    )}
                                                    <h5 className="text-sm font-semibold text-foreground">
                                                        {content.title}
                                                    </h5>
                                                    <div className="space-y-1">
                                                        {content.items.map((line, lineIndex) => {
                                                            const normalized = normalizeLine(line);
                                                            if (normalized === null) {
                                                                return null;
                                                            }

                                                            if (normalized.type === 'subheading') {
                                                                return (
                                                                    <p
                                                                        key={`${line}-${lineIndex}`}
                                                                        className="text-xs font-semibold uppercase tracking-wide text-foreground/80 pt-2"
                                                                    >
                                                                        {normalized.text}
                                                                    </p>
                                                                );
                                                            }

                                                            if (normalized.type === 'bullet') {
                                                                return (
                                                                    <p
                                                                        key={`${line}-${lineIndex}`}
                                                                        className="text-xs text-muted-foreground leading-relaxed"
                                                                    >
                                                                        • {normalized.text}
                                                                    </p>
                                                                );
                                                            }

                                                            return (
                                                                <p
                                                                    key={`${line}-${lineIndex}`}
                                                                    className="text-xs text-muted-foreground leading-relaxed"
                                                                >
                                                                    {normalized.text}
                                                                </p>
                                                            );
                                                        })}
                                                    </div>
                                                </article>
                                            );
                                        })()
                                    ))}
                                </div>
                            </section>
                        ))}
                        {filteredGroups.length === 0 && (
                            <p className="text-sm text-muted-foreground">{t('titleBar.noFilterResults')}</p>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
}

interface ChangelogItem {
    date: string;
    id: string;
    type: string;
    status: string;
    components?: string[];
    contentByLocale: Record<string, ChangelogLocaleContent>;
}

type NormalizedLine = {
    type: 'text' | 'bullet' | 'subheading';
    text: string;
};

function normalizeLine(line: string): NormalizedLine | null {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed === '---') {
        return null;
    }

    if (trimmed.startsWith('### ')) {
        return {
            type: 'subheading',
            text: stripMarkdown(trimmed.replace(/^###\s+/, '')),
        };
    }

    if (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
        return {
            type: 'bullet',
            text: stripMarkdown(trimmed.replace(/^- \[[xX]\]\s+/, '')),
        };
    }

    if (trimmed.startsWith('- ')) {
        return {
            type: 'bullet',
            text: stripMarkdown(trimmed.replace(/^- /, '')),
        };
    }

    return {
        type: 'text',
        text: stripMarkdown(trimmed),
    };
}

function stripMarkdown(value: string): string {
    return value.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

interface ChangelogLocaleContent {
    title: string;
    summary?: string;
    items: string[];
}

type ChangelogIndexEntry = ChangelogItem;

function getLocaleContent(entry: ChangelogIndexEntry, language: string): ChangelogLocaleContent {
    const normalized = language.toLowerCase();
    const baseLanguage = normalized.split('-')[0];
    return entry.contentByLocale[normalized] ?? entry.contentByLocale[baseLanguage] ?? entry.contentByLocale.en;
}
