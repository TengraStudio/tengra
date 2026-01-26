import { BarChart, Code, Image, MessageSquare, Mic, Palette, Rocket,Server, Settings, Shield, Sparkles, User, Users } from 'lucide-react';
import React from 'react';

import { SettingsCategory } from '@/features/settings/types';
import { cn } from '@/lib/utils';

interface SidebarSettingsMenuProps {
    onOpenSettings: (category?: SettingsCategory) => void
    onClose: () => void
    t: (key: string) => string
}

export const SidebarSettingsMenu: React.FC<SidebarSettingsMenuProps> = ({
    onOpenSettings,
    onClose,
    t
}) => {
    const items = [
        { id: 'general', label: t('settings.general') || 'General', icon: Settings },
        { id: 'accounts', label: t('settings.accounts') || 'Accounts', icon: User },
        { id: 'appearance', label: t('settings.appearance') || 'Appearance', icon: Palette },
        { id: 'models', label: t('settings.models') || 'Models', icon: Sparkles },
        { id: 'prompts', label: t('settings.prompts') || 'Prompts', icon: MessageSquare },
        { id: 'personas', label: t('settings.personas') || 'Personas', icon: Users },
        { id: 'speech', label: t('settings.speech') || 'Speech', icon: Mic },
        { id: 'statistics', label: t('settings.statistics') || 'Statistics', icon: BarChart },
        { id: 'gallery', label: t('settings.gallery') || 'Gallery', icon: Image },
        { id: 'mcp-servers', label: 'MCP', icon: Server },
        { id: 'developer', label: t('settings.developer') || 'Developer', icon: Code },
        { id: 'advanced', label: t('settings.advanced') || 'Advanced', icon: Shield },
        { id: 'about', label: t('settings.about') || 'About', icon: Rocket }
    ];

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div className={cn(
                "absolute bottom-full left-0 w-48 mb-2 p-1",
                "bg-popover/80 backdrop-blur-xl border border-border/50",
                "rounded-lg shadow-xl z-50 overflow-hidden",
                "flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-200"
            )}>
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => {
                            onOpenSettings(item.id as SettingsCategory);
                            onClose();
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors text-left"
                    >
                        <item.icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>
        </>
    );
};

SidebarSettingsMenu.displayName = 'SidebarSettingsMenu';
