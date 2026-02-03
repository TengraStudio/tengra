import { Bot, Brain, Lightbulb, MessageSquare, Rocket } from 'lucide-react';
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
            <SidebarItem
                icon={Bot}
                label="Agent"
                active={currentView === 'project-agent'}
                onClick={() => onChangeView('project-agent')}
                isCollapsed={isCollapsed}
            />
        </div>
    );
};

SidebarNavigation.displayName = 'SidebarNavigation';
