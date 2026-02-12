import { Bot, Boxes, Brain, Lightbulb, MessageSquare, Rocket } from 'lucide-react';
import React from 'react';

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
    return (
        <nav className="px-3 space-y-1" aria-label="Sidebar navigation">
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
                icon={Boxes}
                label={t('sidebar.models')}
                active={currentView === 'models'}
                onClick={() => onChangeView('models')}
                isCollapsed={isCollapsed}
            />
            <SidebarItem
                icon={Brain}
                label={t('sidebar.memory')}
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
            <SidebarItem
                icon={Bot}
                label={t('sidebar.agent')}
                active={currentView === 'project-agent'}
                onClick={() => onChangeView('project-agent')}
                isCollapsed={isCollapsed}
            />
        </nav>
    );
};

SidebarNavigation.displayName = 'SidebarNavigation';
