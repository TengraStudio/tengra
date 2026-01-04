import { useState, useEffect } from 'react'
import { AppLayout, PageId } from './components/layout/AppLayout'
import { ChatPage } from './pages/ChatPage'
import { ModelHubPage } from './pages/ModelHubPage'
import { MCPPage } from './pages/MCPPage'
import { SettingsModal } from './components/SettingsModal'
import { CommandPalette } from './components/CommandPalette'
import { Chat, OllamaModel, Message, Attachment } from './types'

function generateId(): string {
    return Math.random().toString(36).substring(2, 15)
}

export function AppRoot() {
    const [currentPage, setCurrentPage] = useState<PageId>('chat')
    const [chats, setChats] = useState<Chat[]>([])
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [models, setModels] = useState<OllamaModel[]>([])
    const [selectedModel, setSelectedModel] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [showSettings, setShowSettings] = useState(false)
    const [showCommandPalette, setShowCommandPalette] = useState(false)
    const [hyperparams, setHyperparams] = useState({
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        repeatPenalty: 1.1
    })

    // Load initial data
    useEffect(() => {
        loadModels()
        loadChats()
    }, [])

    // Keyboard shortcut for Command Palette
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setShowCommandPalette(prev => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const loadModels = async () => {
        try {
            const result = await window.electron.getModels()
            const modelList = Array.isArray(result) ? result : (result as any)?.models || []
            setModels(modelList)
            if (modelList.length > 0 && !selectedModel) {
                setSelectedModel(modelList[0].name)
            }
        } catch (error) {
            console.error('Failed to load models:', error)
        }
    }

    const loadChats = async () => {
        try {
            const result = await window.electron.db.getAllChats()
            if (result) {
                setChats(result)
            }
        } catch (error) {
            console.error('Failed to load chats:', error)
        }
    }

    const createNewChat = async () => {
        const newChat: Chat = {
            id: generateId(),
            title: 'Yeni Sohbet',
            messages: [],
            createdAt: new Date(),
            model: selectedModel
        }
        setChats(prev => [newChat, ...prev])
        setCurrentChatId(newChat.id)

        try {
            await window.electron.db.createChat(newChat)
        } catch (error) {
            console.error('Failed to create chat:', error)
        }
    }

    const handleSendMessage = async (content: string, _attachments?: Attachment[]) => {
        if (!content.trim()) return

        // Auto-create chat if none exists
        let chatId = currentChatId
        if (!chatId) {
            const newChat: Chat = {
                id: generateId(),
                title: 'Yeni Sohbet',
                messages: [],
                createdAt: new Date(),
                model: selectedModel
            }
            setChats(prev => [newChat, ...prev])
            setCurrentChatId(newChat.id)
            chatId = newChat.id

            try {
                await window.electron.db.createChat(newChat)
            } catch (error) {
                console.error('Failed to create chat:', error)
            }
        }

        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date()
        }

        setChats(prev => prev.map(chat =>
            chat.id === chatId
                ? { ...chat, messages: [...chat.messages, userMessage] }
                : chat
        ))

        setIsLoading(true)
        setStreamingContent('')

        try {
            const currentChat = chats.find(c => c.id === chatId)
            const messages = currentChat ? [...currentChat.messages, userMessage] : [userMessage]

            const systemMessage = {
                role: 'system' as const,
                content: 'You are a helpful AI assistant. Be concise and helpful.'
            }

            let fullContent = ''
            const streamListener = (chunk: string) => {
                fullContent += chunk
                setStreamingContent(fullContent)
            }
            window.electron.onStreamChunk(streamListener)

            const response = await window.electron.chatStream(
                [systemMessage, ...messages.map(m => ({ role: m.role, content: m.content }))],
                selectedModel,
                []
            )

            window.electron.removeStreamChunkListener(streamListener)

            const assistantMessage: Message = {
                id: generateId(),
                role: 'assistant',
                content: response.content || fullContent || '',
                timestamp: new Date()
            }

            setChats(prev => prev.map(chat => {
                if (chat.id === chatId) {
                    let newTitle = chat.title
                    if (chat.messages.length <= 1 && assistantMessage.content) {
                        const firstLine = assistantMessage.content.split('\n')[0].replace(/[#*`]/g, '').trim()
                        newTitle = firstLine.slice(0, 50) || 'Yeni Sohbet'
                    }
                    return { ...chat, title: newTitle, messages: [...chat.messages, assistantMessage] }
                }
                return chat
            }))

        } catch (error) {
            console.error('Chat error:', error)
        } finally {
            setIsLoading(false)
            setStreamingContent('')
        }
    }

    const deleteChat = async (chatId: string) => {
        setChats(prev => prev.filter(c => c.id !== chatId))
        if (currentChatId === chatId) {
            setCurrentChatId(null)
        }
        try {
            await window.electron.db.deleteChat(chatId)
        } catch (error) {
            console.error('Failed to delete chat:', error)
        }
    }

    const archiveChat = async (chatId: string) => {
        // Update local state - remove from visible list
        setChats(prev => prev.filter(c => c.id !== chatId))
        if (currentChatId === chatId) {
            setCurrentChatId(null)
        }
        try {
            await window.electron.db.updateChat(chatId, { isArchived: true })
        } catch (error) {
            console.error('Failed to archive chat:', error)
        }
    }

    const restoreChat = async (chatId: string) => {
        // Update local state - mark as not archived
        setChats(prev => prev.map(c =>
            c.id === chatId ? { ...c, isArchived: false } : c
        ))
        try {
            await window.electron.db.updateChat(chatId, { isArchived: false })
        } catch (error) {
            console.error('Failed to restore chat:', error)
        }
    }

    // Navigate to settings instead of page
    const handleNavigate = (page: PageId) => {
        if (page === 'settings') {
            setShowSettings(true)
        } else {
            setCurrentPage(page)
        }
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'chat':
                return (
                    <ChatPage
                        chats={chats}
                        currentChatId={currentChatId}
                        models={models}
                        selectedModel={selectedModel}
                        isLoading={isLoading}
                        streamingContent={streamingContent}
                        onSelectChat={setCurrentChatId}
                        onNewChat={createNewChat}
                        onDeleteChat={deleteChat}
                        onArchiveChat={archiveChat}
                        onRestoreChat={restoreChat}
                        onSelectModel={setSelectedModel}
                        onSendMessage={handleSendMessage}
                        hyperparams={hyperparams}
                        onHyperparamsChange={setHyperparams}
                        language="tr" // Default language for now
                    />
                )
            case 'models':
                return (
                    <ModelHubPage
                        installedModels={models}
                        onRefreshModels={loadModels}
                        onSelectModel={setSelectedModel}
                        selectedModel={selectedModel}
                    />
                )
            case 'mcp':
                return <MCPPage />
            default:
                return null
        }
    }

    return (
        <>
            <AppLayout
                currentPage={currentPage}
                onNavigate={handleNavigate}
                modelName={selectedModel}
            >
                {renderPage()}
            </AppLayout>

            {/* Settings Modal */}
            {showSettings && (
                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    installedModels={models}
                    onRefreshModels={loadModels}
                />
            )}

            {/* Command Palette */}
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                onNewChat={createNewChat}
                onOpenSettings={() => setShowSettings(true)}
                onOpenSSHManager={() => { }}
                onRefreshModels={loadModels}
                models={models}
                onSelectModel={setSelectedModel}
                selectedModel={selectedModel}
            />
        </>
    )
}

export default AppRoot
