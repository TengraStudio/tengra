import { SidebarMenuItem,SidebarSection } from '@renderer/components/layout/sidebar-components'
import { Book, Folder as FolderIcon,MessageSquare, Rocket, Users } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'
import { AppView } from '@/hooks/useAppState'
import { Language,useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import { Project } from '@/types'

interface WorkspaceSectionProps {
    isCollapsed: boolean;
    currentView: AppView;
    onChangeView: (view: AppView) => void;
    chatsCount: number;
    projectsCount: number;
    promptsCount?: number;
    selectedProject: Project | null;
    language: string;
    setShowPrompts: (show: boolean) => void;
}

export const WorkspaceSectionComponent: React.FC<WorkspaceSectionProps> = (props) => {
    const { isCollapsed, language } = props
    const { t } = useTranslation(language as Language)

    if (isCollapsed) {
        return <CollapsedWorkspace {...props} t={t} />
    }

    return <ExpandedWorkspace {...props} t={t} />
}

const CollapsedWorkspace: React.FC<WorkspaceSectionProps & { t: (key: string) => string }> = ({
    currentView, onChangeView, t
}) => (
    <div className="space-y-1">
        <Button
            variant="ghost"
            onClick={() => onChangeView('chat')}
            className={cn("nav-item justify-center", currentView === 'chat' && "nav-item-active")}
            title={t('sidebar.chats')}
        >
            <MessageSquare className="w-4 h-4 shrink-0" />
        </Button>
        <Button
            variant="ghost"
            onClick={() => onChangeView('projects')}
            className={cn("nav-item justify-center", currentView === 'projects' && "nav-item-active")}
            title={t('sidebar.projects')}
        >
            <Rocket className="w-4 h-4 shrink-0" />
        </Button>
        <Button
            variant="ghost"
            onClick={() => onChangeView('council')}
            className={cn("nav-item justify-center", currentView === 'council' && "nav-item-active")}
            title={t('sidebar.council')}
        >
            <Users className="w-4 h-4 shrink-0" />
        </Button>
    </div>
)

const ExpandedWorkspace: React.FC<WorkspaceSectionProps & { t: (key: string) => string }> = ({
    currentView, onChangeView, chatsCount, promptsCount, selectedProject, setShowPrompts, t
}) => (
    <SidebarSection
        id="workspace"
        title={t('sidebar.workspace')}
        icon={<FolderIcon className="w-3.5 h-3.5" />}
        defaultExpanded={true}
        badge={chatsCount + (selectedProject ? 1 : 0)}
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
            id="projects"
            icon={<Rocket className="w-4 h-4" />}
            label={t('sidebar.projects')}
            onClick={() => onChangeView('projects')}
            isActive={currentView === 'projects'}
            status={selectedProject ? 'online' : undefined}
            statusLabel={selectedProject ? 'Active' : undefined}
        />
        <SidebarMenuItem
            id="council"
            icon={<Users className="w-4 h-4" />}
            label={t('sidebar.council')}
            onClick={() => onChangeView('council')}
            isActive={currentView === 'council'}
            status="online"
            statusLabel="Ready"
        />
        <SidebarMenuItem
            id="prompts"
            icon={<Book className="w-4 h-4" />}
            label={t('sidebar.prompts')}
            onClick={() => setShowPrompts(true)}
            badge={promptsCount}
        />
    </SidebarSection>
)
