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
        <div className="p-3 space-y-4">
            {/* Tengra Branding */}
            <div
                className={cn(
                    'flex items-center gap-3 px-2 py-1',
                    isCollapsed ? 'justify-center' : 'justify-start'
                )}
            >
                <img
                    src={logo}
                    className="w-8 h-8 min-w-8 object-contain"
                    alt={t('app.name')}
                />
                {!isCollapsed && (
                    <span className="font-black text-xl tracking-tighter text-primary uppercase">
                        {t('app.name')}
                    </span>
                )}
            </div>

            <button
                data-testid="new-chat-button"
                onClick={onClickNewChat}
                className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all',
                    isCollapsed && 'px-0'
                )}
            >
                <Plus className="w-4 h-4 stroke-2" />
                {!isCollapsed && (
                    <span className="uppercase tracking-widest text-xxs">{newChatLabel}</span>
                )}
            </button>
        </div>
    );
};

SidebarHeader.displayName = 'SidebarHeader';


