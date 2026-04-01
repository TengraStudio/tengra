import {
    Container,
    Eraser,
    LayoutGrid,
    MessageSquare,
    Minus,
    Settings as SettingsIcon,
    ShoppingBag,
    Square,
    X,
} from 'lucide-react';
import React from 'react';

import { useAuthLanguage } from '@/context/AuthContext';
import { useChatHeader } from '@/context/ChatContext';
import { AppView } from '@/hooks/useAppState';
import { useTranslation } from '@/i18n';

interface AppHeaderProps {
    currentView: AppView;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    currentView,
}) => {
    const { currentChatId, currentChatTitle, clearMessages } = useChatHeader();
    const { language } = useAuthLanguage();
    const { t } = useTranslation(language);

    const viewIcons: Record<AppView, React.ElementType> = {
        chat: MessageSquare,
        workspace: LayoutGrid,
        settings: SettingsIcon,
        mcp: Container,
        memory: MessageSquare,
        docker: Container,
        terminal: MessageSquare,
        models: MessageSquare,
        marketplace: ShoppingBag,
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
            <header className="h-14 flex items-center justify-between px-6 bg-background/95 z-20 app-drag-region">
                <div className="flex items-center gap-4 no-drag">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-widest text-foreground/90 flex items-center gap-2">
                            {currentView === 'chat' && currentChatTitle
                                ? currentChatTitle
                                : t(`nav.${currentView}`)}
                        </h1>
                    </div>
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

                    <div className="h-4 w-px bg-border/50 mx-2" />

                    <div className="flex items-center gap-1">
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
