import React from 'react';

import { getSettingsNavigationItems } from '@/features/settings/settings-navigation';
import { SettingsCategory } from '@/features/settings/types';

import './sidebar-settings-menu.css';

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
        className="tengra-sidebar-settings-menu__item"
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
            <div className="tengra-sidebar-settings-menu__backdrop" onClick={onClose} />
            <div className="tengra-sidebar-settings-menu animate-in fade-in zoom-in-95 duration-200">
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
