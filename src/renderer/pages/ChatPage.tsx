import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select"
import { MessageBubble } from '../components/MessageBubble'
import { HyperparameterPanel } from '../components/HyperparameterPanel'
import {
    Send,
    Paperclip,
    Plus,
    ChevronLeft,
    Settings2,
    MessageSquare,
    Archive,
    Trash2,
    ArchiveRestore,
    ChevronDown,
    Download
} from 'lucide-react'
import { Chat, OllamaModel, Attachment } from '../types'

interface ChatPageProps {
    chats: Chat[]
    currentChatId: string | null
    models: OllamaModel[]
    selectedModel: string
    isLoading: boolean
    streamingContent: string
    onSelectChat: (id: string) => void
    onNewChat: () => void
    onDeleteChat: (id: string) => void
    onArchiveChat?: (id: string) => void
    onRestoreChat?: (id: string) => void
    onSelectModel: (model: string) => void
    onSendMessage: (content: string, attachments?: Attachment[]) => void
    hyperparams: { temperature: number; topP: number; topK: number; repeatPenalty: number }
    onHyperparamsChange: (params: any) => void
}

export function ChatPage({
    chats,
    currentChatId,
    models,
    selectedModel,
    isLoading,
    streamingContent,
    onSelectChat,
    onNewChat,
    onDeleteChat,
    onArchiveChat,
    onRestoreChat,
    onSelectModel,
    onSendMessage,
    hyperparams,
    onHyperparamsChange
}: ChatPageProps) {
    const [input, setInput] = useState('')
    const [showSidebar, setShowSidebar] = useState(true)
    const [showHyperparams, setShowHyperparams] = useState(false)
    const [proxyModels, setProxyModels] = useState<any[]>([])
    const [showArchived, setShowArchived] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        const loadProxyModels = async () => {
            try {
                // @ts-ignore
                if (window.electron.getProxyModels) {
                    // @ts-ignore
                    const pModels: any = await window.electron.getProxyModels()
                    console.log('Loaded proxy models:', pModels)
                    const models = Array.isArray(pModels) ? pModels : (pModels?.data || [])
                    setProxyModels(models)
                }
            } catch (error) {
                console.error('Failed to load proxy models:', error)
            }
        }
        loadProxyModels()
    }, [])

    const currentChat = chats.find(c => c.id === currentChatId)
    const messages = currentChat?.messages || []

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages.length, streamingContent])

    const handleSend = () => {
        if (!input.trim() || isLoading) return
        onSendMessage(input.trim())
        setInput('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // Separate active and archived chats
    const activeChats = chats.filter(c => !c.isArchived)
    const archivedChats = chats.filter(c => c.isArchived)

    // Group active chats by date
    const groupedChats = activeChats.reduce((groups, chat) => {
        const date = new Date(chat.createdAt).toLocaleDateString('tr-TR', {
            month: 'short',
            day: 'numeric'
        })
        if (!groups[date]) groups[date] = []
        groups[date].push(chat)
        return groups
    }, {} as Record<string, Chat[]>)

    const [showExportMenu, setShowExportMenu] = useState(false)

    const handleExportJson = async () => {
        if (!currentChat) return
        const content = JSON.stringify(currentChat, null, 2)
        const filename = `${currentChat.title || 'chat'}-${new Date().toISOString().split('T')[0]}.json`
        // @ts-ignore
        await window.electron.saveFile(content, filename)
        setShowExportMenu(false)
    }

    const handleExportMarkdown = async () => {
        if (!currentChat) return
        let content = `# ${currentChat.title || 'Chat Export'}\n\n`
        content += `Date: ${new Date(currentChat.createdAt).toLocaleString()}\n`
        content += `Model: ${currentChat.model || 'Unknown'}\n\n`

        currentChat.messages.forEach(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant'
            content += `### ${role}\n\n${msg.content}\n\n`
        })

        const filename = `${currentChat.title || 'chat'}-${new Date().toISOString().split('T')[0]}.md`
        // @ts-ignore
        await window.electron.saveFile(content, filename)
        setShowExportMenu(false)
    }

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Chat Sidebar */}
            <AnimatePresence mode="wait">
                {showSidebar && (
                    <motion.aside
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 280, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="border-r border-border/50 flex flex-col bg-card/20 overflow-hidden"
                    >
                        {/* New Chat Button */}
                        <div className="p-3">
                            <button
                                onClick={onNewChat}
                                className="w-full btn-primary flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Yeni Sohbet
                            </button>
                        </div>

                        {/* Chat List */}
                        <div className="flex-1 overflow-y-auto px-2 pb-2">
                            {Object.entries(groupedChats).map(([date, dateChats]) => (
                                <div key={date} className="mb-3">
                                    <p className="px-2 py-1 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        {date}
                                    </p>
                                    {dateChats.map(chat => (
                                        <div
                                            key={chat.id}
                                            className={cn(
                                                "w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors group relative cursor-pointer",
                                                chat.id === currentChatId
                                                    ? "bg-primary/10 text-foreground"
                                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                            )}
                                            onClick={() => onSelectChat(chat.id)}
                                        >
                                            <p className="text-sm font-medium truncate pr-16">
                                                {chat.title || 'Yeni Sohbet'}
                                            </p>
                                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                                                {chat.messages?.length || 0} mesaj
                                            </p>

                                            {/* Hover Action Buttons */}
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {onArchiveChat && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onArchiveChat(chat.id)
                                                        }}
                                                        className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                                        title="Arşivle"
                                                    >
                                                        <Archive className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onDeleteChat(chat.id)
                                                    }}
                                                    className="p-1.5 hover:bg-red-500/20 rounded-md text-muted-foreground hover:text-red-400 transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}

                            {activeChats.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    Henüz sohbet yok
                                </div>
                            )}

                            {/* Archived Chats Section */}
                            {archivedChats.length > 0 && (
                                <div className="mt-4 border-t border-border/50 pt-3">
                                    <button
                                        onClick={() => setShowArchived(!showArchived)}
                                        className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <Archive className="w-3 h-3" />
                                            Arşivlenenler ({archivedChats.length})
                                        </span>
                                        <ChevronDown className={cn("w-3 h-3 transition-transform", showArchived && "rotate-180")} />
                                    </button>

                                    {showArchived && (
                                        <div className="mt-2 space-y-0.5">
                                            {archivedChats.map(chat => (
                                                <div
                                                    key={chat.id}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 rounded-lg transition-colors group relative cursor-pointer opacity-60 hover:opacity-100",
                                                        chat.id === currentChatId
                                                            ? "bg-primary/10 text-foreground"
                                                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                                    )}
                                                    onClick={() => onSelectChat(chat.id)}
                                                >
                                                    <p className="text-sm font-medium truncate pr-16">
                                                        {chat.title || 'Yeni Sohbet'}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                                                        {chat.messages?.length || 0} mesaj
                                                    </p>

                                                    {/* Hover Action Buttons for Archived */}
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {onRestoreChat && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    onRestoreChat(chat.id)
                                                                }}
                                                                className="p-1.5 hover:bg-accent/20 rounded-md text-muted-foreground hover:text-accent transition-colors"
                                                                title="Geri Yükle"
                                                            >
                                                                <ArchiveRestore className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                onDeleteChat(chat.id)
                                                            }}
                                                            className="p-1.5 hover:bg-red-500/20 rounded-md text-muted-foreground hover:text-red-400 transition-colors"
                                                            title="Kalıcı Olarak Sil"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Model Selector */}
                        <div className="p-3 border-t border-border/50 space-y-2">
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                Aktif Model
                            </p>
                            <Select value={selectedModel} onValueChange={onSelectModel}>
                                <SelectTrigger className="w-full bg-white/5 hover:bg-white/10 border-white/10 rounded-lg h-11 text-sm transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                        <SelectValue placeholder="Model Seç" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="bg-popover/95 backdrop-blur-xl border-border/50 max-h-80">
                                    {/* GitHub Copilot Models */}
                                    <SelectGroup>
                                        <SelectLabel className="text-sm font-bold uppercase tracking-wider text-purple-400/80 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                                            GitHub Copilot
                                        </SelectLabel>
                                        <SelectItem value="gpt-4o" className="text-sm">
                                            <div className="flex items-center justify-between w-full">
                                                <span>GPT-4o</span>
                                                <span className="text-xs text-muted-foreground ml-2">En akıllı</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="gpt-4o-mini" className="text-sm">
                                            <div className="flex items-center justify-between w-full">
                                                <span>GPT-4o Mini</span>
                                                <span className="text-xs text-muted-foreground ml-2">Hızlı</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="gpt-4" className="text-sm">GPT-4</SelectItem>
                                        <SelectItem value="o1-preview" className="text-sm">
                                            <div className="flex items-center justify-between w-full">
                                                <span>o1-preview</span>
                                                <span className="text-xs text-orange-400 ml-2">Reasoning</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="o1-mini" className="text-sm">o1-mini</SelectItem>
                                        <SelectItem value="claude-3.5-sonnet" className="text-sm">Claude 3.5 Sonnet</SelectItem>
                                    </SelectGroup>

                                    {/* Proxy Models - grouped by provider */}
                                    {(() => {
                                        const copilotModelIds = ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'o1-preview', 'o1-mini', 'claude-3.5-sonnet']
                                        const filteredProxyModels = proxyModels.filter((m: any) => !copilotModelIds.includes(m.id))

                                        // Group by owned_by
                                        const grouped: Record<string, any[]> = {}
                                        filteredProxyModels.forEach((m: any) => {
                                            const provider = m.owned_by || 'other'
                                            if (!grouped[provider]) grouped[provider] = []
                                            grouped[provider].push(m)
                                        })

                                        // Provider colors and labels
                                        const providerConfig: Record<string, { color: string, label: string }> = {
                                            'openai': { color: 'bg-emerald-500', label: '🟢 OpenAI' },
                                            'google': { color: 'bg-blue-500', label: '🔵 Google Gemini' },
                                            'anthropic': { color: 'bg-orange-500', label: '🟠 Anthropic' },
                                            'antigravity': { color: 'bg-purple-500', label: '🟣 Antigravity' },
                                            'other': { color: 'bg-gray-500', label: '⚪ Diğer' }
                                        }

                                        return Object.entries(grouped).map(([provider, models]) => {
                                            const config = providerConfig[provider] || providerConfig['other']
                                            return (
                                                <SelectGroup key={provider}>
                                                    <SelectLabel className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                                                        <span className={`w-2 h-2 rounded-full ${config.color}`} />
                                                        {config.label}
                                                    </SelectLabel>
                                                    {models.map((model: any) => (
                                                        <SelectItem key={model.id} value={model.id} className="text-sm">
                                                            <div className="flex items-center justify-between w-full">
                                                                <span>{model.id}</span>
                                                                {model.name && model.name !== model.id && (
                                                                    <span className="text-xs text-muted-foreground ml-2 truncate max-w-[100px]">
                                                                        {model.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            )
                                        })
                                    })()}

                                    {/* Local Ollama Models */}
                                    {models.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel className="text-sm font-bold uppercase tracking-wider text-green-400/80 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                                Yerel (Ollama)
                                            </SelectLabel>
                                            {models.map((model: any) => (
                                                <SelectItem
                                                    key={model.name}
                                                    value={model.name}
                                                    className="text-sm"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>{model.name}</span>
                                                        {model.details && (
                                                            <span className="text-sm text-muted-foreground">
                                                                {Math.round((model.size || 0) / 1024 / 1024 / 1024)}GB
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-12 border-b border-border/50 flex items-center justify-between px-4 bg-card/20 relative z-20">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="btn-ghost p-2"
                        >
                            <ChevronLeft className={cn("w-4 h-4 transition-transform", !showSidebar && "rotate-180")} />
                        </button>
                        <span className="text-sm font-medium truncate">
                            {currentChat?.title || 'Yeni Sohbet'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className={cn("btn-ghost p-2", showExportMenu && "bg-primary/20 text-primary")}
                                title="Dışa Aktar"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            {showExportMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border/50 rounded-lg shadow-xl overflow-hidden py-1">
                                    <button onClick={handleExportJson} className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2">
                                        Json Olarak İndir
                                    </button>
                                    <button onClick={handleExportMarkdown} className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2">
                                        Markdown Olarak İndir
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setShowHyperparams(!showHyperparams)}
                            className={cn("btn-ghost p-2", showHyperparams && "bg-primary/20 text-primary")}
                        >
                            <Settings2 className="w-4 h-4" />
                        </button>
                    </div>
                </header>


                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <MessageSquare className="w-12 h-12 text-muted-foreground/20 mb-4" />
                            <h2 className="text-lg font-medium mb-2">Merhaba!</h2>
                            <p className="text-muted-foreground text-sm max-w-md">
                                Bir soru sorun veya görev verin. Size yardımcı olmak için buradayım.
                            </p>
                        </div>
                    )}

                    {messages.map((message, index) => (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            isLast={index === messages.length - 1}
                            language="tr"
                        />
                    ))}

                    {/* Streaming message */}
                    {isLoading && streamingContent && (
                        <MessageBubble
                            message={{
                                id: 'streaming',
                                role: 'assistant',
                                content: streamingContent,
                                timestamp: new Date()
                            }}
                            isLast={true}
                            language="tr"
                        />
                    )}

                    {/* Loading indicator */}
                    {isLoading && !streamingContent && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span>Düşünüyor...</span>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Hyperparameters Panel */}
                {showHyperparams && (
                    <div className="px-4 pb-2">
                        <HyperparameterPanel
                            temperature={hyperparams.temperature}
                            topP={hyperparams.topP}
                            topK={hyperparams.topK}
                            repeatPenalty={hyperparams.repeatPenalty}
                            onTemperatureChange={(v) => onHyperparamsChange({ ...hyperparams, temperature: v })}
                            onTopPChange={(v) => onHyperparamsChange({ ...hyperparams, topP: v })}
                            onTopKChange={(v) => onHyperparamsChange({ ...hyperparams, topK: v })}
                            onRepeatPenaltyChange={(v) => onHyperparamsChange({ ...hyperparams, repeatPenalty: v })}
                        />
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 bg-gradient-to-t from-background via-background/95 to-transparent">
                    <div className="max-w-4xl mx-auto">
                        <div className="relative flex items-end gap-3 p-2 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg shadow-black/10">
                            {/* Attachment Button */}
                            <button
                                className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-xl transition-all duration-200"
                                title="Dosya Ekle"
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>

                            {/* Text Input */}
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Mesajınızı yazın..."
                                rows={1}
                                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/60 py-2.5 min-h-[40px] max-h-32"
                                style={{ height: 'auto' }}
                            />

                            {/* Send Button */}
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className={cn(
                                    "p-2.5 rounded-xl transition-all duration-200",
                                    input.trim() && !isLoading
                                        ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105"
                                        : "bg-white/5 text-muted-foreground/40 cursor-not-allowed"
                                )}
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Hint Text */}
                        <p className="text-sm text-muted-foreground/40 text-center mt-2">
                            Enter ile gönder • Shift+Enter ile yeni satır
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
