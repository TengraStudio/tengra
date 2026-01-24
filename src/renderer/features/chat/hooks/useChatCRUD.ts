import { generateId } from '@/lib/utils'
import { Chat, Message } from '@/types'
import { CommonBatches } from '@renderer/utils/ipc-batch.util'

interface UseChatCRUDProps {
    currentChatId: string | null
    setCurrentChatId: (id: string | null) => void
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
    setInput: (input: string) => void
    baseDeleteFolder: (id: string, callback?: (deletedId: string) => void) => void | Promise<void>
}

export const useChatCRUD = (props: UseChatCRUDProps) => {
    const { currentChatId, setCurrentChatId, setChats, setInput, baseDeleteFolder } = props

    const createNewChat = () => {
        setCurrentChatId(null)
        setInput('')
    }

    const deleteChat = async (id: string) => {
        try {
            await window.electron.db.deleteChat(id)
            setChats(prev => prev.filter(c => c.id !== id))
            if (currentChatId === id) { createNewChat() }
        } catch (error) {
            console.error('Failed to delete chat:', error)
        }
    }

    const clearMessages = async () => {
        if (!currentChatId) { return }
        try {
            await window.electron.db.deleteMessages(currentChatId)
            setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: [] } : c))
        } catch (error) {
            console.error('Failed to clear messages:', error)
        }
    }

    const deleteFolder = (id: string) => {
        void baseDeleteFolder(id, (deletedId) => {
            setChats(prev => prev.map(c => c.folderId === deletedId ? { ...c, folderId: undefined } : c))
        })
    }

    const moveChatToFolder = async (chatId: string, folderId: string | null) => {
        try {
            await window.electron.db.updateChat(chatId, { folderId })
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, folderId: folderId ?? undefined } : c))
        } catch (error) {
            console.error('Failed to move chat to folder:', error)
        }
    }

    const addMessage = async (chatId: string, role: string, content: string) => {
        try {
            const messageObj = { role, content, timestamp: Date.now() }
            await window.electron.db.addMessage({ ...messageObj, chatId })
            const uiMessage: Message = { ...messageObj, id: generateId(), timestamp: new Date(messageObj.timestamp), role: role as 'user' | 'assistant' | 'system' }
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, uiMessage] } : c))
        } catch (error) {
            console.error('Failed to add message:', error)
        }
    }

    const updateChat = async (id: string, updates: Partial<Chat>) => {
        try {
            await window.electron.db.updateChat(id, updates)
            setChats(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
        } catch (error) {
            console.error('Failed to update chat:', error)
        }
    }

    const togglePin = async (id: string, isPinned: boolean) => {
        await updateChat(id, { isPinned })
    }

    const toggleFavorite = async (id: string, isFavorite: boolean) => {
        await updateChat(id, { isFavorite })
    }

    // Batch operations for efficiency
    const bulkUpdateChats = async (updates: Array<{ id: string; updates: Partial<Chat> }>) => {
        try {
            await CommonBatches.updateChatsBatch(updates)
            setChats(prev => prev.map(c => {
                const update = updates.find(u => u.id === c.id)
                return update ? { ...c, ...update.updates } : c
            }))
        } catch (error) {
            console.error('Failed to bulk update chats:', error)
        }
    }

    const bulkDeleteChats = async (chatIds: string[]) => {
        try {
            await CommonBatches.deleteChatsBatch(chatIds)
            setChats(prev => prev.filter(c => !chatIds.includes(c.id)))
            if (currentChatId && chatIds.includes(currentChatId)) {
                createNewChat()
            }
        } catch (error) {
            console.error('Failed to bulk delete chats:', error)
        }
    }

    return {
        createNewChat,
        deleteChat,
        clearMessages,
        deleteFolder,
        moveChatToFolder,
        addMessage,
        updateChat,
        togglePin,
        toggleFavorite,
        bulkUpdateChats,
        bulkDeleteChats
    }
}
