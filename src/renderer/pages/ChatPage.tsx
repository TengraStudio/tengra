import { useState, useRef, useEffect, useMemo } from 'react'
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
    MessageSquare
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
    onDeleteChat: _onDeleteChat,
    onSelectModel,
    onSendMessage,
    hyperparams,
    onHyperparamsChange
}: ChatPageProps) {
    const [input, setInput] = useState('')
    const [showSidebar, setShowSidebar] = useState(true)
    const [showHyperparams, setShowHyperparams] = useState(false)
    const [proxyModels, setProxyModels] = useState<any[]>([])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        const loadProxyModels = async () => {
            try {
                // @ts-ignore
                if (window.electron.getProxyModels) {
                    // @ts-ignore
                    const pModels = await window.electron.getProxyModels()
                    console.log('Loaded proxy models:', pModels)
                    setProxyModels(pModels || [])
                }
            } catch (error) {
                console.error('Failed to load proxy models:', error)
            }
        }
        loadProxyModels()
    }, [])

    // Memoize filtered model lists to avoid redundant filtering
    const categorizedModels = useMemo(() => ({
        copilot: proxyModels.filter((m: any) => m.category === 'copilot'),
        openai: proxyModels.filter((m: any) => m.category === 'openai'),
        anthropic: proxyModels.filter((m: any) => m.category === 'anthropic'),
        gemini: proxyModels.filter((m: any) => m.category === 'gemini'),
        proxy: proxyModels.filter((m: any) => m.category === 'proxy'),
    }), [proxyModels])

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

    // Group chats by date
    const groupedChats = chats.reduce((groups, chat) => {
        const date = new Date(chat.createdAt).toLocaleDateString('tr-TR', {
            month: 'short',
            day: 'numeric'
        })
        if (!groups[date]) groups[date] = []
        groups[date].push(chat)
        return groups
    }, {} as Record<string, Chat[]>)

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
                                    <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                        {date}
                                    </p>
                                    {dateChats.map(chat => (
                                        <button
                                            key={chat.id}
                                            onClick={() => onSelectChat(chat.id)}
                                            className={cn(
                                                "w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors group",
                                                chat.id === currentChatId
                                                    ? "bg-primary/10 text-foreground"
                                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                            )}
                                        >
                                            <p className="text-sm font-medium truncate">
                                                {chat.title || 'Yeni Sohbet'}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                {chat.messages?.length || 0} mesaj
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            ))}

                            {chats.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    Henüz sohbet yok
                                </div>
                            )}
                        </div>

                        {/* Model Selector */}
                        <div className="p-3 border-t border-border/50">
                            <div className="relative">
                                <Select value={selectedModel} onValueChange={onSelectModel}>
                                    <SelectTrigger className="w-full input-field text-xs appearance-none">
                                        <SelectValue placeholder="Model Seç" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* Ollama Models */}
                                        {models.length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>🦙 Ollama (Yerel)</SelectLabel>
                                                {models.map((model: any) => (
                                                    <SelectItem key={model.name} value={model.name}>
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}

                                        {/* GitHub Copilot Models */}
                                        {categorizedModels.copilot.length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>🐙 GitHub Copilot</SelectLabel>
                                                {categorizedModels.copilot.map((model: any) => (
                                                    <SelectItem key={model.id} value={model.id}>
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}

                                        {/* OpenAI Models */}
                                        {categorizedModels.openai.length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>🤖 OpenAI</SelectLabel>
                                                {categorizedModels.openai.map((model: any) => (
                                                    <SelectItem key={model.id} value={model.id}>
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}

                                        {/* Anthropic Models */}
                                        {categorizedModels.anthropic.length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>🧠 Anthropic (Claude)</SelectLabel>
                                                {categorizedModels.anthropic.map((model: any) => (
                                                    <SelectItem key={model.id} value={model.id}>
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}

                                        {/* Google Gemini Models */}
                                        {categorizedModels.gemini.length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>💎 Google (Gemini)</SelectLabel>
                                                {categorizedModels.gemini.map((model: any) => (
                                                    <SelectItem key={model.id} value={model.id}>
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}

                                        {/* Proxy Models */}
                                        {categorizedModels.proxy.length > 0 && (
                                            <SelectGroup>
                                                <SelectLabel>🌐 Proxy (Harici)</SelectLabel>
                                                {categorizedModels.proxy.map((model: any) => (
                                                    <SelectItem key={`proxy-${model.id}`} value={model.id}>
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        )}

                                        {/* Fallback when no models configured */}
                                        {models.length === 0 && proxyModels.length === 0 && (
                                            <SelectGroup>
                                                <SelectLabel>⚠️ Model Bulunamadı</SelectLabel>
                                                <SelectItem value="" disabled>
                                                    Ayarlar'dan yapılandırın
                                                </SelectItem>
                                            </SelectGroup>
                                        )}
                                    </SelectContent>
                                </Select>
                                <Settings2 className="w-3 h-3 text-muted-foreground absolute right-3 top-3 pointer-events-none" />
                            </div>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-12 border-b border-border/50 flex items-center justify-between px-4 bg-card/20">
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
                    <button
                        onClick={() => setShowHyperparams(!showHyperparams)}
                        className={cn("btn-ghost p-2", showHyperparams && "bg-primary/20 text-primary")}
                    >
                        <Settings2 className="w-4 h-4" />
                    </button>
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
                <div className="p-4 border-t border-border/50">
                    <div className="flex items-end gap-2 max-w-4xl mx-auto">
                        <div className="flex-1 relative">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Mesajınızı yazın..."
                                rows={1}
                                className="input-field w-full resize-none pr-12 min-h-[48px] max-h-32"
                                style={{ height: 'auto' }}
                            />
                            <button
                                className="absolute right-2 bottom-2 p-2 text-muted-foreground hover:text-foreground"
                            >
                                <Paperclip className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className={cn(
                                "btn-primary p-3 rounded-lg",
                                (!input.trim() || isLoading) && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
