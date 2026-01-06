import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { SSHManager } from './features/ssh/SSHManager'
import { Sidebar } from './components/layout/Sidebar'
import { CommandPalette } from './components/layout/CommandPalette'
import { QuickActionBar } from './components/layout/QuickActionBar'
import { AudioChatOverlay } from './features/chat/components/AudioChatOverlay'
import { AppHeader } from './components/layout/AppHeader'
import { Modal } from './components/ui/modal'

import { useVoiceInput } from './features/chat/hooks/useVoiceInput'
import { useTextToSpeech } from './features/chat/hooks/useTextToSpeech'
import { useModelManager } from './features/models/hooks/useModelManager'
import { useChatManager } from './features/chat/hooks/useChatManager'
import { useProjectManager } from './features/projects/hooks/useProjectManager'
import { useAuthManager } from './features/settings/hooks/useAuthManager'

import { ViewManager } from './views/ViewManager'
import './App.css'

import { AnimatePresence, motion } from 'framer-motion'
import { Attachment, Toast } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { KeyboardShortcutsModal } from './components/shared/KeyboardShortcutsModal'
import { useTranslation } from './i18n'

const CHAT_TEMPLATES = [
    { id: 'code', icon: 'Code', iconColor: 'text-blue-400', title: 'Kod Yazımı', description: 'Bileşenler ve algoritmalar oluştur.', prompt: 'Bana modern bir React bileşeni oluşturabilir misin? Şık bir kart tasarımı olsun.' },
    { id: 'analyze', icon: 'FileSearch', iconColor: 'text-emerald-400', title: 'Analiz Et', description: 'Dosya ve verileri incele.', prompt: 'Bu projedeki mimari yapıyı analiz edip geliştirme önerileri sunar mısın?' },
    { id: 'creative', icon: 'Sparkles', iconColor: 'text-purple-400', title: 'Yaratıcı Yazım', description: 'Metin ve içerik üret.', prompt: 'Orbit isimli bir AI asistanı için etkileyici bir tanıtım metni yazar mısın?' },
    { id: 'debug', icon: 'Bug', iconColor: 'text-rose-400', title: 'Hata Ayıkla', description: 'Sorunları bul ve çöz.', prompt: 'Kodumdaki bellek sızıntısını bulmama yardımcı olur musun?' }
]

export default function App() {
    const {
        appSettings, setAppSettings, settingsCategory, setSettingsCategory,
        isAuthModalOpen, setIsAuthModalOpen, quotas, codexUsage,
        handleAntigravityLogout, language
    } = useAuthManager()

    const { t } = useTranslation(language)

    const {
        models, proxyModels, selectedModel, setSelectedModel, selectedProvider, setSelectedProvider,
        groupedModels, loadModels, persistLastSelection
    } = useModelManager(appSettings, setAppSettings)

    const { isListening, startListening, stopListening } = useVoiceInput((text) => setInput(prev => prev + text))
    const { speak: handleSpeak, stop: handleStopSpeak, isSpeaking, speakingMessageId } = useTextToSpeech()

    const {
        chats, currentChatId, setCurrentChatId, messages, displayMessages, searchTerm, setSearchTerm,
        input, setInput, isLoading, streamingContent, streamingReasoning, streamingSpeed, contextTokens,
        handleSend, stopGeneration, createNewChat, deleteChat, clearMessages, setChats
    } = useChatManager({
        selectedProvider,
        selectedModel,
        language,
        appSettings,
        autoReadEnabled: false,
        formatChatError: (err) => String(err)
    })

    const {
        projects, selectedProject, setSelectedProject, terminalTabs, setTerminalTabs,
        activeTerminalId, setActiveTerminalId, loadProjects, handleOpenTerminal
    } = useProjectManager()

    const [currentView, setCurrentView] = useState<'chat' | 'projects' | 'council' | 'settings' | 'mcp'>('chat')
    const [isDragging, setIsDragging] = useState(false)
    const [toasts, setToasts] = useState<Toast[]>([])
    const [showCommandPalette, setShowCommandPalette] = useState(false)
    const [showSSHManager, setShowSSHManager] = useState(false)
    const [showShortcuts, setShowShortcuts] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [showFileMenu, setShowFileMenu] = useState(false)
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [autoReadEnabled, setAutoReadEnabled] = useState(false)
    const [showScrollButton, setShowScrollButton] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [isAudioOverlayOpen, setIsAudioOverlayOpen] = useState(false)

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
            e.preventDefault()
            handleSend()
        }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const files = Array.from(e.clipboardData.files)
        if (files.length > 0) {
            e.preventDefault()
            files.forEach(processFile)
        }
    }

    const processFile = async (file: File) => {
        const id = uuidv4()
        const newAttachment: Attachment = {
            id,
            name: file.name,
            type: file.type.split('/')[0] as any,
            size: file.size,
            status: 'uploading'
        }
        setAttachments(prev => [...prev, newAttachment])

        try {
            const content = await file.text()
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'ready', content } : a))
        } catch (error) {
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a))
        }
    }

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index))
    }

    return (
        <div className="app-container">
            <div className="app-drag-region" />
            <Sidebar
                currentView={currentView}
                onChangeView={setCurrentView}
                onNewChat={() => { setCurrentView('chat'); createNewChat() }}
                chats={chats}
                currentChatId={currentChatId}
                onSelectChat={(id) => { setCurrentView('chat'); setCurrentChatId(id) }}
                onDeleteChat={deleteChat}
                isCollapsed={false}
                toggleSidebar={() => { }}
                onOpenSettings={(cat) => { setCurrentView('settings'); if (cat) setSettingsCategory(cat as any) }}
                onTogglePin={(id, p) => { window.electron.db.updateChat(id, { isPinned: p }).then(() => loadProjects()) }}
                onToggleFavorite={(id, f) => { window.electron.db.updateChat(id, { isFavorite: f }).then(() => loadProjects()) }}
                onSearch={() => { }}
                language={language as any}
                settingsCategory={settingsCategory}
                onSelectSettingsCategory={setSettingsCategory}
            />

            <div className="main-layout">
                <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
                    <AppHeader
                        currentView={currentView}
                        currentChatId={currentChatId}
                        chats={chats}
                        onClearChat={clearMessages}
                        t={t}
                    />
                </div>

                <div className="content-area" onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); Array.from(e.dataTransfer.files).forEach(processFile) }}>
                    <AnimatePresence>{isDragging && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center border-4 border-dashed border-primary/30 m-6 rounded-[32px] overflow-hidden"><div className="absolute inset-0 bg-primary/5 animate-pulse" /><div className="relative text-center space-y-4"><div className="text-6xl mb-4">🏮</div><div className="text-2xl font-black tracking-tight text-foreground uppercase font-sans">Siparişi Bırakın</div><div className="text-muted-foreground/60 text-sm font-medium">Analiz için dosyaları merkeze gönderin.</div></div></motion.div>}</AnimatePresence>

                    <main className="flex-1 flex flex-col overflow-hidden relative h-full">
                        <ViewManager
                            currentView={currentView}
                            messages={messages}
                            displayMessages={displayMessages}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            t={t}
                            templates={CHAT_TEMPLATES}
                            setInput={setInput}
                            isLoading={isLoading}
                            streamingContent={streamingContent}
                            streamingReasoning={streamingReasoning}
                            streamingSpeed={streamingSpeed}
                            language={language as any}
                            selectedProvider={selectedProvider}
                            selectedModel={selectedModel}
                            onSpeak={handleSpeak}
                            onStopSpeak={handleStopSpeak}
                            speakingMessageId={speakingMessageId}
                            messagesEndRef={messagesEndRef}
                            showScrollButton={showScrollButton}
                            setShowScrollButton={setShowScrollButton}
                            onScrollToBottom={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                            input={input}
                            attachments={attachments}
                            removeAttachment={removeAttachment}
                            sendMessage={handleSend}
                            stopGeneration={stopGeneration}
                            fileInputRef={fileInputRef}
                            textareaRef={textareaRef}
                            processFile={processFile}
                            showFileMenu={showFileMenu}
                            setShowFileMenu={setShowFileMenu}
                            onSelectModel={async (p, m) => { setSelectedProvider(p as any); setSelectedModel(m); persistLastSelection(p, m); if (p === 'llama-cpp') await window.electron.llama.loadModel(m, { backend: 'auto' }) }}
                            appSettings={appSettings}
                            groupedModels={groupedModels}
                            quotas={quotas}
                            codexUsage={codexUsage}
                            setIsModelMenuOpen={() => { }}
                            contextTokens={contextTokens}
                            isListening={isListening}
                            startListening={startListening}
                            stopListening={stopListening}
                            autoReadEnabled={autoReadEnabled}
                            setAutoReadEnabled={setAutoReadEnabled}
                            handleKeyDown={handleKeyDown}
                            handlePaste={handlePaste}
                            projects={projects}
                            loadProjects={loadProjects}
                            selectedProject={selectedProject}
                            setSelectedProject={setSelectedProject}
                            terminalTabs={terminalTabs}
                            activeTerminalId={activeTerminalId}
                            setTerminalTabs={setTerminalTabs}
                            setActiveTerminalId={setActiveTerminalId}
                            models={models}
                            proxyModels={proxyModels}
                            loadModels={loadModels}
                            settingsCategory={settingsCategory as any}
                            setSettingsCategory={setSettingsCategory as any}
                            handleOpenTerminal={handleOpenTerminal}
                        />
                    </main>
                </div>
                <AnimatePresence>{showSSHManager && <SSHManager isOpen={showSSHManager} onClose={() => setShowSSHManager(false)} />}</AnimatePresence>
                <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">{toasts.map(tZ => <div key={tZ.id} className={cn("px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 pointer-events-auto flex items-center gap-3 min-w-[240px]", tZ.type === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : tZ.type === 'error' ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-zinc-800/80 border-white/10 text-white")}><span className="text-lg">{tZ.type === 'success' ? '✅' : tZ.type === 'error' ? '❌' : 'ℹ️'}</span><div className="text-sm font-medium">{tZ.message}</div><button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== tZ.id))} className="ml-auto opacity-50">×</button></div>)}</div>
                <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} chats={chats} onSelectChat={setCurrentChatId} onNewChat={createNewChat} projects={projects} onSelectProject={(id: string) => { const p = projects.find(pro => pro.id === id); if (p) { setSelectedProject(p); setCurrentView('projects') } }} onOpenSettings={(cat: any) => { setCurrentView('settings'); if (cat) setSettingsCategory(cat) }} onOpenSSHManager={() => setShowSSHManager(true)} onRefreshModels={loadModels} models={models} onSelectModel={setSelectedModel} selectedModel={selectedModel} onClearChat={async () => { if (currentChatId) { await window.electron.db.deleteMessages(currentChatId); setChats(await window.electron.db.getAllChats()) } }} />
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
                {isAudioOverlayOpen && <AudioChatOverlay isOpen={isAudioOverlayOpen} onClose={() => setIsAudioOverlayOpen(false)} isListening={isListening} startListening={startListening} stopListening={stopListening} isSpeaking={isSpeaking} onStopSpeaking={() => handleStopSpeak()} />}
            </AnimatePresence>

            <QuickActionBar onExplain={(text) => { setInput(`Açıkla: ${text}`); handleSend() }} onTranslate={(text) => { setInput(`Çevir: ${text}`); handleSend() }} />
        </div>
    )
}
