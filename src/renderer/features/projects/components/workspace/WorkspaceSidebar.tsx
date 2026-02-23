import React from 'react';

import { GroupedModels } from '@/features/models/utils/model-fetcher';
import { Language } from '@/i18n';
import { AppSettings, CodexUsage, Message, QuotaResponse } from '@/types';

import { AIAssistantSidebar } from './AIAssistantSidebar';

interface WorkspaceSidebarProps {
    projectId: string;
    showAgentPanel: boolean;
    agentPanelWidth: number;
    setAgentPanelWidth: (_w: number) => void;
    selectedProvider: string;
    selectedModel: string;
    onSelectModel: (provider: string, model: string) => void;
    settings: AppSettings | null;
    groupedModels: GroupedModels;
    quotas: { accounts: QuotaResponse[] } | null;
    codexUsage: { accounts: { usage: CodexUsage }[] } | null;
    agentChatMessage: string;
    setAgentChatMessage: (msg: string) => void;
    onSendMessage?: (content?: string) => void;
    t: (key: string) => string;
    messages?: Message[];
    isLoading?: boolean;
    language: Language;
    onSourceClick: (path: string) => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
    projectId,
    showAgentPanel,
    agentPanelWidth: _agentPanelWidth,
    setAgentPanelWidth: _setAgentPanelWidth,
    selectedProvider,
    selectedModel,
    onSelectModel,
    settings,
    groupedModels,
    quotas,
    codexUsage,
    agentChatMessage,
    setAgentChatMessage,
    onSendMessage,
    t,
    messages,
    isLoading,
    language,
    onSourceClick,
}) => {
    return (
        <div
            className={`border-l border-white/5 bg-background/40 backdrop-blur-xl shrink-0 transition-all duration-300 relative ${
                showAgentPanel ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden'
            }`}
            style={{ width: showAgentPanel ? 350 : 0 }}
        >
            <div className="h-full flex flex-col">
                <AIAssistantSidebar
                    projectId={projectId}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    onSelectModel={onSelectModel}
                    settings={settings as AppSettings}
                    groupedModels={groupedModels}
                    quotas={quotas}
                    codexUsage={codexUsage}
                    agentChatMessage={agentChatMessage}
                    setAgentChatMessage={setAgentChatMessage}
                    onSendMessage={onSendMessage}
                    t={t}
                    messages={messages}
                    isLoading={isLoading}
                    language={language}
                    onSourceClick={onSourceClick}
                />
            </div>
        </div>
    );
};
