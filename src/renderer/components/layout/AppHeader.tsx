import {
    Container,
    Eraser,
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
import React from 'react';


import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
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


        </>
    );
};



export const MemoizedAppHeader = React.memo(AppHeader);
