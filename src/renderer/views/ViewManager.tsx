import { LoadingState } from '@/components/ui/LoadingState'
import { AnimatePresence, motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'
import { useAuth } from '@renderer/context/AuthContext'
import { useChat } from '@renderer/context/ChatContext'
import { useModel } from '@renderer/context/ModelContext'
import { useProject } from '@renderer/context/ProjectContext'
import { ChatTemplate } from '@renderer/features/chat/types'
import { GroupedModels } from '@renderer/features/models/utils/model-fetcher'
import React, { lazy, Suspense, useEffect } from 'react'

// Lazy load feature modules for better performance
// These are large components that shouldn't block the initial render
const AgentDashboard = lazy(() => import('@/features/agent/AgentDashboard').then(m => ({ default: m.AgentDashboard })))
const DockerDashboard = lazy(() => import('@/features/mcp/DockerDashboard').then(m => ({ default: m.DockerDashboard })))
const MemoryInspector = lazy(() => import('@/features/memory/components/MemoryInspector').then(m => ({ default: m.MemoryInspector })))
const IdeasPage = lazy(() => import('@/features/ideas/IdeasPage').then(m => ({ default: m.IdeasPage })))

// Core views lazy loaded to improve startup time and tab switching smoothness
const ChatViewWrapper = lazy(() => import('./ViewManager/ChatViewWrapper').then(m => ({ default: m.ChatViewWrapper })))
const ProjectsView = lazy(() => import('./ViewManager/ProjectsView').then(m => ({ default: m.ProjectsView })))
const SettingsView = lazy(() => import('./ViewManager/SettingsView').then(m => ({ default: m.SettingsView })))

interface ViewManagerProps {
    currentView: 'chat' | 'projects' | 'council' | 'settings' | 'mcp' | 'memory' | 'ideas'
    messagesEndRef: React.RefObject<HTMLDivElement>
    fileInputRef: React.RefObject<HTMLInputElement>
    textareaRef: React.RefObject<HTMLTextAreaElement>
    onScrollToBottom: () => void
    showScrollButton: boolean
    setShowScrollButton: (show: boolean) => void
    showFileMenu: boolean
    setShowFileMenu: (show: boolean) => void
    templates: ChatTemplate[]
    /** Callback to navigate to a project (used by Ideas page after project creation) */
    onNavigateToProject?: (projectId: string) => void | Promise<void>
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
    templates,
    onNavigateToProject
}) => {
    // Context Consumption
    const { language, settingsCategory, appSettings, quotas, codexUsage } = useAuth()
    const {
        models, proxyModels, loadModels,
        selectedProvider, selectedModel, setSelectedModel, setSelectedProvider,
        groupedModels, persistLastSelection, setIsModelMenuOpen
    } = useModel()

    // Fix: extract models array from grouped result if it exists (using .models), otherwise filter models array
    const group = groupedModels && (groupedModels as GroupedModels)['ollama']
    const ollamaModels = group ? group.models : undefined
    const installedModels = Array.isArray(ollamaModels) && ollamaModels.length > 0
        ? ollamaModels
        : models.filter(m => m.provider === 'ollama')

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
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'm') {
                setIsModelMenuOpen(prev => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [setIsModelMenuOpen])

    const renderChatView = () => (
        <ChatViewWrapper
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
    )

    const renderProjectsView = () => (
        <ProjectsView
            projects={projects}
            loadProjects={() => { void loadProjects() }}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            language={language}
            terminalTabs={terminalTabs}
            activeTerminalId={activeTerminalId}
            setTerminalTabs={setTerminalTabs}
            setActiveTabId={setActiveTerminalId}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onSelectModel={(p, m) => {
                setSelectedProvider(p)
                setSelectedModel(m)
                void persistLastSelection(p, m)
            }}
            groupedModels={groupedModels}
            quotas={quotas}
            codexUsage={codexUsage}
            appSettings={appSettings}
            onSendMessage={(text) => {
                setInput(text ?? '')
                void sendMessage(text ?? '')
            }}
            displayMessages={displayMessages}
            isLoading={isLoading}
        />
    )

    const renderSettingsView = () => (
        <SettingsView
            installedModels={installedModels}
            proxyModels={proxyModels}
            loadModels={() => void loadModels()}
            settingsCategory={settingsCategory}
            groupedModels={groupedModels}
        />
    )

    const renderView = () => {
        switch (currentView) {
            case 'chat': return renderChatView()
            case 'projects': return renderProjectsView()
            case 'council': return <AgentDashboard language={language} />
            case 'settings': return renderSettingsView()
            case 'mcp':
                return (
                    <div className="h-full p-6 overflow-y-auto bg-tech-grid bg-tech-grid-sm">
                        <Suspense fallback={<LoadingState size="md" />}>
                            <DockerDashboard onOpenTerminal={handleOpenTerminal} language={language} />
                        </Suspense>
                    </div>
                )
            case 'memory':
                return (
                    <Suspense fallback={<LoadingState size="md" />}>
                        <MemoryInspector />
                    </Suspense>
                )
            case 'ideas':
                return (
                    <Suspense fallback={<LoadingState size="md" />}>
                        <IdeasPage language={language} onNavigateToProject={(id) => void onNavigateToProject?.(id)} />
                    </Suspense>
                )
            default: return null
        }
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={currentView}
                className={cn(
                    "h-full overflow-hidden",
                    currentView === 'memory' && "h-[calc(100vh-64px)]"
                )}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }} // Optimized for 120fps feel
            >
                <Suspense fallback={<LoadingState size="md" />}>
                    {renderView()}
                </Suspense>
            </motion.div>

            {/* Global Mic Indicator */}
            {isListening && (
                <div onClick={() => stopListening()} className="absolute top-4 right-4 z-[9999] cursor-pointer hover:bg-destructive/80 transition-colors flex items-center gap-2 bg-destructive/70 text-destructive-foreground px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-current animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider">Listening</span>
                </div>
            )}
        </AnimatePresence>
    )
}
