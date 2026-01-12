import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { SSHManager } from './features/ssh/SSHManager'
import { Sidebar } from './components/layout/Sidebar'
import { CommandPalette } from './components/layout/CommandPalette'
import { QuickActionBar } from './components/layout/QuickActionBar'
import { AudioChatOverlay } from './features/chat/components/AudioChatOverlay'
import { AppHeader } from './components/layout/AppHeader'
import { Modal } from './components/ui/modal'
import { UpdateNotification } from './components/layout/UpdateNotification'

import { useVoiceInput } from './features/chat/hooks/useVoiceInput'
import { useTextToSpeech } from './features/chat/hooks/useTextToSpeech'

import { ViewManager } from './views/ViewManager'
import './App.css'

import { AnimatePresence, motion } from '@/lib/framer-motion-compat'
import { Chat } from '@/types'
import { ChatTemplate } from './features/chat/types'
import { SettingsCategory } from './features/settings/types'
import { KeyboardShortcutsModal } from './components/shared/KeyboardShortcutsModal'
import { useTranslation } from './i18n'
import { useAuth } from '@/context/AuthContext'
import { useChat } from '@/context/ChatContext'
import { useModel } from '@/context/ModelContext'
import { useProject } from '@/context/ProjectContext'
import { useAppState } from './hooks/useAppState'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
    // Context Consumption
    const {
        handleAntigravityLogout, isAuthModalOpen, setIsAuthModalOpen,
        setSettingsCategory, language
    } = useAuth()

    const { setInput, handleSend, processFile, createNewChat, currentChatId, setCurrentChatId, chats, setChats } = useChat()

    const { isListening, startListening, stopListening } = useVoiceInput((text) => setInput(prev => prev + text))
    const { speak: handleSpeak, stop: handleStopSpeak, isSpeaking, speakingMessageId } = useTextToSpeech()

    const { models, loadModels, selectedModel, setSelectedModel } = useModel()
    const { projects, setSelectedProject, selectedProject } = useProject()

    const { t } = useTranslation(language || 'en')

    // App state management
    const appState = useAppState()

    // Debug / Global Speak Handler
    useEffect(() => {
        if (speakingMessageId) console.log('🔊 Speaking Message:', speakingMessageId)
        window.orbitSpeak = handleSpeak
    }, [speakingMessageId, handleSpeak])

    // Keyboard shortcuts
    useKeyboardShortcuts({
        onCommandPalette: () => appState.setShowCommandPalette(!appState.showCommandPalette),
        onNewChat: createNewChat,
        onOpenSettings: () => {
            appState.setCurrentView('settings')
            setSettingsCategory('general')
        },
        onShowShortcuts: () => appState.setShowShortcuts(true),
        onClearChat: async () => {
            if (currentChatId) {
                await window.electron.db.deleteMessages(currentChatId)
                const updatedChats = await window.electron.db.getAllChats()
                setChats(updatedChats as Chat[])
            }
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
        <div className="app-container">
            <div className="app-drag-region" />
            {/* Hide main sidebar when project workspace is open */}
            {!(appState.currentView === 'projects' && selectedProject) && (
                <Sidebar
                    currentView={appState.currentView}
                    onChangeView={appState.setCurrentView}
                    isCollapsed={appState.isSidebarCollapsed}
                    toggleSidebar={() => appState.setIsSidebarCollapsed(!appState.isSidebarCollapsed)}
                    onOpenSettings={(cat?: SettingsCategory) => {
                        appState.setCurrentView('settings')
                        if (cat) setSettingsCategory(cat)
                    }}
                    onSearch={() => {}}
                />
            )}

            <div className="main-layout">
                <div className="relative z-10 flex-none">
                    <AppHeader
                        currentView={appState.currentView}
                    />
                </div>

                <div
                    className="content-area"
                    onDragOver={(e) => { e.preventDefault(); appState.setIsDragging(true) }}
                    onDragLeave={() => appState.setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault()
                        appState.setIsDragging(false)
                        Array.from(e.dataTransfer.files).forEach(processFile)
                    }}
                >
                    <AnimatePresence>
                        {appState.isDragging && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center border-4 border-dashed border-primary/30 m-6 rounded-[32px] overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                                <div className="relative text-center space-y-4">
                                    <div className="text-6xl mb-4">🏮</div>
                                    <div className="text-2xl font-black tracking-tight text-foreground uppercase font-sans">
                                        {t('dragDrop.title')}
                                    </div>
                                    <div className="text-muted-foreground/60 text-sm font-medium">
                                        {t('dragDrop.description')}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <main className="flex-1 flex flex-col overflow-hidden relative h-full">
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
                    </main>
                </div>

                <AnimatePresence>
                    {appState.showSSHManager && (
                        <SSHManager
                            isOpen={appState.showSSHManager}
                            onClose={() => appState.setShowSSHManager(false)}
                            language={language || 'en'}
                        />
                    )}
                </AnimatePresence>

                <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
                    {appState.toasts.map(toast => (
                        <div
                            key={toast.id}
                            className={cn(
                                'px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 pointer-events-auto flex items-center gap-3 min-w-[240px]',
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
                        if (cat) setSettingsCategory(cat)
                    }}
                    onOpenSSHManager={() => appState.setShowSSHManager(true)}
                    onRefreshModels={loadModels}
                    models={models}
                    onSelectModel={(m) => setSelectedModel(m)}
                    selectedModel={selectedModel}
                    onClearChat={async () => {
                        if (currentChatId) {
                            await window.electron.db.deleteMessages(currentChatId)
                            const updatedChats = await window.electron.db.getAllChats()
                            setChats(updatedChats as Chat[])
                        }
                    }}
                    t={t}
                />
            </div>

            <Modal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                title={t('auth.authError')}
                footer={
                    <button
                        onClick={async () => {
                            await handleAntigravityLogout()
                            setIsAuthModalOpen(false)
                            appState.setCurrentView('settings')
                            setSettingsCategory('accounts')
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
        </div>
    )
}
