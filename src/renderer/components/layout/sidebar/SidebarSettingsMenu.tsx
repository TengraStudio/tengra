/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { getSettingsNavigationItems } from '@/features/settings/settings-navigation';
import { SettingsCategory } from '@/features/settings/types';


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
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div className="absolute bottom-full left-0 z-50 mb-2 flex w-56 flex-col gap-0.5 rounded-lg border border-border/50 bg-popover/90 p-1 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
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
