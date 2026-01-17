import { AppHeader } from '@renderer/components/layout/AppHeader'
import { CommandPalette } from '@renderer/components/layout/CommandPalette'
import { DragDropWrapper } from '@renderer/components/layout/DragDropWrapper'
import { LayoutManager } from '@renderer/components/layout/LayoutManager'
import { QuickActionBar } from '@renderer/components/layout/QuickActionBar'
import { Sidebar } from '@renderer/components/layout/Sidebar'
import { UpdateNotification } from '@renderer/components/layout/UpdateNotification'
import { ErrorBoundary } from '@renderer/components/shared/ErrorBoundary'
import { ErrorFallback } from '@renderer/components/shared/ErrorFallback'
import { KeyboardShortcutsModal } from '@renderer/components/shared/KeyboardShortcutsModal'
import { Modal } from '@renderer/components/ui/modal'
import { useTextToSpeech } from '@renderer/features/chat/hooks/useTextToSpeech'
import { useVoiceInput } from '@renderer/features/chat/hooks/useVoiceInput'
import { ChatTemplate } from '@renderer/features/chat/types'
import { SettingsCategory } from '@renderer/features/settings/types'
// import { SSHManager } from '@renderer/features/ssh/SSHManager' // Lazy loaded
import { useAppState } from '@renderer/hooks/useAppState'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { useTranslation } from '@renderer/i18n'
import { ViewManager } from '@renderer/views/ViewManager'
import { lazy, Suspense, useEffect } from 'react'

import { useAuth } from '@/context/AuthContext'
import { useChat } from '@/context/ChatContext'
import { useModel } from '@/context/ModelContext'
import { useProject } from '@/context/ProjectContext'
import { AnimatePresence } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'
import { Chat } from '@/types'

import '@renderer/App.css'

// Lazy load heavy components
const SSHManager = lazy(() => import('@renderer/features/ssh/SSHManager').then(m => ({ default: m.SSHManager })))
const AudioChatOverlay = lazy(() => import('@renderer/features/chat/components/AudioChatOverlay').then(m => ({ default: m.AudioChatOverlay })))


export default function App() {
    // Context Consumption
    const {
        handleAntigravityLogout, isAuthModalOpen, setIsAuthModalOpen,
        setSettingsCategory, language
    } = useAuth()

    const { setInput, handleSend, processFile, createNewChat, currentChatId, setCurrentChatId, chats, setChats } = useChat()

    const { isListening, startListening, stopListening } = useVoiceInput((text) => setInput(prev => prev + text))
    const { speak: handleSpeak, stop: handleStopSpeak, isSpeaking } = useTextToSpeech()

    const { models, loadModels, selectedModel, setSelectedModel } = useModel()
    const { projects, setSelectedProject, selectedProject } = useProject()

    const { t } = useTranslation(language || 'en')

    // App state management
    const appState = useAppState()

    // Debug / Global Speak Handler
    useEffect(() => {
        window.orbitSpeak = handleSpeak
    }, [handleSpeak])

    // Keyboard shortcuts
    useKeyboardShortcuts({
        onCommandPalette: () => appState.setShowCommandPalette(!appState.showCommandPalette),
        onNewChat: createNewChat,
        onOpenSettings: () => {
            appState.setCurrentView('settings')
            setSettingsCategory('general')
        },
        onShowShortcuts: () => appState.setShowShortcuts(true),
        onClearChat: () => {
            void (async () => {
                if (currentChatId) {
                    await window.electron.db.deleteMessages(currentChatId)
                    const updatedChats = await window.electron.db.getAllChats()
                    setChats(updatedChats as Chat[])
                }
            })()
        },
        onSwitchView: (view) => appState.setCurrentView(view),
        onToggleSidebar: () => appState.setIsSidebarCollapsed(!appState.isSidebarCollapsed),
        onCloseModals: () => {
            appState.setShowCommandPalette(false)
            appState.setShowShortcuts(false)
            appState.setShowSSHManager(false)
        },
        showCommandPalette: appState.showCommandPalette,
        showShortcuts: appState.showShortcuts,
        showSSHManager: appState.showSSHManager,
        currentChatId
    })

    const CHAT_TEMPLATES: ChatTemplate[] = [
        { id: 'code', icon: 'Code', iconColor: 'text-blue-400', title: t('templates.code.title'), description: t('templates.code.description'), prompt: t('templates.code.prompt') },
        { id: 'analyze', icon: 'FileSearch', iconColor: 'text-emerald-400', title: t('templates.analyze.title'), description: t('templates.analyze.description'), prompt: t('templates.analyze.prompt') },
        { id: 'creative', icon: 'Sparkles', iconColor: 'text-purple-400', title: t('templates.creative.title'), description: t('templates.creative.description'), prompt: t('templates.creative.prompt') },
        { id: 'debug', icon: 'Bug', iconColor: 'text-rose-400', title: t('templates.debug.title'), description: t('templates.debug.description'), prompt: t('templates.debug.prompt') }
    ]

    return (
        <ErrorBoundary fallback={<ErrorFallback error={new Error('App Error')} resetErrorBoundary={() => window.location.reload()} />}>
            <div className="app-container h-screen w-full overflow-hidden">

                {/* Context Modals (kept outside layout) */}
                <Modal
                    isOpen={isAuthModalOpen}
                    onClose={() => setIsAuthModalOpen(false)}
                    title={t('auth.authError')}
                    footer={
                        <button
                            onClick={() => {
                                void (async () => {
                                    await handleAntigravityLogout()
                                    setIsAuthModalOpen(false)
                                    appState.setCurrentView('settings')
                                    setSettingsCategory('accounts')
                                })()
                            }}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium"
                        >
                            {t('auth.goToAccounts')}
                        </button>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">{t('auth.connectionFailed')}</p>
                    </div>
                </Modal>

                <AnimatePresence>
                    {appState.showShortcuts && (
                        <KeyboardShortcutsModal
                            isOpen={appState.showShortcuts}
                            onClose={() => appState.setShowShortcuts(false)}
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {appState.isAudioOverlayOpen && (
                        <Suspense fallback={null}>
                            <AudioChatOverlay
                                isOpen={appState.isAudioOverlayOpen}
                                onClose={() => appState.setIsAudioOverlayOpen(false)}
                                isListening={isListening}
                                startListening={startListening}
                                stopListening={stopListening}
                                isSpeaking={isSpeaking}
                                onStopSpeaking={() => handleStopSpeak()}
                                language={language || 'en'}
                            />
                        </Suspense>
                    )}
                </AnimatePresence>

                <QuickActionBar
                    onExplain={(text) => {
                        setInput(`Açıkla: ${text}`)
                        handleSend()
                    }}
                    onTranslate={(text) => {
                        setInput(`Çevir: ${text}`)
                        handleSend()
                    }}
                    language={language || 'en'}
                />
                <UpdateNotification />

                <AnimatePresence>
                    {appState.showSSHManager && (
                        <Suspense fallback={null}>
                            <SSHManager
                                isOpen={appState.showSSHManager}
                                onClose={() => appState.setShowSSHManager(false)}
                                language={language || 'en'}
                            />
                        </Suspense>
                    )}
                </AnimatePresence>

                <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
                    {appState.toasts.map(toast => (
                        <div
                            key={toast.id}
                            className={cn(
                                'px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 pointer-events-auto flex items-center justify-center gap-3 min-w-[240px]',
                                toast.type === 'success'
                                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                    : toast.type === 'error'
                                        ? 'bg-red-500/20 border-red-500/30 text-red-400'
                                        : 'bg-zinc-800/80 border-white/10 text-white'
                            )}
                        >
                            <span className="text-lg">
                                {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
                            </span>
                            <div className="text-sm font-medium">{toast.message}</div>
                            <button
                                onClick={() => appState.removeToast(toast.id)}
                                className="ml-auto opacity-50"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                <CommandPalette
                    isOpen={appState.showCommandPalette}
                    onClose={() => appState.setShowCommandPalette(false)}
                    chats={chats}
                    onSelectChat={setCurrentChatId}
                    onNewChat={createNewChat}
                    projects={projects}
                    onSelectProject={(id: string) => {
                        const p = projects.find(pro => pro.id === id)
                        if (p) {
                            setSelectedProject(p)
                            appState.setCurrentView('projects')
                        }
                    }}
                    onOpenSettings={(cat?: SettingsCategory) => {
                        appState.setCurrentView('settings')
                        if (cat) { setSettingsCategory(cat) }
                    }}
                    onOpenSSHManager={() => appState.setShowSSHManager(true)}
                    onRefreshModels={loadModels}
                    models={models}
                    onSelectModel={(m) => setSelectedModel(m)}
                    selectedModel={selectedModel}
                    onClearChat={() => {
                        void (async () => {
                            if (currentChatId) {
                                await window.electron.db.deleteMessages(currentChatId)
                                const updatedChats = await window.electron.db.getAllChats()
                                setChats(updatedChats as Chat[])
                            }
                        })()
                    }}
                    t={t}
                />

                {/* Main Application Layout */}
                <div className="absolute inset-0 flex flex-col overflow-hidden">
                    <LayoutManager
                        isSidebarCollapsed={appState.isSidebarCollapsed}
                        setIsSidebarCollapsed={appState.setIsSidebarCollapsed}
                        sidebarContent={
                            !(appState.currentView === 'projects' && selectedProject) ? (
                                <Sidebar
                                    currentView={appState.currentView}
                                    onChangeView={appState.setCurrentView}
                                    isCollapsed={appState.isSidebarCollapsed}
                                    toggleSidebar={() => appState.setIsSidebarCollapsed(!appState.isSidebarCollapsed)}
                                    onOpenSettings={(cat?: SettingsCategory) => {
                                        appState.setCurrentView('settings')
                                        if (cat) { setSettingsCategory(cat) }
                                    }}
                                    onSearch={() => { }}
                                />
                            ) : null
                        }
                        mainContent={
                            <>
                                <AppHeader currentView={appState.currentView} />
                                <DragDropWrapper
                                    isDragging={appState.isDragging}
                                    setIsDragging={appState.setIsDragging}
                                    onFileDrop={processFile}
                                >
                                    <ViewManager
                                        currentView={appState.currentView}
                                        templates={CHAT_TEMPLATES}
                                        messagesEndRef={appState.messagesEndRef}
                                        fileInputRef={appState.fileInputRef}
                                        textareaRef={appState.textareaRef}
                                        onScrollToBottom={() => appState.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                        showScrollButton={appState.showScrollButton}
                                        setShowScrollButton={appState.setShowScrollButton}
                                        showFileMenu={appState.showFileMenu}
                                        setShowFileMenu={appState.setShowFileMenu}
                                    />
                                    <div id="modal-root" />
                                </DragDropWrapper>
                            </>
                        }
                    />
                </div>
            </div>
        </ErrorBoundary >
    )
}
