import { BarChart, Code, Image, LucideIcon, Mic, Palette, Rocket,Server, Settings, Shield, Sparkles, User, Users } from 'lucide-react';
import React from 'react';

import { SettingsCategory } from '@/features/settings/types';
import { cn } from '@/lib/utils';

interface SettingsMenuItem {
    id: SettingsCategory
    labelKey: string
    fallback: string
    icon: LucideIcon
}

const SETTINGS_ITEMS: SettingsMenuItem[] = [
    { id: 'general', labelKey: 'settings.general', fallback: 'General', icon: Settings },
    { id: 'accounts', labelKey: 'settings.accounts', fallback: 'Accounts', icon: User },
    { id: 'appearance', labelKey: 'settings.appearance', fallback: 'Appearance', icon: Palette },
    { id: 'models', labelKey: 'settings.models', fallback: 'Models', icon: Sparkles },
    { id: 'personas', labelKey: 'settings.personas', fallback: 'Personas', icon: Users },
    { id: 'speech', labelKey: 'settings.speech', fallback: 'Speech', icon: Mic },
    { id: 'statistics', labelKey: 'settings.statistics', fallback: 'Statistics', icon: BarChart },
    { id: 'gallery', labelKey: 'settings.gallery', fallback: 'Gallery', icon: Image },
    { id: 'mcp-servers', labelKey: 'settings.mcpServers', fallback: 'MCP', icon: Server },
    { id: 'developer', labelKey: 'settings.developer', fallback: 'Developer', icon: Code },
    { id: 'advanced', labelKey: 'settings.advanced', fallback: 'Advanced', icon: Shield },
    { id: 'about', labelKey: 'settings.about', fallback: 'About', icon: Rocket }
];

interface SidebarSettingsMenuProps {
    onOpenSettings: (category?: SettingsCategory) => void
    onClose: () => void
    t: (key: string) => string
}

interface MenuItemButtonProps {
    item: SettingsMenuItem
    onClick: () => void
    t: (key: string) => string
}

const MenuItemButton: React.FC<MenuItemButtonProps> = ({ item, onClick, t }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors text-left"
    >
        <item.icon className="w-3.5 h-3.5" />
        <span>{t(item.labelKey) || item.fallback}</span>
    </button>
);

export const SidebarSettingsMenu: React.FC<SidebarSettingsMenuProps> = ({
    onOpenSettings,
    onClose,
    t
}) => (
    <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div className={cn(
            "absolute bottom-full left-0 w-48 mb-2 p-1",
            "bg-popover/80 backdrop-blur-xl border border-border/50",
            "rounded-lg shadow-xl z-50 overflow-hidden",
            "flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-200"
        )}>
            {SETTINGS_ITEMS.map((item) => (
                <MenuItemButton
                    key={item.id}
                    item={item}
                    onClick={() => { onOpenSettings(item.id); onClose(); }}
                    t={t}
                />
            ))}
        </div>
    </>
);

SidebarSettingsMenu.displayName = 'SidebarSettingsMenu';
