import React, { Suspense, lazy } from 'react'
import { motion, AnimatePresence } from '@/lib/framer-motion-compat'
import { useAuth } from '@/context/AuthContext'
import { useModel } from '@/context/ModelContext'
import { useChat } from '@/context/ChatContext'
import { useProject } from '@/context/ProjectContext'
import { ChatTemplate } from '../features/chat/types'
import { LoadingState } from '@/components/ui/LoadingState'

// Lazy load feature modules for better performance
const ChatView = lazy(() => import('@/features/chat/components/ChatView').then(m => ({ default: m.ChatView })))
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const AgentDashboard = lazy(() => import('@/features/agent/AgentDashboard').then(m => ({ default: m.AgentDashboard })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const DockerDashboard = lazy(() => import('@/features/mcp/DockerDashboard').then(m => ({ default: m.DockerDashboard })))

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
    templates: ChatTemplate[]
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
    const { language, settingsCategory, appSettings, quotas, codexUsage } = useAuth()
    const {
        models, proxyModels, loadModels,
        selectedProvider, selectedModel, setSelectedModel, setSelectedProvider,
        groupedModels, persistLastSelection, setIsModelMenuOpen
    } = useModel()

    // Fix: extract models array from grouped result if it exists (using .models), otherwise filter models array
    const installedModels = groupedModels?.ollama?.models || models.filter(m => m.provider === 'ollama')

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
                <Suspense fallback={<LoadingState size="md" />}>
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
                </Suspense>
            )}
            {currentView === 'projects' && (
                <motion.div key="projects" className="h-full overflow-hidden">
                    <Suspense fallback={<LoadingState size="md" />}>
                        <ProjectsPage
                            projects={projects || []}
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
                                setSelectedProvider(p)
                                setSelectedModel(m)
                                persistLastSelection(p, m)
                            }}
                            groupedModels={groupedModels || undefined}
                            quotas={quotas}
                            codexUsage={codexUsage}
                            settings={appSettings || undefined}
                            sendMessage={(text) => {
                                setInput(text || '')
                                sendMessage()
                            }}
                            messages={displayMessages}
                            isLoading={isLoading}
                        />
                    </Suspense>
                </motion.div>
            )}
            {currentView === 'council' && (
                <motion.div key="council" className="h-full overflow-hidden">
                    <Suspense fallback={<LoadingState size="md" />}>
                        <AgentDashboard />
                    </Suspense>
                </motion.div>
            )}
            {currentView === 'settings' && (
                <motion.div key="settings" className="h-full overflow-hidden">
                    <Suspense fallback={<LoadingState size="md" />}>
                        <SettingsPage
                            installedModels={installedModels}
                            proxyModels={proxyModels}
                            onRefreshModels={loadModels}
                            activeTab={settingsCategory}
                            groupedModels={groupedModels}
                        />
                    </Suspense>
                </motion.div>
            )}
            {currentView === 'mcp' && (
                <motion.div key="mcp" className="h-full overflow-hidden">
                    <div className="flex-1 p-6 overflow-y-auto">
                        <Suspense fallback={<LoadingState size="md" />}>
                            <DockerDashboard onOpenTerminal={handleOpenTerminal} language={language || 'en'} />
                        </Suspense>
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
