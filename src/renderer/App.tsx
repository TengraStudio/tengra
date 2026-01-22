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
import { AppView, useAppState } from '@renderer/hooks/useAppState'
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts'
import { Language, useTranslation } from '@renderer/i18n'
import { ViewManager } from '@renderer/views/ViewManager'
import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react'

import { useAuth } from '@/context/AuthContext'
import { useChat } from '@/context/ChatContext'
import { useModel } from '@/context/ModelContext'
import { useProject } from '@/context/ProjectContext'
import { AnimatePresence } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'
import { Chat, Toast } from '@/types'

import '@renderer/App.css'

// Lazy load heavy components
const SSHManager = lazy(() => import('@renderer/features/ssh/SSHManager').then(m => ({ default: m.SSHManager })))
const AudioChatOverlay = lazy(() => import('@renderer/features/chat/components/AudioChatOverlay').then(m => ({ default: m.AudioChatOverlay })))

const getChatTemplates = (t: (key: string) => string): ChatTemplate[] => [
    { id: 'code', icon: 'Code', iconColor: 'text-blue-400', title: t('templates.code.title'), description: t('templates.code.description'), prompt: t('templates.code.prompt') },
    { id: 'analyze', icon: 'FileSearch', iconColor: 'text-emerald-400', title: t('templates.analyze.title'), description: t('templates.analyze.description'), prompt: t('templates.analyze.prompt') },
    { id: 'creative', icon: 'Sparkles', iconColor: 'text-purple-400', title: t('templates.creative.title'), description: t('templates.creative.description'), prompt: t('templates.creative.prompt') },
    { id: 'debug', icon: 'Bug', iconColor: 'text-rose-400', title: t('templates.debug.title'), description: t('templates.debug.description'), prompt: t('templates.debug.prompt') }
]

interface AppModalsProps {
    isAuthModalOpen: boolean
    setIsAuthModalOpen: (open: boolean) => void
    t: (key: string) => string
    handleAntigravityLogout: () => Promise<void>
    setSettingsCategory: (cat: SettingsCategory) => void
    setCurrentView: (view: AppView) => void
    showShortcuts: boolean
    setShowShortcuts: (show: boolean) => void
    isAudioOverlayOpen: boolean
    setIsAudioOverlayOpen: (open: boolean) => void
    isListening: boolean
    startListening: () => void
    stopListening: () => void
    isSpeaking: boolean
    handleStopSpeak: () => void
    language: Language
    showSSHManager: boolean
    setShowSSHManager: (show: boolean) => void
}

/**
 * Main Application Component
 */
export default function App() {
    const { handleAntigravityLogout, isAuthModalOpen, setIsAuthModalOpen, setSettingsCategory, language } = useAuth()
    const { setInput, handleSend, processFile, createNewChat, currentChatId, setCurrentChatId, chats, setChats } = useChat()
    const { t } = useTranslation(language as Language)
    const handleVoiceInput = useCallback((text: string) => { setInput(prev => prev + text) }, [setInput])
    const { isListening, startListening, stopListening } = useVoiceInput(handleVoiceInput)
    const { speak: handleSpeak, stop: handleStopSpeak, isSpeaking } = useTextToSpeech()
    const { models, loadModels, selectedModel, setSelectedModel } = useModel()
    const { projects, setSelectedProject, selectedProject } = useProject()
    const appState = useAppState()

    useEffect(() => { window.orbitSpeak = handleSpeak }, [handleSpeak])

    const handleScrollToBottom = () => {
        const ref = appState.messagesEndRef.current
        if (ref) { ref.scrollIntoView({ behavior: 'smooth' }) }
    }

    const handleClearChat = useCallback(() => {
        const clear = async () => {
            if (currentChatId) {
                await window.electron.db.deleteMessages(currentChatId)
                const updatedChats = await window.electron.db.getAllChats()
                setChats(updatedChats as Chat[])
            }
        }
        void clear()
    }, [currentChatId, setChats])

    const keyboardShortcutsConfig = useMemo(() => ({
        onCommandPalette: () => { appState.setShowCommandPalette(!appState.showCommandPalette) },
        onNewChat: createNewChat,
        onOpenSettings: () => { appState.setCurrentView('settings'); setSettingsCategory('general') },
        onShowShortcuts: () => { appState.setShowShortcuts(true) },
        onClearChat: handleClearChat,
        onSwitchView: (view: AppView) => { appState.setCurrentView(view) },
        onToggleSidebar: () => { appState.setIsSidebarCollapsed(!appState.isSidebarCollapsed) },
        onCloseModals: () => {
            appState.setShowCommandPalette(false)
            appState.setShowShortcuts(false)
            appState.setShowSSHManager(false)
        },
        showCommandPalette: appState.showCommandPalette,
        showShortcuts: appState.showShortcuts,
        showSSHManager: appState.showSSHManager,
        currentChatId
    }), [appState, createNewChat, currentChatId, handleClearChat, setSettingsCategory])

    useKeyboardShortcuts(keyboardShortcutsConfig)
    const chatTemplates = useMemo(() => getChatTemplates(t), [t])

    return (
        <ErrorBoundary fallback={<ErrorFallback error={new Error('App Error')} resetErrorBoundary={() => window.location.reload()} />}>
            <div className="app-container h-screen w-full overflow-hidden">
                <AppModals
                    isAuthModalOpen={isAuthModalOpen} setIsAuthModalOpen={setIsAuthModalOpen} t={t}
                    handleAntigravityLogout={handleAntigravityLogout} setSettingsCategory={setSettingsCategory}
                    setCurrentView={appState.setCurrentView} showShortcuts={appState.showShortcuts}
                    setShowShortcuts={appState.setShowShortcuts} isAudioOverlayOpen={appState.isAudioOverlayOpen}
                    setIsAudioOverlayOpen={appState.setIsAudioOverlayOpen} isListening={isListening}
                    startListening={startListening} stopListening={stopListening} isSpeaking={isSpeaking}
                    handleStopSpeak={handleStopSpeak} language={language} showSSHManager={appState.showSSHManager}
                    setShowSSHManager={appState.setShowSSHManager}
                />
                <QuickActionBar
                    onExplain={(text) => { setInput(`Açıkla: ${text}`); void handleSend() }}
                    onTranslate={(text) => { setInput(`Çevir: ${text}`); void handleSend() }}
                    language={language}
                />
                <UpdateNotification />
                <ToastsContainer toasts={appState.toasts} removeToast={appState.removeToast} />
                <CommandPalette
                    isOpen={appState.showCommandPalette} onClose={() => { appState.setShowCommandPalette(false) }}
                    chats={chats} onSelectChat={setCurrentChatId} onNewChat={createNewChat} projects={projects}
                    onSelectProject={(id: string) => {
                        const p = projects.find(pro => pro.id === id)
                        if (p) { setSelectedProject(p); appState.setCurrentView('projects') }
                    }}
                    onOpenSettings={(cat?: SettingsCategory) => {
                        appState.setCurrentView('settings')
                        if (cat) { setSettingsCategory(cat) }
                    }}
                    onOpenSSHManager={() => { appState.setShowSSHManager(true) }}
                    onRefreshModels={() => { void loadModels() }} models={models} onSelectModel={(m) => { setSelectedModel(m) }}
                    selectedModel={selectedModel} onClearChat={handleClearChat} t={t}
                />
                <div className="absolute inset-0 flex flex-col overflow-hidden">
                    <LayoutManager
                        isSidebarCollapsed={appState.isSidebarCollapsed} setIsSidebarCollapsed={appState.setIsSidebarCollapsed}
                        sidebarContent={!(appState.currentView === 'projects' && selectedProject) ? (
                            <Sidebar
                                currentView={appState.currentView} onChangeView={appState.setCurrentView} isCollapsed={appState.isSidebarCollapsed}
                                toggleSidebar={() => { appState.setIsSidebarCollapsed(!appState.isSidebarCollapsed) }}
                                onOpenSettings={(cat?: SettingsCategory) => {
                                    appState.setCurrentView('settings')
                                    if (cat) { setSettingsCategory(cat) }
                                }}
                                onSearch={() => { }}
                            />
                        ) : null}
                        mainContent={<>
                            <AppHeader currentView={appState.currentView} />
                            <DragDropWrapper isDragging={appState.isDragging} setIsDragging={appState.setIsDragging} onFileDrop={(file) => { void processFile(file) }}>
                                <ViewManager
                                    currentView={appState.currentView} templates={chatTemplates}
                                    messagesEndRef={appState.messagesEndRef} fileInputRef={appState.fileInputRef}
                                    textareaRef={appState.textareaRef} onScrollToBottom={handleScrollToBottom}
                                    showScrollButton={appState.showScrollButton} setShowScrollButton={appState.setShowScrollButton}
                                    showFileMenu={appState.showFileMenu} setShowFileMenu={appState.setShowFileMenu}
                                />
                                <div id="modal-root" />
                            </DragDropWrapper>
                        </>}
                    />
                </div>
            </div>
        </ErrorBoundary>
    )
}

function ToastsContainer({ toasts, removeToast }: { toasts: Toast[], removeToast: (id: string) => void }) {
    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className={cn(
                    'px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 pointer-events-auto flex items-center justify-center gap-3 min-w-[240px]',
                    toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                        toast.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-zinc-800/80 border-white/10 text-white'
                )}>
                    <span className="text-lg">{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
                    <div className="text-sm font-medium">{toast.message}</div>
                    <button onClick={() => { removeToast(toast.id) }} className="ml-auto opacity-50">×</button>
                </div>
            ))}
        </div>
    )
}

function AppModals({
    isAuthModalOpen, setIsAuthModalOpen, t, handleAntigravityLogout, setSettingsCategory, setCurrentView,
    showShortcuts, setShowShortcuts, isAudioOverlayOpen, setIsAudioOverlayOpen,
    isListening, startListening, stopListening, isSpeaking, handleStopSpeak, language, showSSHManager, setShowSSHManager
}: AppModalsProps) {
    return (<>
        <Modal
            isOpen={isAuthModalOpen} onClose={() => { setIsAuthModalOpen(false) }} title={t('auth.authError')}
            footer={<button onClick={() => {
                void (async () => {
                    await handleAntigravityLogout()
                    setIsAuthModalOpen(false)
                    setCurrentView('settings')
                    setSettingsCategory('accounts')
                })()
            }} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">{t('auth.goToAccounts')}</button>}
        >
            <div className="space-y-4"><p className="text-sm text-muted-foreground">{t('auth.connectionFailed')}</p></div>
        </Modal>
        <AnimatePresence>{showShortcuts && <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => { setShowShortcuts(false) }} />}</AnimatePresence>
        <AnimatePresence>{isAudioOverlayOpen && (
            <Suspense fallback={null}>
                <AudioChatOverlay
                    isOpen={isAudioOverlayOpen} onClose={() => { setIsAudioOverlayOpen(false) }} isListening={isListening}
                    startListening={startListening} stopListening={stopListening} isSpeaking={isSpeaking}
                    onStopSpeaking={() => { handleStopSpeak() }} language={language}
                />
            </Suspense>
        )}</AnimatePresence>
        <AnimatePresence>{showSSHManager && (
            <Suspense fallback={null}>
                <SSHManager isOpen={showSSHManager} onClose={() => { setShowSSHManager(false) }} language={language} />
            </Suspense>
        )}</AnimatePresence>
    </>)
}
