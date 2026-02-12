import { FileText, Minus, Puzzle, Square, X } from 'lucide-react';
import { type CSSProperties, ReactNode, useMemo, useState } from 'react';

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
                        <button
                            onClick={() => setIsChangelogOpen(true)}
                            className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-md transition-all duration-200 text-muted-foreground"
                            title={t('titleBar.changelog')}
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                        {onExtensionClick && (
                            <button
                                onClick={onExtensionClick}
                                className="p-1.5 hover:bg-info/10 hover:text-info rounded-md transition-all duration-200 text-muted-foreground"
                                title={t('titleBar.extension')}
                            >
                                <Puzzle className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => window.electron.minimize()}
                            className="p-1.5 hover:bg-muted/50 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                            title={t('titleBar.minimize')}
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => window.electron.maximize()}
                            className="p-1.5 hover:bg-muted/50 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                            title={t('titleBar.maximize')}
                        >
                            <Square className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => window.electron.close()}
                            className="p-1.5 hover:bg-destructive hover:text-destructive-foreground rounded-md transition-all duration-200 text-muted-foreground"
                            title={t('titleBar.close')}
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
                        {changelogGroups.map((group) => (
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
