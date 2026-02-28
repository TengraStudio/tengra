import { AppSettings, CodexUsage, QuotaResponse } from '@shared/types';
import React, { lazy, Suspense } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';
import { Language } from '@/i18n';
import type { GroupedModels } from '@/types';
import { Message, Project, TerminalTab } from '@/types';

const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage').then(m => ({ default: m.ProjectsPage })));

interface ProjectsViewProps {
    projects: Project[]
    selectedProject: Project | null
    setSelectedProject: (p: Project | null) => void
    language: Language
    terminalTabs: TerminalTab[]
    activeTerminalId: string | null
    setTerminalTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabId: (id: string | null) => void
    selectedProvider: string
    selectedModel: string
    onSelectModel: (p: string, m: string) => void
    groupedModels?: GroupedModels | null
    quotas: { accounts: QuotaResponse[] } | null
    codexUsage: { accounts: { usage: CodexUsage }[] } | null
    appSettings: AppSettings | null
    onSendMessage: (text?: string) => void
    displayMessages: Message[]
    isLoading: boolean
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
    projects,
    selectedProject,
    setSelectedProject,
    language,
    terminalTabs,
    activeTerminalId,
    setTerminalTabs,
    setActiveTabId,
    selectedProvider,
    selectedModel,
    onSelectModel,
    groupedModels,
    quotas,
    codexUsage,
    appSettings,
    onSendMessage,
    displayMessages,
    isLoading
}) => {
    return (
        <Suspense fallback={<LoadingState size="md" />}>
            <ProjectsPage
                projects={projects}
                selectedProject={selectedProject}
                onSelectProject={setSelectedProject}
                language={language}
                tabs={terminalTabs}
                activeTabId={activeTerminalId}
                setTabs={setTerminalTabs}
                setActiveTabId={setActiveTabId}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
                groupedModels={groupedModels ?? undefined}
                quotas={quotas}
                codexUsage={codexUsage}
                settings={appSettings}
                sendMessage={onSendMessage}
                messages={displayMessages}
                isLoading={isLoading}
            />
        </Suspense>
    );
};

ProjectsView.displayName = 'ProjectsView';
