import {
    Container,
    Eraser,
    FileText,
    LayoutGrid,
    MessageSquare,
    Minus,
    Puzzle,
    Search,
    Settings as SettingsIcon,
    Square,
    Terminal as TerminalIcon,
    X as ClearIcon,
    X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import changelogIndex from '@/data/changelog.index.json';
import { useTranslation } from '@/i18n';

interface AppHeaderProps {
    currentView: string;
    settingsSearchQuery?: string;
    setSettingsSearchQuery?: (query: string) => void;
    onExtensionClick?: () => void;
    onExtensionDevToolsClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    currentView,
    settingsSearchQuery,
    setSettingsSearchQuery,
    onExtensionClick,
    onExtensionDevToolsClick,
}) => {
    const { chats, currentChatId, clearMessages } = useChat();
    const { language } = useAuth();
    const { t } = useTranslation(language);

    const currentChat = chats.find(c => c.id === currentChatId);

    const viewIcons: Record<string, React.ElementType> = {
        chat: MessageSquare,
        projects: LayoutGrid,
        settings: SettingsIcon,

        mcp: Container,
    };

    const Icon = viewIcons[currentView] ?? MessageSquare;
    const [isChangelogOpen, setIsChangelogOpen] = useState(false);

    const changelogGroups = useMemo(() => {
        const grouped = new Map<string, ChangelogIndexEntry[]>();
        for (const entry of changelogIndex.entries as ChangelogIndexEntry[]) {
            const bucket = grouped.get(entry.date) ?? [];
            bucket.push(entry);
            grouped.set(entry.date, bucket);
        }

        return Array.from(grouped.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 20)
            .map(([date, items]) => ({ date, items }));
    }, []);

    const handleMinimize = () => {
        void window.electron.minimize();
    };
    const handleMaximize = () => {
        void window.electron.maximize();
    };
    const handleClose = () => {
        void window.electron.close();
    };

    return (
        <>
            <header className="h-14 flex items-center justify-between px-6 bg-background/95 z-50 app-drag-region">
                <div className="flex items-center gap-4 no-drag">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-foreground/90 flex items-center gap-2">
                            {currentView === 'chat' && currentChat
                                ? currentChat.title
                                : t(`nav.${currentView}`)}
                        </h1>
                    </div>
                    {currentView === 'settings' && setSettingsSearchQuery && (
                        <div className="relative w-[320px] max-w-[42vw]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder={t('settings.searchPlaceholder')}
                                value={settingsSearchQuery ?? ''}
                                onChange={e => setSettingsSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-9 py-2 bg-muted/20 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                                aria-label={t('settings.searchPlaceholder')}
                            />
                            {settingsSearchQuery && (
                                <button
                                    onClick={() => setSettingsSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted/30 rounded-md transition-colors"
                                    aria-label={t('common.clear')}
                                >
                                    <ClearIcon className="w-4 h-4 text-muted-foreground" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 no-drag">
                    {currentView === 'chat' && currentChatId && (
                        <button
                            onClick={() => void clearMessages()}
                            className="p-2 hover:bg-accent/50 rounded-xl transition-all text-muted-foreground hover:text-foreground group"
                            title={t('chat.clear')}
                        >
                            <Eraser className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        </button>
                    )}

                    <div className="h-4 w-[1px] bg-border/50 mx-2" />

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsChangelogOpen(true)}
                            className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg text-muted-foreground transition-colors"
                            title={t('titleBar.changelog')}
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                        {onExtensionClick && (
                            <>
                                <button
                                    onClick={onExtensionClick}
                                    className="p-2 hover:bg-info/10 hover:text-info rounded-lg text-muted-foreground transition-colors group"
                                    title={t('extensionPrompt.buttonTitle')}
                                >
                                    <Puzzle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                </button>
                                {onExtensionDevToolsClick && (
                                    <button
                                        onClick={onExtensionDevToolsClick}
                                        className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg text-muted-foreground transition-colors group"
                                        title="Extension Developer Tools"
                                    >
                                        <TerminalIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                    </button>
                                )}
                                <div className="h-4 w-[1px] bg-border/50 mx-1" />
                            </>
                        )}
                        <button
                            data-testid="window-minimize"
                            onClick={handleMinimize}
                            className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground transition-colors"
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <button
                            data-testid="window-maximize"
                            onClick={handleMaximize}
                            className="p-2 hover:bg-accent/50 rounded-lg text-muted-foreground transition-colors"
                        >
                            <Square className="w-3.5 h-3.5" />
                        </button>
                        <button
                            data-testid="window-close"
                            onClick={handleClose}
                            className="p-2 hover:bg-destructive/20 hover:text-destructive rounded-lg text-muted-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header >

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
                )}
            </Modal>
        </>
    );
};

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

function stripMarkdown(value: string): string {
    return value.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

function getLocaleContent(entry: ChangelogIndexEntry, language: string): ChangelogLocaleContent {
    const normalized = language.toLowerCase();
    const baseLanguage = normalized.split('-')[0];
    return entry.contentByLocale[normalized] ?? entry.contentByLocale[baseLanguage] ?? entry.contentByLocale.en;
}

export const MemoizedAppHeader = React.memo(AppHeader);
