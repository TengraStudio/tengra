import React, { useState } from 'react'
import { History, Pin } from 'lucide-react'
import { SidebarDivider } from '../sidebar-components'
import { Chat, Folder } from '@/types'
import { ChatSearch } from './ChatSearch'
import { ChatListItem } from './ChatListItem'
import { FolderItem } from './FolderItem'
import { AppView } from '@/hooks/useAppState'

interface ChatHistorySectionProps {
    isCollapsed: boolean;
    chats: Chat[];
    folders: Folder[];
    currentChatId: string | null;
    setCurrentChatId: (id: string | null) => void;
    createNewChat: () => void;
    deleteChat: (id: string) => void;
    updateChat: (id: string, updates: Partial<Chat>) => void;
    createFolder: (name: string) => void;
    updateFolder: (id: string, updates: Partial<Folder>) => void;
    deleteFolder: (id: string) => void;
    moveChatToFolder: (chatId: string, folderId: string | null) => void;
    togglePin: (id: string, isPinned: boolean) => void;
    isLoading: boolean;
    language: string;
    onChangeView: (view: AppView) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    localGeneratingMap: Record<string, boolean>;
    t: (key: string) => string;
}

export const ChatHistorySectionComponent: React.FC<ChatHistorySectionProps> = ({
    isCollapsed, chats, folders, currentChatId, setCurrentChatId,
    deleteChat, createFolder, updateFolder, deleteFolder, moveChatToFolder,
    togglePin, isLoading, onChangeView, searchQuery, setSearchQuery,
    localGeneratingMap, t
}) => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')

    if (isCollapsed) {
        return null
    }

    const toggleFolder = (folderId: string) => {
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId)
        } else {
            newExpanded.add(folderId)
        }
        setExpandedFolders(newExpanded)
    }

    const handleCreateFolder = () => {
        if (newFolderName.trim()) {
            createFolder(newFolderName.trim())
            setNewFolderName('')
            setIsCreatingFolder(false)
        }
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2">
                <div className="flex items-center gap-2 mb-2 px-1">
                    <History className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{t('sidebar.history')}</span>
                    {chats.length > 0 && <span className="ml-auto text-[10px] text-muted-foreground/40">{chats.length}</span>}
                </div>
                <ChatSearch
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    setIsCreatingFolder={setIsCreatingFolder}
                    t={t}
                />
            </div>

            {isCreatingFolder && (
                <div className="px-4 mb-2">
                    <input
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { handleCreateFolder() }
                            if (e.key === 'Escape') { setIsCreatingFolder(false) }
                        }}
                        className="w-full bg-muted/20 border border-primary/30 text-xs rounded-md px-2 py-1 outline-none"
                        placeholder="Folder Name..."
                    />
                </div>
            )}

            <ChatListContent
                chats={chats}
                folders={folders}
                isLoading={isLoading}
                currentChatId={currentChatId}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                updateFolder={updateFolder}
                deleteFolder={deleteFolder}
                moveChatToFolder={moveChatToFolder}
                onChangeView={onChangeView}
                setCurrentChatId={setCurrentChatId}
                deleteChat={deleteChat}
                togglePin={togglePin}
                localGeneratingMap={localGeneratingMap}
                t={t}
            />
        </div>
    )
}

const groupChatsByDate = (chatsToGroup: Chat[], t: (key: string) => string) => {
    const groups: Record<string, Chat[]> = {
        [t('dateGroups.today')]: [],
        [t('dateGroups.yesterday')]: [],
        [t('dateGroups.lastWeek')]: [],
        [t('dateGroups.older')]: []
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterday = today - 86400000

    chatsToGroup.forEach(chat => {
        const date = new Date(chat.createdAt).getTime()
        if (date >= today) {
            groups[t('dateGroups.today')].push(chat)
        } else if (date >= yesterday) {
            groups[t('dateGroups.yesterday')].push(chat)
        } else if (date >= today - 7 * 86400000) {
            groups[t('dateGroups.lastWeek')].push(chat)
        } else {
            groups[t('dateGroups.older')].push(chat)
        }
    })

    return groups
}

const ChatListContent: React.FC<{
    chats: Chat[], folders: Folder[], isLoading: boolean, currentChatId: string | null,
    expandedFolders: Set<string>, toggleFolder: (id: string) => void,
    updateFolder: (id: string, updates: Partial<Folder>) => void, deleteFolder: (id: string) => void,
    moveChatToFolder: (id: string, folderId: string | null) => void,
    onChangeView: (view: AppView) => void, setCurrentChatId: (id: string | null) => void,
    deleteChat: (id: string) => void, togglePin: (id: string, pinned: boolean) => void,
    localGeneratingMap: Record<string, boolean>, t: (key: string) => string
}> = ({
    chats, folders, isLoading, currentChatId, expandedFolders, toggleFolder,
    updateFolder, deleteFolder, moveChatToFolder, onChangeView, setCurrentChatId,
    deleteChat, togglePin, localGeneratingMap, t
}) => {
        const isChatGenerating = (chat: Chat) => localGeneratingMap[chat.id] ?? chat.isGenerating
        const pinnedChats = chats.filter(c => c.isPinned)
        const unfolderedChats = chats.filter(c => !c.folderId && !c.isPinned)
        const dateGroups = groupChatsByDate(unfolderedChats, t)

        return (
            <div className="flex-1 overflow-y-auto px-3 space-y-4 custom-scrollbar py-2">
                {isLoading ? (
                    <div className="space-y-4 pt-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-10 rounded-md bg-muted/20 w-full animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        {pinnedChats.length > 0 && (
                            <div className="mb-4 space-y-1">
                                <div className="px-2 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest flex items-center gap-2">
                                    <Pin className="w-3 h-3" />
                                    <span>{t('sidebar.pinned')}</span>
                                </div>
                                {pinnedChats.map(chat => (
                                    <ChatListItem
                                        key={chat.id}
                                        chat={chat}
                                        currentChatId={currentChatId}
                                        isGenerating={isChatGenerating(chat)}
                                        onSelect={(id) => { onChangeView('chat'); setCurrentChatId(id); }}
                                        onDelete={deleteChat}
                                        onTogglePin={togglePin}
                                        t={t}
                                    />
                                ))}
                                <SidebarDivider spacing="sm" />
                            </div>
                        )}

                        {folders.map(folder => (
                            <FolderItem
                                key={folder.id}
                                folder={folder}
                                chats={chats.filter(c => c.folderId === folder.id)}
                                expanded={expandedFolders.has(folder.id)}
                                onToggle={() => toggleFolder(folder.id)}
                                onRename={(id, name) => updateFolder(id, { name })}
                                onDelete={deleteFolder}
                                onMoveChat={moveChatToFolder}
                                currentChatId={currentChatId}
                                onSelectChat={(id) => { onChangeView('chat'); setCurrentChatId(id); }}
                                onDeleteChat={deleteChat}
                                onTogglePinChat={togglePin}
                                isGenerating={isChatGenerating}
                                t={t}
                            />
                        ))}

                        {Object.entries(dateGroups).map(([category, categoryChats]) => (
                            categoryChats.length > 0 && (
                                <div key={category} className="space-y-1 mt-2">
                                    <div className="px-2 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest flex items-center justify-between">
                                        <span>{category}</span>
                                        <span className="text-muted-foreground/20">{categoryChats.length}</span>
                                    </div>
                                    {categoryChats.map(chat => (
                                        <ChatListItem
                                            key={chat.id}
                                            chat={chat}
                                            currentChatId={currentChatId}
                                            isGenerating={isChatGenerating(chat)}
                                            onSelect={(id) => { onChangeView('chat'); setCurrentChatId(id); }}
                                            onDelete={deleteChat}
                                            onTogglePin={togglePin}
                                            onMoveToFolder={moveChatToFolder}
                                            folders={folders}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            )
                        ))}
                    </>
                )}
            </div>
        )
    }
