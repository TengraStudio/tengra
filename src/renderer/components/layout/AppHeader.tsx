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
import { cn } from '@/lib/utils';

import './app-header.css';

interface AppHeaderProps {
    currentView: AppView
    onOpenSettings: () => void
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    currentView,
    onOpenSettings,
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
            <header className="tengra-app-header app-drag-region">
                <div className="tengra-app-header__left no-drag">
                    <div className="tengra-app-header__icon-container">
                        <Icon className="tengra-app-header__icon" />
                    </div>
                    <div>
                        <h1 className="tengra-app-header__title">
                            {currentView === 'chat' && currentChatTitle
                                ? currentChatTitle
                                : t(`nav.${currentView}`)}
                        </h1>
                    </div>
                </div>

                <div className="tengra-app-header__right no-drag">
                    {currentView === 'chat' && currentChatId && (
                        <button
                            onClick={() => void clearMessages()}
                            className="tengra-app-header__action group"
                            title={t('chat.clear')}
                        >
                            <Eraser className="tengra-app-header__action-icon tengra-app-header__action-icon--rotate" />
                        </button>
                    )}

                    <button
                        onClick={onOpenSettings}
                        className={cn(
                            "tengra-app-header__settings",
                            currentView === 'settings'
                                ? "tengra-app-header__settings--active"
                                : "tengra-app-header__settings--inactive"
                        )}
                        title={t('nav.settings')}
                        aria-label={t('nav.settings')}
                    >
                        <SettingsIcon className="tengra-app-header__settings-icon" />
                    </button>

                    <div className="tengra-app-header__divider" />

                    <div className="tengra-app-header__window-controls">
                        <button
                            data-testid="window-minimize"
                            onClick={handleMinimize}
                            className="tengra-app-header__window-control"
                        >
                            <Minus className="tengra-app-header__window-control-icon" />
                        </button>
                        <button
                            data-testid="window-maximize"
                            onClick={handleMaximize}
                            className="tengra-app-header__window-control"
                        >
                            <Square className="tengra-app-header__window-control-icon tengra-app-header__window-control-icon--maximize" />
                        </button>
                        <button
                            data-testid="window-close"
                            onClick={handleClose}
                            className="tengra-app-header__window-control tengra-app-header__window-control--close"
                        >
                            <X className="tengra-app-header__window-control-icon" />
                        </button>
                    </div>
                </div>
            </header >
        </>
    );
};

export const MemoizedAppHeader = React.memo(AppHeader);
