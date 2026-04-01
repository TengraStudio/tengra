import React from 'react';

import { getSettingsNavigationItems } from '@/features/settings/settings-navigation';
import { SettingsCategory } from '@/features/settings/types';
import { cn } from '@/lib/utils';

interface SidebarSettingsMenuProps {
    onOpenSettings: (category?: SettingsCategory) => void
    onClose: () => void
    t: (key: string) => string
}

interface MenuItemButtonProps {
    item: ReturnType<typeof getSettingsNavigationItems>[number]
    onClick: () => void
}

const MenuItemButton: React.FC<MenuItemButtonProps> = ({ item, onClick }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors text-left"
    >
        <item.icon className="w-3.5 h-3.5" />
        <span>{item.label}</span>
    </button>
);

export const SidebarSettingsMenu: React.FC<SidebarSettingsMenuProps> = ({
    onOpenSettings,
    onClose,
    t
}) => {
    const settingsItems = getSettingsNavigationItems(t);

    return (
        <>
            <div className="fixed inset-0 z-50" onClick={onClose} />
            <div className={cn(
                "absolute bottom-full left-0 z-50 mb-2 flex max-h-96 w-56 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border/50 bg-popover/80 p-1 shadow-xl backdrop-blur-xl",
                "animate-in fade-in zoom-in-95 duration-200"
            )}>
                {settingsItems.map((item) => (
                    <MenuItemButton
                        key={item.id}
                        item={item}
                        onClick={() => { onOpenSettings(item.id); onClose(); }}
                    />
                ))}
            </div>
        </>
    );
};

SidebarSettingsMenu.displayName = 'SidebarSettingsMenu';
