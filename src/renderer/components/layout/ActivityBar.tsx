/**
 * Activity Bar Component
 * VSCode-like vertical activity bar with icon buttons for switching views.
 */

import {
    Bug,
    ChevronLeft,
    ChevronRight,
    FolderTree,
    GitBranch,
    MessageSquare,
    Puzzle,
    Search,
    Settings
} from 'lucide-react';
import React, { createContext, useContext, useMemo } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { setActivityBarState, useUiLayoutStore } from '@/store/ui-layout.store';

import './activity-bar.css';

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
    const context = useContext(ActivityBarContext);
    if (!context) { throw new Error('useActivityBar must be used within ActivityBarProvider'); }
    return context;
};

const getDefaultActivities = (t: (key: string) => string): ActivityItem[] => [
    { id: 'chat', icon: <MessageSquare className="w-5 h-5" />, label: t('activityBar.chat') },
    { id: 'explorer', icon: <FolderTree className="w-5 h-5" />, label: t('activityBar.explorer') },
    { id: 'search', icon: <Search className="w-5 h-5" />, label: t('activityBar.search') },
    { id: 'git', icon: <GitBranch className="w-5 h-5" />, label: t('activityBar.sourceControl') },
    { id: 'debug', icon: <Bug className="w-5 h-5" />, label: t('activityBar.debug') },
    { id: 'extensions', icon: <Puzzle className="w-5 h-5" />, label: t('activityBar.extensions') }
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
            "tengra-activity-bar__button",
            isActive && "tengra-activity-bar__button--active",
            item.disabled && "tengra-activity-bar__button--disabled"
        )}
    >
        {item.icon}
        {item.badge !== undefined && (
            <span className={cn(
                "tengra-activity-bar__badge",
                !(typeof item.badge === 'number' && item.badge > 0) && "tengra-activity-bar__badge--empty"
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
                : [{ id: 'settings', icon: <Settings className="w-5 h-5" />, label: t('activityBar.settings') }]
        ),
        [bottomItems, t]
    );

    const handleClick = (id: string) => {
        setActiveItem(id);
        onItemClick?.(id);
    };

    return (
        <div className={cn("tengra-activity-bar", className)}>
            {/* Top items */}
            <div className="tengra-activity-bar__top-section">
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
            <div className="tengra-activity-bar__bottom-section">
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
        <div className={cn("tengra-activity-layout", className)}>
            {/* Activity Bar */}
            <ActivityBar
                items={activityItems}
                bottomItems={bottomActivityItems}
            />

            {/* Sidebar */}
            {activeSidebar && !collapsed && (
                <div
                    className="tengra-activity-sidebar"
                    style={{ width: sidebarWidth }}
                >
                    {/* Sidebar header */}
                    <div className="tengra-activity-sidebar__header">
                        <span className="tengra-activity-sidebar__title">
                            {activityItems?.find(i => i.id === activeItem)?.label ?? activeItem}
                        </span>
                        <button
                            onClick={() => setCollapsed(true)}
                            className="tengra-activity-collapse-toggle"
                            aria-label={t('aria.collapseSidebar')}
                        >
                            <ChevronLeft className="tengra-activity-collapse-toggle__icon" />
                        </button>
                    </div>
                    {/* Sidebar content */}
                    <div className="tengra-activity-sidebar__content">
                        {activeSidebar}
                    </div>
                </div>
            )}

            {/* Collapsed sidebar toggle */}
            {collapsed && activeSidebar && (
                <button
                    onClick={() => setCollapsed(false)}
                    className="tengra-activity-collapsed-toggle"
                    aria-label={t('aria.expandSidebar')}
                >
                    <ChevronRight className="tengra-activity-collapse-toggle__icon" />
                </button>
            )}

            {/* Main content */}
            <div className="tengra-activity-layout__main">
                {children}
            </div>
        </div>
    );
};

export default ActivityBar;
