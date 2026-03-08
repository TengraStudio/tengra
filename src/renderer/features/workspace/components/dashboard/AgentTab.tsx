import { WorkspaceAgentTab } from '@renderer/features/workspace/components/WorkspaceAgentTab';
import React from 'react';

import { Language } from '@/i18n';
import type { GroupedModels } from '@/types';
import { AgentDefinition, AppSettings, CodexUsage, QuotaResponse,Workspace } from '@/types';

interface AgentTabProps {
    workspace: Workspace;
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
    workspace,
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
            <WorkspaceAgentTab
                workspace={workspace}
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
