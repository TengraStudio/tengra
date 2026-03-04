import { ProjectAgentTab } from '@renderer/features/workspace/components/ProjectAgentTab';
import React from 'react';

import { Language } from '@/i18n';
import type { GroupedModels } from '@/types';
import { AgentDefinition, AppSettings, CodexUsage, Project, QuotaResponse } from '@/types';

interface AgentTabProps {
    project: Project;
    availableAgents: AgentDefinition[];
    groupedModels?: GroupedModels;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    settings?: AppSettings | null;
    selectedProvider?: string;
    selectedModel?: string;
    onSelectModel?: (provider: string, model: string) => void;
    t: (key: string) => string;
    language: Language;
}

export const AgentTab: React.FC<AgentTabProps> = ({
    project,
    groupedModels,
    quotas,
    codexUsage,
    settings,
    selectedProvider,
    selectedModel,
    onSelectModel,
    t,
    language
}) => {
    return (
        <div className="h-full overflow-hidden animate-in fade-in duration-500">
            <ProjectAgentTab
                project={project}
                t={t}
                language={language}
                activeTab="agent"
                groupedModels={groupedModels}
                quotas={quotas}
                codexUsage={codexUsage}
                settings={settings}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
            />
        </div>
    );
};
