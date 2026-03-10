import { Bot, Brain, Lightbulb, MessageSquare, Rocket } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { AppView } from '@/hooks/useAppState';

import { SidebarItem } from './SidebarItem';

interface SidebarNavigationProps {
    currentView: AppView
    onChangeView: (view: AppView) => void
    isCollapsed: boolean
    chatsCount: number
    t: (key: string) => string
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
    currentView,
    onChangeView,
    isCollapsed,
    chatsCount,
    t
}) => {
    const navItems = useMemo(() => ([
        { view: 'chat' as const, icon: MessageSquare, label: t('sidebar.chats'), badge: chatsCount > 0 ? chatsCount : undefined },
        { view: 'workspace' as const, icon: Rocket, label: t('sidebar.workspaces') },
        { view: 'memory' as const, icon: Brain, label: t('sidebar.memory') },
        { view: 'ideas' as const, icon: Lightbulb, label: t('sidebar.ideas') },
        { view: 'automation-workflow' as const, icon: Bot, label: t('sidebar.automationWorkflow') }
    ]), [chatsCount, t]);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const handleRovingNav = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setFocusedIndex((index + 1) % navItems.length);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setFocusedIndex((index - 1 + navItems.length) % navItems.length);
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            setFocusedIndex(0);
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            setFocusedIndex(navItems.length - 1);
        }
    };

    return (
        <nav className="px-3 space-y-1" aria-label={t('aria.sidebarNavigation')}>
            {navItems.map((item, index) => (
                <SidebarItem
                    key={item.view}
                    icon={item.icon}
                    label={item.label}
                    active={currentView === item.view}
                    onClick={() => onChangeView(item.view)}
                    badge={item.badge}
                    isCollapsed={isCollapsed}
                    tabIndex={focusedIndex === index ? 0 : -1}
                    onFocus={() => setFocusedIndex(index)}
                    onKeyDown={(event) => handleRovingNav(event, index)}
                />
            ))}
        </nav>
    );
};

SidebarNavigation.displayName = 'SidebarNavigation';
