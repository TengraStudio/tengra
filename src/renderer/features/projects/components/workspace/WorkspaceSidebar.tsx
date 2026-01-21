import React from 'react'

import { GroupedModels } from '@/features/models/utils/model-fetcher'
import { Language } from '@/i18n'
import { ActivityEntry, AppSettings, CodexUsage, CouncilAgent, Message,QuotaResponse } from '@/types'

import { AIAssistantSidebar } from './AIAssistantSidebar'

interface WorkspaceSidebarProps {
    showAgentPanel: boolean
    agentPanelWidth: number
    setAgentPanelWidth: (w: number) => void
    viewTab: 'editor' | 'council' | 'logs'
    selectedProvider: string
    selectedModel: string
    onSelectModel: (provider: string, model: string) => void
    settings: AppSettings | null
    groupedModels: GroupedModels
    quotas: { accounts: QuotaResponse[] } | null
    codexUsage: { accounts: { usage: CodexUsage }[] } | null
    agentChatMessage: string
    setAgentChatMessage: (msg: string) => void
    councilEnabled: boolean
    toggleCouncil: () => void
    agents: CouncilAgent[]
    toggleAgent: (id: string) => void
    addAgent: () => void
    runCouncil: () => void | Promise<void>
    activityLog: ActivityEntry[]
    clearLogs: () => void
    t: (key: string) => string
    messages?: Message[]
    isLoading?: boolean
    language: Language
    onSourceClick: (path: string) => void
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
    showAgentPanel, agentPanelWidth, setAgentPanelWidth,
    viewTab, selectedProvider, selectedModel, onSelectModel,
    settings, groupedModels, quotas, codexUsage,
    agentChatMessage, setAgentChatMessage,
    councilEnabled, toggleCouncil, agents, toggleAgent, addAgent,
    runCouncil, activityLog, clearLogs, t, messages, isLoading,
    language, onSourceClick
}) => {
    return (
        <div
            className={`border-l border-white/5 bg-background/40 backdrop-blur-xl shrink-0 transition-all duration-300 relative ${showAgentPanel ? "opacity-100" : "w-0 opacity-0 overflow-hidden"
                }`}
            style={{ width: showAgentPanel ? agentPanelWidth : 0 }}
        >
            {/* Resizer */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-50"
                onMouseDown={(e) => {
                    const startX = e.clientX
                    const startWidth = agentPanelWidth
                    const doDrag = (dragEvent: MouseEvent) => {
                        setAgentPanelWidth(Math.max(300, Math.min(800, startWidth - (dragEvent.clientX - startX))))
                    }
                    const stopDrag = () => {
                        window.removeEventListener('mousemove', doDrag)
                        window.removeEventListener('mouseup', stopDrag)
                    }
                    window.addEventListener('mousemove', doDrag)
                    window.addEventListener('mouseup', stopDrag)
                }}
            />
            <div className="h-full flex flex-col">
                <AIAssistantSidebar
                    viewTab={viewTab}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    onSelectModel={onSelectModel}
                    settings={settings as AppSettings}
                    groupedModels={groupedModels}
                    quotas={quotas}
                    codexUsage={codexUsage}
                    agentChatMessage={agentChatMessage}
                    setAgentChatMessage={setAgentChatMessage}
                    councilEnabled={councilEnabled}
                    toggleCouncil={toggleCouncil}
                    agents={agents}
                    toggleAgent={toggleAgent}
                    addAgent={addAgent}
                    runCouncil={() => { void runCouncil() }}
                    activityLog={activityLog}
                    clearLogs={clearLogs}
                    t={t}
                    messages={messages}
                    isLoading={isLoading}
                    language={language}
                    onSourceClick={onSourceClick}
                />
            </div>
        </div>
    )
}
