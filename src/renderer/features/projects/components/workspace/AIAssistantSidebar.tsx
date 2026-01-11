import React from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowLeft } from 'lucide-react';
import { MessageBubble } from '../../../chat/components/MessageBubble';
import { ModelSelector } from '../../../models/components/ModelSelector';
import { CouncilPanel } from './CouncilPanel';
import { CouncilAgent, ActivityEntry, Message, AppSettings, QuotaResponse, CodexUsage } from '@/types';
import { GroupedModels } from '../../../models/utils/model-fetcher';
import { Language } from '@/i18n';

interface AIAssistantSidebarProps {
    viewTab: 'editor' | 'council' | 'logs';
    selectedProvider: string;
    selectedModel: string;
    onSelectModel: (provider: string, model: string) => void;
    settings: AppSettings;
    groupedModels: GroupedModels;
    quotas: QuotaResponse | null;
    codexUsage: CodexUsage | null;
    agentChatMessage: string;
    setAgentChatMessage: (val: string) => void;
    // Council Props
    councilEnabled: boolean;
    toggleCouncil: () => void;
    agents: CouncilAgent[];
    toggleAgent: (id: string) => void;
    addAgent: () => void;
    runCouncil: () => void;
    activityLog: ActivityEntry[];
    clearLogs: () => void;
    t: (key: string) => string;
    messages?: Message[];
    isLoading?: boolean;
    language: string;
    onSourceClick?: (path: string) => void;
}

/**
 * AIAssistantSidebar Component
 * 
 * The right panel of the workspace, which can show:
 * - AI Chat interface
 * - Agent Council dashboard
 * - Integrated Model Selection
 */
export const AIAssistantSidebar: React.FC<AIAssistantSidebarProps> = ({
    viewTab,
    selectedProvider,
    selectedModel,
    onSelectModel,
    settings,
    groupedModels,
    quotas,
    codexUsage,
    agentChatMessage,
    setAgentChatMessage,
    councilEnabled,
    toggleCouncil,
    agents,
    toggleAgent,
    addAgent,
    runCouncil,
    activityLog,
    clearLogs,
    t,
    messages = [],
    isLoading,
    language,
    onSourceClick
}) => {
    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-white/5 bg-background/40 backdrop-blur-xl flex flex-col shrink-0 shadow-2xl overflow-visible h-full"
        >
            {/* Header with Model Selector */}
            <div className="h-12 border-b border-white/5 flex items-center px-4 bg-white/[0.02] shrink-0 overflow-visible relative z-50">
                <div className="flex items-center gap-2 shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI</span>
                </div>
                <div className="flex-1 flex justify-end">
                    <ModelSelector
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onSelect={onSelectModel}
                        settings={settings}
                        groupedModels={groupedModels}
                        quotas={quotas}
                        codexUsage={codexUsage}
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {viewTab === 'council' ? (
                    <CouncilPanel
                        councilEnabled={councilEnabled}
                        toggleCouncil={toggleCouncil}
                        agents={agents}
                        toggleAgent={toggleAgent}
                        addAgent={addAgent}
                        runCouncil={runCouncil}
                        activityLog={activityLog}
                        clearLogs={clearLogs}
                        t={t}
                        goal={agentChatMessage}
                        setGoal={setAgentChatMessage}
                    />
                ) : (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {messages.length === 0 ? (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                        <Users className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="bg-muted/30 rounded-2xl rounded-tl-none p-3 text-sm text-zinc-300">
                                        {t('agents.welcomeMessage')}
                                    </div>
                                </div>
                            ) : (
                                messages.map((m: Message, idx: number) => (
                                    <MessageBubble
                                        key={m.id || idx}
                                        message={m}
                                        isLast={idx === messages.length - 1}
                                        language={language as Language}
                                        isStreaming={isLoading && idx === messages.length - 1 && m.role === 'assistant'}
                                        onSourceClick={onSourceClick}
                                    />
                                ))
                            )}
                        </div>

                        {/* Chat Input Area */}
                        <div className="p-3 border-t border-white/5 bg-background/50 shrink-0">
                            <div className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    className="flex-1 bg-muted/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                                    placeholder={t('workspace.writeSomething')}
                                    value={agentChatMessage}
                                    onChange={(e) => setAgentChatMessage(e.target.value)}
                                />
                                <button
                                    onClick={runCouncil}
                                    className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
                                >
                                    <ArrowLeft className="w-4 h-4 rotate-180" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
