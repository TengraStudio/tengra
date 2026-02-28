import { Download, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';

interface ChangelogItem {
    date: string;
    id: string;
    type: string;
    status: string;
    components?: string[];
    contentByLocale: Record<string, ChangelogLocaleContent>;
}

interface ChangelogLocaleContent {
    title: string;
    summary?: string;
    items: string[];
}

type ChangelogIndexEntry = ChangelogItem;

interface SearchAnalytics {
    lastQuery: string;
    totalSearches: number;
    lastSearchedAt: number;
}

const SEARCH_HISTORY_STORAGE_KEY = 'changelog.search.history';
const SEARCH_ANALYTICS_STORAGE_KEY = 'changelog.search.analytics';
const SEARCH_STORAGE_WRITE_DELAY_MS = 250;

function getLocaleContent(entry: ChangelogIndexEntry, language: string): ChangelogLocaleContent {
    const normalized = language.toLowerCase();
    const baseLanguage = normalized.split('-')[0];
    return entry.contentByLocale[normalized] ?? entry.contentByLocale[baseLanguage] ?? entry.contentByLocale.en;
}

function stripMarkdown(value: string): string {
    return value.replace(/\*\*/g, '').replace(/`/g, '').trim();
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

/** Full changelog modal content with search, filters, and export (used by TitleBar). */
export function ChangelogSearchContent() {
    const translation = useTranslation();
    const t = translation.t;
    const language: string =
        'language' in translation && typeof translation.language === 'string'
            ? translation.language
            : 'en';

    const [changelogEntries, setChangelogEntries] = useState<ChangelogIndexEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
            return raw ? JSON.parse(raw) as string[] : [];
        } catch {
            return [];
        }
    });

    const searchStorageWriteTimerRef = useRef<number | null>(null);
    const pendingSearchStorageRef = useRef<{
        history: string[] | null;
        analytics: SearchAnalytics | null;
    }>({
        history: null,
        analytics: null,
    });

    const flushPendingSearchStorage = useCallback(() => {
        const pending = pendingSearchStorageRef.current;
        if (pending.history) {
            localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(pending.history));
            pending.history = null;
        }
        if (pending.analytics) {
            localStorage.setItem(SEARCH_ANALYTICS_STORAGE_KEY, JSON.stringify(pending.analytics));
            pending.analytics = null;
        }
    }, []);

    const scheduleSearchStorageWrite = useCallback(
        (updates: { history?: string[]; analytics?: SearchAnalytics }) => {
            const pending = pendingSearchStorageRef.current;
            if (updates.history) {
                pending.history = updates.history;
            }
            if (updates.analytics) {
                pending.analytics = updates.analytics;
            }

            if (searchStorageWriteTimerRef.current !== null) {
                window.clearTimeout(searchStorageWriteTimerRef.current);
            }
            searchStorageWriteTimerRef.current = window.setTimeout(() => {
                flushPendingSearchStorage();
                searchStorageWriteTimerRef.current = null;
            }, SEARCH_STORAGE_WRITE_DELAY_MS);
        },
        [flushPendingSearchStorage]
    );

    useEffect(() => {
        return () => {
            if (searchStorageWriteTimerRef.current !== null) {
                window.clearTimeout(searchStorageWriteTimerRef.current);
                searchStorageWriteTimerRef.current = null;
            }
            flushPendingSearchStorage();
        };
    }, [flushPendingSearchStorage]);

    const changelogGroups = useMemo(() => {
        const grouped = new Map<string, ChangelogIndexEntry[]>();

        for (const entry of changelogEntries) {
            const bucket = grouped.get(entry.date) ?? [];
            bucket.push(entry);
            grouped.set(entry.date, bucket);
        }

        return Array.from(grouped.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, items]) => ({ date, items }));
    }, [changelogEntries]);

    useEffect(() => {
        if (changelogEntries.length > 0) {
            return;
        }
        let mounted = true;
        void import('@/data/changelog.index.json').then((mod) => {
            if (mounted) {
                setChangelogEntries(mod.default.entries as ChangelogIndexEntry[]);
            }
        });
        return () => { mounted = false; };
    }, [changelogEntries.length]);

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
        const q = (forcedQuery ?? searchQuery).trim();
        if (!q) {
            return;
        }
        const next = [q, ...searchHistory.filter(h => h !== q)].slice(0, 20);
        setSearchHistory(next);
        scheduleSearchStorageWrite({
            history: next,
            analytics: {
                lastQuery: q,
                totalSearches: (searchHistory.length ?? 0) + 1,
                lastSearchedAt: Date.now(),
            },
        });
    };

    const exportFilteredResults = () => {
        const payload = filteredGroups.map(group => ({
            date: group.date,
            items: group.items.map(item => {
                const content = getLocaleContent(item, language);
                return {
                    id: item.id,
                    type: item.type,
                    status: item.status,
                    title: content.title,
                    summary: content.summary ?? null,
                    items: content.items,
                };
            }),
        }));

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `changelog-search-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    if (changelogGroups.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('titleBar.changelogEmpty')}</p>;
    }

    return (
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
                        {group.items.map((item, index) => {
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
                        })}
                    </div>
                </section>
            ))}
            {filteredGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('titleBar.noFilterResults')}</p>
            )}
        </div>
    );
}

/** Simple changelog modal content without search (used by AppHeader). */
export function ChangelogSimpleContent() {
    const translation = useTranslation();
    const t = translation.t;
    const language: string =
        'language' in translation && typeof translation.language === 'string'
            ? translation.language
            : 'en';

    const [changelogEntries, setChangelogEntries] = useState<ChangelogIndexEntry[]>([]);

    useEffect(() => {
        if (changelogEntries.length > 0) {
            return;
        }
        let mounted = true;
        void import('@/data/changelog.index.json').then((mod) => {
            if (mounted) {
                setChangelogEntries(mod.default.entries as ChangelogIndexEntry[]);
            }
        });
        return () => { mounted = false; };
    }, [changelogEntries.length]);

    const changelogGroups = useMemo(() => {
        const grouped = new Map<string, ChangelogIndexEntry[]>();
        for (const entry of changelogEntries) {
            const bucket = grouped.get(entry.date) ?? [];
            bucket.push(entry);
            grouped.set(entry.date, bucket);
        }

        return Array.from(grouped.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 20)
            .map(([date, items]) => ({ date, items }));
    }, [changelogEntries]);

    if (changelogGroups.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('titleBar.changelogEmpty')}</p>;
    }

    return (
        <div className="space-y-4">
            {changelogGroups.map(group => (
                <section key={group.date} className="rounded-xl border border-border/50 p-4">
                    <h4 className="text-sm font-bold tracking-wide text-primary mb-3">
                        {group.date}
                    </h4>
                    <div className="space-y-4">
                        {group.items.map((item, index) => {
                            const content = getLocaleContent(item, language);
                            return (
                                <article key={`${group.date}-${item.id}-${index}`} className="space-y-1">
                                    <h5 className="text-sm font-semibold text-foreground">
                                        {content.title}
                                    </h5>
                                    {content.summary && (
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {content.summary}
                                        </p>
                                    )}
                                    <div className="space-y-1">
                                        {content.items.slice(0, 5).map((line, lineIndex) => (
                                            <p
                                                key={`${item.id}-${lineIndex}`}
                                                className="text-xs text-muted-foreground leading-relaxed"
                                            >
                                                • {stripMarkdown(line)}
                                            </p>
                                        ))}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
