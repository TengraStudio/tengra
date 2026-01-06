import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatView } from '@/features/chat/components/ChatView'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { CouncilView } from '@/features/chat/components/CouncilView'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { DockerDashboard } from '@/features/mcp/DockerDashboard'
import { Language } from '@/i18n'
import { TerminalTab, Message } from '@/types'

interface ViewManagerProps {
    currentView: 'chat' | 'projects' | 'council' | 'settings' | 'mcp'
    messages: Message[]
    displayMessages: Message[]
    searchTerm: string
    setSearchTerm: (v: string) => void
    t: any
    templates: any[]
    setInput: (v: string) => void
    isLoading: boolean
    streamingContent: string
    streamingReasoning?: string
    streamingSpeed: number | null
    language: Language
    selectedProvider: string
    selectedModel: string
    onSpeak: (text: string, id: string) => void
    onStopSpeak: () => void
    speakingMessageId: string | null
    messagesEndRef: React.RefObject<HTMLDivElement>
    showScrollButton: boolean
    setShowScrollButton: (show: boolean) => void
    onScrollToBottom: () => void
    input: string
    attachments: any[]
    removeAttachment: (i: number) => void
    sendMessage: (content?: string) => void
    stopGeneration: () => void
    fileInputRef: React.RefObject<HTMLInputElement>
    textareaRef: React.RefObject<HTMLTextAreaElement>
    processFile: (file: File) => void
    showFileMenu: boolean
    setShowFileMenu: (show: boolean) => void
    onSelectModel: (p: string, m: string) => void
    appSettings: any
    groupedModels: any
    quotas: any
    codexUsage: any
    setIsModelMenuOpen: (open: boolean) => void
    contextTokens: number
    isListening: boolean
    startListening: () => void
    stopListening: () => void
    autoReadEnabled: boolean
    setAutoReadEnabled: (enabled: boolean) => void
    handleKeyDown: (e: React.KeyboardEvent) => void
    handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void

    // Project Props
    projects: any[]
    loadProjects: () => void
    selectedProject: any
    setSelectedProject: (p: any) => void
    terminalTabs: TerminalTab[]
    activeTerminalId: string | null
    setTerminalTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTerminalId: (id: string | null) => void

    // Settings Props
    models: any[]
    proxyModels: any[]
    loadModels: () => void
    settingsCategory: string
    setSettingsCategory: (c: string) => void

    // MCP Props
    handleOpenTerminal: (name: string, cmd: string) => void
}

export const ViewManager: React.FC<ViewManagerProps> = ({
    currentView,
    messages,
    displayMessages,
    searchTerm,
    setSearchTerm,
    t,
    templates,
    setInput,
    isLoading,
    streamingContent,
    streamingReasoning,
    streamingSpeed,
    language,
    selectedProvider,
    selectedModel,
    onSpeak,
    onStopSpeak,
    speakingMessageId,
    messagesEndRef,
    showScrollButton,
    setShowScrollButton,
    onScrollToBottom,
    input,
    attachments,
    removeAttachment,
    sendMessage,
    stopGeneration,
    fileInputRef,
    textareaRef,
    processFile,
    showFileMenu,
    setShowFileMenu,
    onSelectModel,
    appSettings,
    groupedModels,
    quotas,
    codexUsage,
    setIsModelMenuOpen,
    contextTokens,
    isListening,
    startListening,
    stopListening,
    autoReadEnabled,
    setAutoReadEnabled,
    handleKeyDown,
    handlePaste,
    projects,
    loadProjects,
    selectedProject,
    setSelectedProject,
    terminalTabs,
    activeTerminalId,
    setTerminalTabs,
    setActiveTerminalId,
    models,
    proxyModels,
    loadModels,
    settingsCategory,
    setSettingsCategory,
    handleOpenTerminal
}) => {
    return (
        <AnimatePresence mode="wait">
            {currentView === 'chat' && (
                <ChatView
                    messages={messages}
                    displayMessages={displayMessages}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    t={t}
                    templates={templates}
                    setInput={setInput}
                    isLoading={isLoading}
                    streamingContent={streamingContent}
                    streamingReasoning={streamingReasoning}
                    streamingSpeed={streamingSpeed}
                    language={language}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    onSpeak={onSpeak}
                    onStopSpeak={onStopSpeak}
                    speakingMessageId={speakingMessageId}
                    messagesEndRef={messagesEndRef}
                    showScrollButton={showScrollButton}
                    setShowScrollButton={setShowScrollButton}
                    onScrollToBottom={onScrollToBottom}
                    input={input}
                    attachments={attachments}
                    removeAttachment={removeAttachment}
                    sendMessage={sendMessage}
                    stopGeneration={stopGeneration}
                    fileInputRef={fileInputRef}
                    textareaRef={textareaRef}
                    processFile={processFile}
                    showFileMenu={showFileMenu}
                    setShowFileMenu={setShowFileMenu}
                    onSelectModel={onSelectModel}
                    appSettings={appSettings}
                    groupedModels={groupedModels}
                    quotas={quotas}
                    codexUsage={codexUsage}
                    setIsModelMenuOpen={setIsModelMenuOpen}
                    contextTokens={contextTokens}
                    isListening={isListening}
                    startListening={startListening}
                    stopListening={stopListening}
                    autoReadEnabled={autoReadEnabled}
                    setAutoReadEnabled={setAutoReadEnabled}
                    handleKeyDown={handleKeyDown}
                    handlePaste={handlePaste}
                />
            )}
            {currentView === 'projects' && (
                <motion.div key="projects" className="h-full overflow-hidden">
                    <ProjectsPage
                        projects={projects}
                        onRefresh={loadProjects}
                        selectedProject={selectedProject}
                        onSelectProject={setSelectedProject}
                        language={language}
                        tabs={terminalTabs}
                        activeTabId={activeTerminalId}
                        setTabs={setTerminalTabs}
                        setActiveTabId={setActiveTerminalId}
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onSelectModel={onSelectModel}
                        groupedModels={groupedModels}
                        quotas={quotas}
                        codexUsage={codexUsage}
                        settings={appSettings}
                    />
                </motion.div>
            )}
            {currentView === 'council' && (
                <motion.div key="council" className="h-full overflow-hidden">
                    <CouncilView />
                </motion.div>
            )}
            {currentView === 'settings' && (
                <motion.div key="settings" className="h-full overflow-hidden">
                    <SettingsPage
                        installedModels={models}
                        proxyModels={proxyModels}
                        onRefreshModels={loadModels}
                        activeTab={settingsCategory as any}
                        onTabChange={setSettingsCategory}
                    />
                </motion.div>
            )}
            {currentView === 'mcp' && (
                <motion.div key="mcp" className="h-full overflow-hidden">
                    <div className="flex-1 p-6 overflow-y-auto">
                        <DockerDashboard onOpenTerminal={handleOpenTerminal} />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
