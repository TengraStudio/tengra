import { useState, useRef, useEffect } from 'react'
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

import { AnimatePresence, motion } from 'framer-motion'
import { Toast } from '@/types'
import { KeyboardShortcutsModal } from './components/shared/KeyboardShortcutsModal'
import { useTranslation } from './i18n'
import { useAuth } from '@/context/AuthContext'
import { useChat } from '@/context/ChatContext'
import { useModel } from '@/context/ModelContext'
import { useProject } from '@/context/ProjectContext'

export default function App() {
    // Context Consumption
    const {
        handleAntigravityLogout, isAuthModalOpen, setIsAuthModalOpen,
        setSettingsCategory, language
    } = useAuth()

    // Some Voice Hooks are still local for now or used for Overlay
    // You might want to move these to ChatContext eventually too if they aren't already
    const { setInput, handleSend, processFile, createNewChat, currentChatId, setCurrentChatId, chats, setChats } = useChat()

    const { isListening, startListening, stopListening } = useVoiceInput((text) => setInput(prev => prev + text))
    const { speak: handleSpeak, stop: handleStopSpeak, isSpeaking, speakingMessageId } = useTextToSpeech()

    const { models, loadModels, selectedModel, setSelectedModel } = useModel()
    const { projects, setSelectedProject } = useProject()

    const { t } = useTranslation(language || 'en')

    // Debug / Global Speak Handler
    useEffect(() => {
        if (speakingMessageId) console.log('🔊 Speaking Message:', speakingMessageId)
        // Attach to window for external control if needed
        window.orbitSpeak = handleSpeak
    }, [speakingMessageId, handleSpeak])

    // Local UI State
    const [currentView, setCurrentView] = useState<'chat' | 'projects' | 'council' | 'settings' | 'mcp'>('chat')
    const [isDragging, setIsDragging] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [toasts, setToasts] = useState<Toast[]>([])
    const [showCommandPalette, setShowCommandPalette] = useState(false)
    const [showSSHManager, setShowSSHManager] = useState(false)
    const [showShortcuts, setShowShortcuts] = useState(false)
    const [showFileMenu, setShowFileMenu] = useState(false)
    const [showScrollButton, setShowScrollButton] = useState(false)
    const [isAudioOverlayOpen, setIsAudioOverlayOpen] = useState(false)

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const CHAT_TEMPLATES = [
        { id: 'code', icon: 'Code', iconColor: 'text-blue-400', title: t('templates.code.title'), description: t('templates.code.description'), prompt: t('templates.code.prompt') },
        { id: 'analyze', icon: 'FileSearch', iconColor: 'text-emerald-400', title: t('templates.analyze.title'), description: t('templates.analyze.description'), prompt: t('templates.analyze.prompt') },
        { id: 'creative', icon: 'Sparkles', iconColor: 'text-purple-400', title: t('templates.creative.title'), description: t('templates.creative.description'), prompt: t('templates.creative.prompt') },
        { id: 'debug', icon: 'Bug', iconColor: 'text-rose-400', title: t('templates.debug.title'), description: t('templates.debug.description'), prompt: t('templates.debug.prompt') }
    ]

    return (
        <div className="app-container">
            <div className="app-drag-region" />
            <Sidebar
                currentView={currentView}
                onChangeView={setCurrentView}
                isCollapsed={isSidebarCollapsed}
                toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onOpenSettings={(cat) => { setCurrentView('settings'); if (cat) setSettingsCategory(cat as any) }}
                onSearch={() => { }}
            />

            <div className="main-layout">
                <div className="relative z-10 flex-none">
                    <AppHeader
                        currentView={currentView}
                    />
                </div>

                <div className="content-area" onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); Array.from(e.dataTransfer.files).forEach(processFile) }}>
                    <AnimatePresence>{isDragging && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center border-4 border-dashed border-primary/30 m-6 rounded-[32px] overflow-hidden"><div className="absolute inset-0 bg-primary/5 animate-pulse" /><div className="relative text-center space-y-4"><div className="text-6xl mb-4">🏮</div><div className="text-2xl font-black tracking-tight text-foreground uppercase font-sans">{t('dragDrop.title')}</div><div className="text-muted-foreground/60 text-sm font-medium">{t('dragDrop.description')}</div></div></motion.div>}</AnimatePresence>

                    <main className="flex-1 flex flex-col overflow-hidden relative h-full">
                        <ViewManager
                            currentView={currentView}
                            templates={CHAT_TEMPLATES}
                            messagesEndRef={messagesEndRef}
                            fileInputRef={fileInputRef}
                            textareaRef={textareaRef}
                            onScrollToBottom={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                            showScrollButton={showScrollButton}
                            setShowScrollButton={setShowScrollButton}
                            showFileMenu={showFileMenu}
                            setShowFileMenu={setShowFileMenu}
                        />
                    </main>
                </div>
                <AnimatePresence>{showSSHManager && <SSHManager isOpen={showSSHManager} onClose={() => setShowSSHManager(false)} language={language || 'en'} />}</AnimatePresence>
                <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">{toasts.map(tZ => <div key={tZ.id} className={cn("px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 pointer-events-auto flex items-center gap-3 min-w-[240px]", tZ.type === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : tZ.type === 'error' ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-zinc-800/80 border-white/10 text-white")}><span className="text-lg">{tZ.type === 'success' ? '✅' : tZ.type === 'error' ? '❌' : 'ℹ️'}</span><div className="text-sm font-medium">{tZ.message}</div><button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== tZ.id))} className="ml-auto opacity-50">×</button></div>)}</div>

                <CommandPalette
                    isOpen={showCommandPalette}
                    onClose={() => setShowCommandPalette(false)}
                    chats={chats}
                    onSelectChat={setCurrentChatId}
                    onNewChat={createNewChat}
                    projects={projects}
                    onSelectProject={(id: string) => { const p = projects.find(pro => pro.id === id); if (p) { setSelectedProject(p); setCurrentView('projects') } }}
                    onOpenSettings={(cat: any) => { setCurrentView('settings'); if (cat) setSettingsCategory(cat) }}
                    onOpenSSHManager={() => setShowSSHManager(true)}
                    onRefreshModels={loadModels}
                    models={models}
                    onSelectModel={setSelectedModel}
                    selectedModel={selectedModel}
                    onClearChat={async () => { if (currentChatId) { await window.electron.db.deleteMessages(currentChatId); setChats(await window.electron.db.getAllChats()) } }}
                    t={t}
                />
            </div>

            <Modal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title="Kimlik Doğrulama Hatası" footer={<button onClick={async () => { await handleAntigravityLogout(); setIsAuthModalOpen(false); setCurrentView('settings'); setSettingsCategory('accounts') }} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">Hesaplara Git</button>}>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Antigravity sunucusuyla bağlantı kurulamadı. Lütfen oturum açın veya API anahtarınızı kontrol edin.</p>
                </div>
            </Modal>

            <AnimatePresence>
                {showShortcuts && <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />}
            </AnimatePresence>

            <AnimatePresence>
                {isAudioOverlayOpen && <AudioChatOverlay isOpen={isAudioOverlayOpen} onClose={() => setIsAudioOverlayOpen(false)} isListening={isListening} startListening={startListening} stopListening={stopListening} isSpeaking={isSpeaking} onStopSpeaking={() => handleStopSpeak()} language={language || 'en'} />}
            </AnimatePresence>

            <QuickActionBar onExplain={(text) => { setInput(`Açıkla: ${text}`); handleSend() }} onTranslate={(text) => { setInput(`Çevir: ${text}`); handleSend() }} language={language || 'en'} />
            <UpdateNotification />
        </div>
    )
}
