import { Brain, MessageSquare, Rocket, ShoppingBag } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import { AppView } from '@/hooks/useAppState';
import { preloadViewResources } from '@/views/view-manager/view-loaders';

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
        { view: 'marketplace' as const, icon: ShoppingBag, label: t('sidebar.marketplace') }
    ]), [chatsCount, t]);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const preloadedViewsRef = useRef<Set<AppView>>(new Set());

    const preloadView = (view: AppView) => {
        if (preloadedViewsRef.current.has(view)) {
            return;
        }
        preloadedViewsRef.current.add(view);
        void preloadViewResources(view);
    };

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
                    onMouseEnter={() => preloadView(item.view)}
                    badge={item.badge}
                    isCollapsed={isCollapsed}
                    tabIndex={focusedIndex === index ? 0 : -1}
                    onFocus={() => {
                        setFocusedIndex(index);
                        preloadView(item.view);
                    }}
                    onKeyDown={(event) => handleRovingNav(event, index)}
                />
            ))}
        </nav>
    );
};

SidebarNavigation.displayName = 'SidebarNavigation';
