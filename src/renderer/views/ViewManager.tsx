import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatView } from '@/features/chat/components/ChatView'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { AgentDashboard } from '@/features/agent/AgentDashboard'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { DockerDashboard } from '@/features/mcp/DockerDashboard'
import { useAuth } from '@/context/AuthContext'
import { useModel } from '@/context/ModelContext'
import { useChat } from '@/context/ChatContext'
import { useProject } from '@/context/ProjectContext'

interface ViewManagerProps {
    currentView: 'chat' | 'projects' | 'council' | 'settings' | 'mcp'
    messagesEndRef: React.RefObject<HTMLDivElement>
    fileInputRef: React.RefObject<HTMLInputElement>
    textareaRef: React.RefObject<HTMLTextAreaElement>
    onScrollToBottom: () => void
    showScrollButton: boolean
    setShowScrollButton: (show: boolean) => void
    showFileMenu: boolean
    setShowFileMenu: (show: boolean) => void
    // Templates might be static or context, but for now passing them or defining them inside
    templates: any[]
}

export const ViewManager: React.FC<ViewManagerProps> = ({
    currentView,
    messagesEndRef,
    fileInputRef,
    textareaRef,
    onScrollToBottom,
    showScrollButton,
    setShowScrollButton,
    showFileMenu,
    setShowFileMenu,
    templates
}) => {
    // Context Consumption
    const { language, settingsCategory, setSettingsCategory, appSettings, quotas, codexUsage } = useAuth()
    const {
        models, proxyModels, loadModels,
        selectedProvider, selectedModel, setSelectedModel, setSelectedProvider,
        groupedModels, persistLastSelection, setIsModelMenuOpen
    } = useModel()
    const {
        projects, selectedProject, setSelectedProject, loadProjects,
        terminalTabs, activeTerminalId, setTerminalTabs, setActiveTerminalId,
        handleOpenTerminal
    } = useProject()

    // ChatContext is consumed inside ChatView, but ProjectsPage also needs some chat props
    const {
        isLoading, handleSend: sendMessage, setInput,
        isListening, stopListening, displayMessages
    } = useChat()

    // Global Shortcut for Model Menu
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'm') {
                setIsModelMenuOpen(prev => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [setIsModelMenuOpen])

    return (
        <AnimatePresence mode="wait">
            {currentView === 'chat' && (
                <ChatView
                    templates={templates}
                    messagesEndRef={messagesEndRef}
                    fileInputRef={fileInputRef}
                    textareaRef={textareaRef}
                    onScrollToBottom={onScrollToBottom}
                    showScrollButton={showScrollButton}
                    setShowScrollButton={setShowScrollButton}
                    showFileMenu={showFileMenu}
                    setShowFileMenu={setShowFileMenu}
                />
            )}
            {currentView === 'projects' && (
                <motion.div key="projects" className="h-full overflow-hidden">
                    <ProjectsPage
                        projects={projects}
                        onRefresh={loadProjects}
                        selectedProject={selectedProject}
                        onSelectProject={setSelectedProject}
                        language={language || 'en'}
                        tabs={terminalTabs}
                        activeTabId={activeTerminalId}
                        setTabs={setTerminalTabs}
                        setActiveTabId={setActiveTerminalId}
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onSelectModel={(p, m) => {
                            setSelectedProvider(p as any)
                            setSelectedModel(m)
                            persistLastSelection(p as any, m)
                        }}
                        groupedModels={groupedModels}
                        quotas={quotas}
                        codexUsage={codexUsage}
                        settings={appSettings}
                        sendMessage={(text) => {
                            setInput(text || '')
                            sendMessage()
                        }}
                        messages={displayMessages}
                        isLoading={isLoading}
                    />
                </motion.div>
            )}
            {currentView === 'council' && (
                <motion.div key="council" className="h-full overflow-hidden">
                    <AgentDashboard
                        groupedModels={groupedModels}
                        models={models}
                    />
                </motion.div>
            )}
            {currentView === 'settings' && (
                <motion.div key="settings" className="h-full overflow-hidden">
                    <SettingsPage
                        installedModels={models}
                        proxyModels={proxyModels}
                        onRefreshModels={loadModels}
                        activeTab={settingsCategory as any}
                        onTabChange={setSettingsCategory as any}
                    />
                </motion.div>
            )}
            {currentView === 'mcp' && (
                <motion.div key="mcp" className="h-full overflow-hidden">
                    <div className="flex-1 p-6 overflow-y-auto">
                        <DockerDashboard onOpenTerminal={handleOpenTerminal} language={language || 'en'} />
                    </div>
                </motion.div>
            )}

            {/* Global Mic Indicator */}
            {isListening && (
                <div onClick={() => stopListening()} className="absolute top-4 right-4 z-[9999] cursor-pointer hover:bg-red-600 transition-colors flex items-center gap-2 bg-red-500/80 text-white px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider">Listening</span>
                </div>
            )}
        </AnimatePresence>
    )
}
