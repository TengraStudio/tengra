import { Plus } from 'lucide-react';
import React, { useMemo } from 'react';

import logoBlack from '@/assets/tengra_black.png';
import logoWhite from '@/assets/tengra_white.png';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';


interface SidebarHeaderProps {
    isCollapsed: boolean;
    newChatLabel: string;
    onClickNewChat: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
    isCollapsed,
    newChatLabel,
    onClickNewChat,
}) => {
    const { t } = useTranslation();
    const { isLight } = useTheme();

    const logo = useMemo(() => (isLight ? logoBlack : logoWhite), [isLight]);

    return (
        <div className="tengra-sidebar-header">
            {/* Tengra Branding */}
            <div
                className={cn(
                    'tengra-sidebar-header__brand',
                    isCollapsed ? 'tengra-sidebar-header__brand--collapsed' : 'tengra-sidebar-header__brand--expanded'
                )}
            >
                <img
                    src={logo}
                    className="tengra-sidebar-header__logo"
                    alt={t('app.name')}
                />
                {!isCollapsed && (
                    <span className="tengra-sidebar-header__title">
                        {t('app.name')}
                    </span>
                )}
            </div>

            <button
                data-testid="new-chat-button"
                onClick={onClickNewChat}
                className={cn(
                    'tengra-sidebar-header__new-chat',
                    isCollapsed && 'px-0'
                )}
            >
                <Plus className="w-4 h-4 stroke-2" />
                {!isCollapsed && (
                    <span className="text-xxs">{newChatLabel}</span>
                )}
            </button>
        </div>
    );
};

SidebarHeader.displayName = 'SidebarHeader';


