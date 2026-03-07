import { SidebarMenuItem, SidebarSection } from '@renderer/components/layout/sidebar-components';
import { Book, Folder as FolderIcon, MessageSquare, Rocket } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { AppView } from '@/hooks/useAppState';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Workspace } from '@/types';

interface WorkspaceSectionProps {
    isCollapsed: boolean;
    currentView: AppView;
    onChangeView: (view: AppView) => void;
    chatsCount: number;
    workspacesCount: number;
    promptsCount?: number;
    selectedWorkspace: Workspace | null;
    language: string;
    setShowPrompts: (show: boolean) => void;
}

export const WorkspaceSectionComponent: React.FC<WorkspaceSectionProps> = props => {
    const { isCollapsed, language } = props;
    const { t } = useTranslation(language as Language);

    if (isCollapsed) {
        return <CollapsedWorkspace {...props} t={t} />;
    }

    return <ExpandedWorkspace {...props} t={t} />;
};

const CollapsedWorkspace: React.FC<WorkspaceSectionProps & { t: (key: string) => string }> = ({
    currentView,
    onChangeView,
    t,
}) => (
    <div className="space-y-1">
        <Button
            variant="ghost"
            onClick={() => onChangeView('chat')}
            className={cn('nav-item justify-center', currentView === 'chat' && 'nav-item-active')}
            title={t('sidebar.chats')}
        >
            <MessageSquare className="w-4 h-4 shrink-0" />
        </Button>
        <Button
            variant="ghost"
            onClick={() => onChangeView('workspace')}
            className={cn(
                'nav-item justify-center',
                currentView === 'workspace' && 'nav-item-active'
            )}
            title={t('sidebar.workspace')}
        >
            <Rocket className="w-4 h-4 shrink-0" />
        </Button>
    </div>
);

const ExpandedWorkspace: React.FC<WorkspaceSectionProps & { t: (key: string) => string }> = ({
    currentView,
    onChangeView,
    chatsCount,
    promptsCount,
    selectedWorkspace,
    setShowPrompts,
    t,
}) => (
    <SidebarSection
        id="workspace"
        title={t('sidebar.workspace')}
        icon={<FolderIcon className="w-3.5 h-3.5" />}
        defaultExpanded={true}
        badge={chatsCount + (selectedWorkspace ? 1 : 0)}
    >
        <SidebarMenuItem
            id="chats"
            icon={<MessageSquare className="w-4 h-4" />}
            label={t('sidebar.chats')}
            onClick={() => onChangeView('chat')}
            isActive={currentView === 'chat'}
            badge={chatsCount}
        />
        <SidebarMenuItem
            id="workspace"
            icon={<Rocket className="w-4 h-4" />}
            label={t('sidebar.workspace')}
            onClick={() => onChangeView('workspace')}
            isActive={currentView === 'workspace'}
            status={selectedWorkspace ? 'online' : undefined}
            statusLabel={selectedWorkspace ? t('sidebar.active') : undefined}
        />
        <SidebarMenuItem
            id="prompts"
            icon={<Book className="w-4 h-4" />}
            label={t('sidebar.prompts')}
            onClick={() => setShowPrompts(true)}
            badge={promptsCount}
        />
    </SidebarSection>
);

WorkspaceSectionComponent.displayName = 'WorkspaceSection';
