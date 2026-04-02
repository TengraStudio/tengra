import { PanelLeft, PanelLeftClose, Plus, Search } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { AppView } from '@/hooks/useAppState';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
    isCollapsed: boolean;
    toggleSidebar: () => void;
    onChangeView: (view: AppView) => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
    isCollapsed,
    toggleSidebar,
    onChangeView,
}) => (
    <div
        className={cn(
            'p-4 flex items-center justify-between',
            isCollapsed && 'flex-col gap-4 px-2'
        )}
    >
        {!isCollapsed && (
            <div
                className="flex items-center gap-2 group cursor-pointer"
                onClick={() => onChangeView('chat')}
            >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                    <span className="text-foreground font-bold text-xs">O</span>
                </div>
                <SidebarAppName />
            </div>
        )}
        <SidebarToggleButton isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
    </div>
);

interface SidebarNewChatButtonProps {
    isCollapsed: boolean;
    handleNewChat: () => void;
    t: (key: string) => string;
}

export const SidebarNewChatButton: React.FC<SidebarNewChatButtonProps> = ({
    isCollapsed,
    handleNewChat,
    t,
}) => (
    <div className={cn('px-4 mb-4', isCollapsed && 'px-2')}>
        <Button
            onClick={handleNewChat}
            className={cn(
                'w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 font-bold   h-10 group overflow-hidden relative',
                isCollapsed ? 'p-0 rounded-xl' : 'rounded-xl px-4'
            )}
            title={t('sidebar.newChat')}
            aria-label={t('sidebar.newChat')}
        >
            <Plus
                className={cn(
                    'w-4 h-4 transition-transform group-hover:rotate-90',
                    !isCollapsed && 'mr-2'
                )}
            />
            {!isCollapsed && (
                <span className="animate-in fade-in slide-in-from-left-2">
                    {t('sidebar.newChat')}
                </span>
            )}
            {!isCollapsed && (
                <div className="absolute inset-0 bg-primary-foreground/10 -translate-x-full group-hover:translate-x-full transition-transform duration-700 skewed-highlight" />
            )}
        </Button>
    </div>
);

interface SidebarFooterProps {
    isCollapsed: boolean;
    onSearch?: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({ isCollapsed, onSearch }) => {
    const { t } = useTranslation();
    if (isCollapsed) {
        return null;
    }
    return (
        <div className="p-4 border-t border-border/20 bg-muted/5">
            <div className="flex items-center justify-between text-xxs text-muted-foreground/40 font-bold px-1">
                <span>{t('app.versionShort', { version: '1.2.0' })}</span>
                <div className="flex items-center gap-2">
                    <Search
                        className="w-3 h-3 hover:text-primary cursor-pointer transition-colors"
                        onClick={onSearch}
                    />
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse glow-success" />
                </div>
            </div>
        </div>
    );
};

const SidebarAppName = () => {
    const { t } = useTranslation();
    return (
        <span className="text-sm font-bold text-foreground animate-in fade-in slide-in-from-left-2">
            {t('app.name')}
        </span>
    );
};

const SidebarToggleButton = ({
    isCollapsed,
    toggleSidebar,
}: {
    isCollapsed: boolean;
    toggleSidebar: () => void;
}) => {
    const { t } = useTranslation();
    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
            {isCollapsed ? (
                <PanelLeft className="w-4 h-4" />
            ) : (
                <PanelLeftClose className="w-4 h-4" />
            )}
        </Button>
    );
};
