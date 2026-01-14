/**
 * Activity Bar Component
 * VSCode-like vertical activity bar with icon buttons for switching views.
 */

import React, { useState, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'
import {
    MessageSquare, FolderTree, Settings, Search, GitBranch,
    Puzzle,
    Bug, ChevronLeft, ChevronRight
} from 'lucide-react'

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

const ActivityBarContext = createContext<ActivityBarContextType | null>(null)

export const useActivityBar = () => {
    const context = useContext(ActivityBarContext)
    if (!context) throw new Error('useActivityBar must be used within ActivityBarProvider')
    return context
}

// Default activities
export const DEFAULT_ACTIVITIES: ActivityItem[] = [
    { id: 'chat', icon: <MessageSquare className="w-5 h-5" />, label: 'Chat' },
    { id: 'explorer', icon: <FolderTree className="w-5 h-5" />, label: 'Explorer' },
    { id: 'search', icon: <Search className="w-5 h-5" />, label: 'Search' },
    { id: 'git', icon: <GitBranch className="w-5 h-5" />, label: 'Source Control' },
    { id: 'debug', icon: <Bug className="w-5 h-5" />, label: 'Debug' },
    { id: 'extensions', icon: <Puzzle className="w-5 h-5" />, label: 'Extensions' }
]

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
        className={cn(
            "relative w-12 h-12 flex items-center justify-center transition-colors",
            isActive
                ? "text-foreground before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary"
                : "text-muted-foreground hover:text-foreground",
            item.disabled && "opacity-50 cursor-not-allowed"
        )}
    >
        {item.icon}
        {item.badge !== undefined && (
            <span className={cn(
                "absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full",
                typeof item.badge === 'number' && item.badge > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
            )}>
                {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
            </span>
        )}
    </button>
)

// Activity Bar Provider
export const ActivityBarProvider: React.FC<{
    children: React.ReactNode
    defaultActive?: string
}> = ({ children, defaultActive = 'chat' }) => {
    const [activeItem, setActiveItem] = useState(defaultActive)
    const [collapsed, setCollapsed] = useState(false)

    return (
        <ActivityBarContext.Provider value={{ activeItem, setActiveItem, collapsed, setCollapsed }}>
            {children}
        </ActivityBarContext.Provider>
    )
}

// Main Activity Bar Component
export const ActivityBar: React.FC<{
    items?: ActivityItem[]
    bottomItems?: ActivityItem[]
    className?: string
    onItemClick?: (id: string) => void
}> = ({
    items = DEFAULT_ACTIVITIES,
    bottomItems = [
        { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' }
    ],
    className,
    onItemClick
}) => {
        const { activeItem, setActiveItem } = useActivityBar()

        const handleClick = (id: string) => {
            setActiveItem(id)
            onItemClick?.(id)
        }

        return (
            <div className={cn(
                "w-12 h-full flex flex-col bg-card/50 border-r border-border/30",
                className
            )}>
                {/* Top items */}
                <div className="flex-1 flex flex-col">
                    {items.map(item => (
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
                    {bottomItems.map(item => (
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
        )
    }

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
        const { activeItem, collapsed, setCollapsed } = useActivityBar()
        const activeSidebar = sidebarContent[activeItem]

        return (
            <div className={cn("flex h-full w-full", className)}>
                {/* Activity Bar */}
                <ActivityBar
                    items={activityItems}
                    bottomItems={bottomActivityItems}
                />

                {/* Sidebar */}
                {activeSidebar && !collapsed && (
                    <div
                        className="h-full border-r border-border/30 bg-card/30 overflow-hidden flex flex-col"
                        style={{ width: sidebarWidth }}
                    >
                        {/* Sidebar header */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
                            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                {activityItems?.find(i => i.id === activeItem)?.label || activeItem}
                            </span>
                            <button
                                onClick={() => setCollapsed(true)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground"
                            >
                                <ChevronLeft className="w-4 h-4" />
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
                        className="w-6 h-full flex items-center justify-center hover:bg-muted/50 text-muted-foreground border-r border-border/30"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                )}

                {/* Main content */}
                <div className="flex-1 min-w-0 overflow-hidden">
                    {children}
                </div>
            </div>
        )
    }

export default ActivityBar
