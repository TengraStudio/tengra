import { Plus } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
    isCollapsed: boolean
    newChatLabel: string
    onClickNewChat: () => void
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
    isCollapsed,
    newChatLabel,
    onClickNewChat
}) => {
    return (
        <div className="p-3 space-y-2">
            <button
                data-testid="new-chat-button"
                onClick={onClickNewChat}
                className={cn(
                    "w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors",
                    isCollapsed && "px-0"
                )}
            >
                <Plus className="w-4 h-4" />
                {!isCollapsed && <span>{newChatLabel}</span>}
            </button>
        </div>
    );
};

SidebarHeader.displayName = 'SidebarHeader';
