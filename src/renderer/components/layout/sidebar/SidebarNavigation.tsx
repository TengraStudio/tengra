import { Brain, Lightbulb, MessageSquare, Rocket, Users } from 'lucide-react'
import React from 'react'

import { SidebarItem } from './SidebarItem'

interface SidebarNavigationProps {
    currentView: 'chat' | 'projects' | 'settings' | 'mcp' | 'council' | 'memory' | 'ideas'
    onChangeView: (view: 'chat' | 'projects' | 'settings' | 'mcp' | 'council' | 'memory' | 'ideas') => void
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
    return (
        <div className="px-3 space-y-1">
            <SidebarItem
                icon={MessageSquare}
                label={t('sidebar.chats')}
                active={currentView === 'chat'}
                onClick={() => onChangeView('chat')}
                badge={chatsCount > 0 ? chatsCount : undefined}
                isCollapsed={isCollapsed}
            />
            <SidebarItem
                icon={Rocket}
                label={t('sidebar.projects')}
                active={currentView === 'projects'}
                onClick={() => onChangeView('projects')}
                isCollapsed={isCollapsed}
            />
            <SidebarItem
                icon={Users}
                label={t('sidebar.council')}
                active={currentView === 'council'}
                onClick={() => onChangeView('council')}
                isCollapsed={isCollapsed}
            />
            <SidebarItem
                icon={Brain}
                label="Memory"
                active={currentView === 'memory'}
                onClick={() => onChangeView('memory')}
                isCollapsed={isCollapsed}
            />
            <SidebarItem
                icon={Lightbulb}
                label={t('sidebar.ideas')}
                active={currentView === 'ideas'}
                onClick={() => onChangeView('ideas')}
                isCollapsed={isCollapsed}
            />
        </div>
    )
}

SidebarNavigation.displayName = 'SidebarNavigation'
