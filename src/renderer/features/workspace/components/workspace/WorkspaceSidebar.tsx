import React from 'react';

import { Language } from '@/i18n';
import type { GroupedModels } from '@/types';
import { AppSettings, ChatError, CodexUsage, Message, QuotaResponse } from '@/types';

import { AIAssistantSidebar } from './AIAssistantSidebar';

interface WorkspaceSidebarProps {
    workspaceId: string;
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
    chatError?: ChatError | null;
    language: Language;
    onSourceClick: (path: string) => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
    workspaceId,
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
    chatError,
    language,
    onSourceClick,
}) => {
    return (
        <div
            className={`border-l border-white/5 bg-background/40 backdrop-blur-xl shrink-0 transition-all duration-300 relative ${showAgentPanel ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden'
                }`}
            style={{ width: showAgentPanel ? 350 : 0 }}
        >
            <div className="h-full flex flex-col">
                <AIAssistantSidebar
                    workspaceId={workspaceId}
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
                    chatError={chatError}
                    language={language}
                    onSourceClick={onSourceClick}
                />
            </div>
        </div>
    );
};
