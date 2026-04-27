/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Activity Bar Component
 * VSCode-like vertical activity bar with icon buttons for switching views.
 */

import { IconBug, IconChevronLeft, IconChevronRight, IconFolderOpen, IconGitBranch, IconMessage, IconPuzzle, IconSearch, IconSettings } from '@tabler/icons-react';
import React, { createContext, useContext, useMemo } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { setActivityBarState, useUiLayoutStore } from '@/store/ui-layout.store';


export interface ActivityItem {
    id: string
    icon: React.ReactNode
    label: string
    badge?: number | string
    disabled?: boolean
}

interface ActivityBarContextType {
    activeItem: string
    setActiveItem: (id: string) => void
    collapsed: boolean
    setCollapsed: (collapsed: boolean) => void
}

const ActivityBarContext = createContext<ActivityBarContextType | null>(null);

export const useActivityBar = () => {
    const { t } = useTranslation();
    const context = useContext(ActivityBarContext);
    if (!context) { throw new Error(t('errors.context.useActivityBarProvider')); }
    return context;
};

const getDefaultActivities = (t: (key: string) => string): ActivityItem[] => [
    { id: 'chat', icon: <IconMessage className="w-5 h-5" />, label: t('activityBar.chat') },
    { id: 'explorer', icon: <IconFolderOpen className="w-5 h-5" />, label: t('activityBar.explorer') },
    { id: 'search', icon: <IconSearch className="w-5 h-5" />, label: t('activityBar.search') },
    { id: 'git', icon: <IconGitBranch className="w-5 h-5" />, label: t('activityBar.sourceControl') },
    { id: 'debug', icon: <IconBug className="w-5 h-5" />, label: t('activityBar.debug') },
    { id: 'extensions', icon: <IconPuzzle className="w-5 h-5" />, label: t('activityBar.extensions') }
];

// Activity Button Component
const ActivityButton: React.FC<{
    item: ActivityItem
    isActive: boolean
    onClick: () => void
    position?: 'top' | 'bottom'
}> = ({ item, isActive, onClick }) => (
    <button
        onClick={onClick}
        disabled={item.disabled}
        title={item.label}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        aria-pressed={isActive}
        className={cn(
            'relative flex h-12 w-12 items-center justify-center bg-transparent text-muted-foreground transition-colors hover:text-foreground',
            isActive && 'text-foreground',
            item.disabled && 'cursor-not-allowed opacity-50'
        )}
    >
        {isActive && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true" />}
        {item.icon}
        {item.badge !== undefined && (
            <span className={cn(
                'absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 typo-overline font-bold bg-primary text-primary-foreground',
                !(typeof item.badge === 'number' && item.badge > 0) && 'bg-muted text-muted-foreground'
            )}>
                {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
            </span>
        )}
    </button>
);

// Activity Bar Provider
export const ActivityBarProvider: React.FC<{
    children: React.ReactNode
    defaultActive?: string
}> = ({ children, defaultActive = 'chat' }) => {
    const activeItem = useUiLayoutStore(snapshot => snapshot.activityBar.activeItem || defaultActive);
    const collapsed = useUiLayoutStore(snapshot => snapshot.activityBar.collapsed);

    const setActiveItem = (id: string) => {
        setActivityBarState({ activeItem: id });
    };

    const setCollapsed = (next: boolean) => {
        setActivityBarState({ collapsed: next });
    };

    return (
        <ActivityBarContext.Provider value={{ activeItem, setActiveItem, collapsed, setCollapsed }}>
            {children}
        </ActivityBarContext.Provider>
    );
};

// Main Activity Bar Component
export const ActivityBar: React.FC<{
    items?: ActivityItem[]
    bottomItems?: ActivityItem[]
    className?: string
    onItemClick?: (id: string) => void
}> = ({
    items,
    bottomItems,
    className,
    onItemClick
}) => {
        const { t } = useTranslation();
        const { activeItem, setActiveItem } = useActivityBar();
        const resolvedItems = useMemo(
            () => (items && items.length > 0 ? items : getDefaultActivities(t)),
            [items, t]
        );
        const resolvedBottomItems = useMemo(
            () => (
                bottomItems && bottomItems.length > 0
                    ? bottomItems
                    : [{ id: 'settings', icon: <IconSettings className="w-5 h-5" />, label: t('activityBar.settings') }]
            ),
            [bottomItems, t]
        );

        const handleClick = (id: string) => {
            setActiveItem(id);
            onItemClick?.(id);
        };

        return (
            <div className={cn('flex h-full w-12 flex-col border-r border-border/30 bg-card/50', className)}>
                {/* Top items */}
                <div className="flex flex-1 flex-col">
                    {resolvedItems.map(item => (
                        <ActivityButton
                            key={item.id}
                            item={item}
                            isActive={activeItem === item.id}
                            onClick={() => handleClick(item.id)}
                        />
                    ))}
                </div>

                {/* Bottom items */}
                <div className="flex flex-col border-t border-border/20">
                    {resolvedBottomItems.map(item => (
                        <ActivityButton
                            key={item.id}
                            item={item}
                            isActive={activeItem === item.id}
                            onClick={() => handleClick(item.id)}
                            position="bottom"
                        />
                    ))}
                </div>
            </div>
        );
    };

// Composite Layout with Activity Bar + Sidebar
export const ActivityBarLayout: React.FC<{
    activityItems?: ActivityItem[]
    bottomActivityItems?: ActivityItem[]
    sidebarContent?: Record<string, React.ReactNode>
    sidebarWidth?: number
    children: React.ReactNode
    className?: string
}> = ({
    activityItems,
    bottomActivityItems,
    sidebarContent = {},
    sidebarWidth = 260,
    children,
    className
}) => {
        const { activeItem, collapsed, setCollapsed } = useActivityBar();
        const activeSidebar = sidebarContent[activeItem];
        const { t } = useTranslation();

        return (
            <div className={cn('flex h-full w-full', className)}>
                {/* Activity Bar */}
                <ActivityBar
                    items={activityItems}
                    bottomItems={bottomActivityItems}
                />

                {/* Sidebar */}
                {activeSidebar && !collapsed && (
                    <div
                        className="flex h-full flex-col overflow-hidden border-r border-border/30 bg-card/30"
                        style={{ width: sidebarWidth }}
                    >
                        {/* Sidebar header */}
                        <div className="flex items-center justify-between border-b border-border/20 px-4 py-2">
                            <span className="text-sm font-semibold text-muted-foreground">
                                {activityItems?.find(i => i.id === activeItem)?.label ?? t('common.unknown')}
                            </span>
                            <button
                                onClick={() => setCollapsed(true)}
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
                                aria-label={t('aria.collapseSidebar')}
                            >
                                <IconChevronLeft className="h-4 w-4" />
                            </button>
                        </div>
                        {/* Sidebar content */}
                        <div className="flex-1 overflow-auto">
                            {activeSidebar}
                        </div>
                    </div>
                )}

                {/* Collapsed sidebar toggle */}
                {collapsed && activeSidebar && (
                    <button
                        onClick={() => setCollapsed(false)}
                        className="flex h-full w-6 items-center justify-center border-r border-border/30 bg-transparent text-muted-foreground transition-colors hover:bg-muted/50"
                        aria-label={t('aria.expandSidebar')}
                    >
                        <IconChevronRight className="h-4 w-4" />
                    </button>
                )}

                {/* Main content */}
                <div className="min-w-0 flex-1 overflow-hidden">
                    {children}
                </div>
            </div>
        );
    };

export default ActivityBar;
