import { Chat, Folder, IpcValue } from '@/types'
import { PromptManagerModal } from '@/features/prompts/components/PromptManagerModal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import './Sidebar.css'
import {
    Plus, Settings, ChevronLeft, ChevronRight,
    Trash2, Search, MessageSquare, Rocket, ChevronDown,
    LayoutGrid, Mic, Terminal, Database, Image, UserCircle, History, Info, Activity, Cpu,
    FolderPlus, FolderOpen, Folder as FolderIcon, Edit2, CornerUpRight, Book, Pin, TrendingUp
} from 'lucide-react'
import { useState, useEffect, useRef, ChangeEvent, type ComponentType } from 'react'
import { useTranslation } from '@/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '@/context/ChatContext'
import { useAuth } from '@/context/AuthContext'
import { useProject } from '@/context/ProjectContext'
import { SettingsCategory } from '@/features/settings/types'

interface SidebarProps {
    isCollapsed: boolean
    toggleSidebar: () => void
    currentView: 'chat' | 'projects' | 'settings' | 'mcp' | 'council'
    onChangeView: (view: 'chat' | 'projects' | 'settings' | 'mcp' | 'council') => void
    onOpenSettings: (category?: SettingsCategory) => void
    onSearch: (query: string) => void
}

const SettingsMenuItem = ({
    icon: Icon,
    label,
    isActive,
    onClick
}: {
    id: string,
    icon: ComponentType<{ className?: string }>,
    label: string,
    isActive: boolean,
    onClick: () => void
}) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200",
            isActive
                ? "text-primary bg-primary/5"
                : "text-muted-foreground hover:bg-muted/10 hover:text-foreground"
        )}
    >
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <span>{label}</span>
    </button>
)

export function Sidebar({
    onOpenSettings,
    isCollapsed,
    toggleSidebar,
    currentView,
    onChangeView,
    onSearch
}: SidebarProps) {
    // Context Consumption
    const {
        chats, currentChatId, setCurrentChatId, createNewChat, deleteChat, updateChat,
        folders, createFolder, updateFolder, deleteFolder, moveChatToFolder,
        prompts, createPrompt, updatePrompt, deletePrompt,
        isLoading, togglePin
    } = useChat()

    const { language, settingsCategory, setSettingsCategory } = useAuth()
    const { selectedProject } = useProject()

    const { t } = useTranslation(language || 'en')

    // Internal State
    const [editingChatId, setEditingChatId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const editInputRef = useRef<HTMLInputElement>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
    const [editFolderName, setEditFolderName] = useState('')
    const [showPrompts, setShowPrompts] = useState(false)

    // Ensure folders are available
    const activeFolders = folders || []
    const sortedFolders = [...activeFolders].sort((a, b) => a.name.localeCompare(b.name))

    useEffect(() => {
        if (activeFolders.length > 0 && expandedFolders.size === 0) {
            if (currentChatId && chats) {
                const chat = chats.find(c => c.id === currentChatId)
                if (chat?.folderId) {
                    setTimeout(() => {
                        setExpandedFolders(prev => new Set(prev).add(chat.folderId!))
                    }, 0)
                }
            }
        }
    }, [activeFolders.length, currentChatId, chats])

    const toggleFolder = (folderId: string) => {
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(folderId)) newExpanded.delete(folderId)
        else newExpanded.add(folderId)
        setExpandedFolders(newExpanded)
    }

    const handleCreateFolder = () => {
        if (newFolderName.trim()) {
            createFolder(newFolderName.trim())
            setNewFolderName('')
            setIsCreatingFolder(false)
        }
    }

    const handleRenameFolder = () => {
        if (editingFolderId && editFolderName.trim()) {
            updateFolder(editingFolderId, { name: editFolderName.trim() })
            setEditingFolderId(null)
        }
    }

    useEffect(() => {
        if (editingChatId && editInputRef.current) {
            editInputRef.current.focus()
            editInputRef.current.select()
        }
    }, [editingChatId])

    const handleSaveEdit = () => {
        if (editingChatId) {
            updateChat(editingChatId, { title: editTitle })
        }
        setEditingChatId(null)
    }

    const groupChatsByDate = (chatsToGroup: Chat[]) => {
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
            if (date >= today) groups[t('dateGroups.today')].push(chat)
            else if (date >= yesterday) groups[t('dateGroups.yesterday')].push(chat)
            else if (date >= today - 7 * 86400000) groups[t('dateGroups.lastWeek')].push(chat)
            else groups[t('dateGroups.older')].push(chat)
        })

        return groups
    }

    // Separate chats into Pinned, Foldered and Unfoldered
    const pinnedChats = chats.filter(c => c.isPinned)
    const unfolderedChats = chats.filter(c => !c.folderId && !c.isPinned)
    const dateGroups = groupChatsByDate(unfolderedChats)

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchQuery(value)
        onSearch(value)
    }

    // --- Background Generation Sync ---
    const [localGeneratingMap, setLocalGeneratingMap] = useState<Record<string, boolean>>({})

    useEffect(() => {
        const removeStatusListener = window.electron.on('chat:generation-status', (_event, ...args: IpcValue[]) => {
            const payload = args[0]
            const data = payload && typeof payload === 'object' ? payload as { chatId?: string; isGenerating?: boolean } : {}
            if (!data.chatId) return
            setLocalGeneratingMap(prev => ({ ...prev, [data.chatId as string]: !!data.isGenerating }))
        })
        return () => { removeStatusListener() }
    }, [])

    const isChatGenerating = (chat: Chat) => localGeneratingMap[chat.id] ?? chat.isGenerating

    return (
        <>
            <aside
                className={cn(
                    "flex flex-col h-full z-30 relative overflow-hidden transition-all duration-300 border-r border-border/40 bg-background/60 backdrop-blur-2xl shadow-xl",
                    isCollapsed ? "w-[72px]" : "w-[280px]"
                )}
            >
                {/* Top Navigation Section */}
                <div className="flex flex-col gap-1 p-4 pb-2">
                    <Button
                        onClick={() => {
                            onChangeView('chat')
                            createNewChat()
                        }}
                        className={cn(
                            "justify-start gap-3 h-11 font-bold shadow-lg transition-all duration-300 mb-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground",
                            !isCollapsed && "px-4 w-full"
                        )}
                    >
                        <Plus className={cn("shrink-0", isCollapsed ? "w-6 h-6" : "w-5 h-5")} />
                        {!isCollapsed && <span>{t('sidebar.newChat')}</span>}
                    </Button>

                    <div className="space-y-1">
                        <Button
                            variant="ghost"
                            onClick={() => onChangeView('projects')}
                            className={cn(
                                "nav-item",
                                currentView === 'projects' && "nav-item-active"
                            )}
                        >
                            <Rocket className="w-4 h-4 shrink-0" />
                            {!isCollapsed && <span>{t('sidebar.projects')}</span>}
                        </Button>

                        {!isCollapsed && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPrompts(true)}
                                className={cn("nav-item", "w-full justify-start text-xs text-muted-foreground hover:text-foreground h-8 px-2", showPrompts && "nav-item-active")}
                            >
                                <Book className="w-4 h-4 mr-2 opacity-60" />
                                {!isCollapsed && <span>{t('sidebar.prompts')}</span>}
                            </Button>
                        )}

                        {/* Integrated Settings Menu */}
                        {isCollapsed ? (
                            <Button
                                variant="ghost"
                                onClick={() => onOpenSettings()}
                                className={cn(
                                    "nav-item",
                                    currentView === 'council' && "nav-item-active"
                                )}
                            >
                                <UserCircle className="w-4 h-4 shrink-0" />
                            </Button>
                        ) : (
                            <div className="flex flex-col">
                                <button
                                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full group",
                                        currentView === 'settings' ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
                                        <span>{t('sidebar.settings')}</span>
                                    </div>
                                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isSettingsOpen && "rotate-180")} />
                                </button>

                                <AnimatePresence>
                                    {isSettingsOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="ml-2 pl-2 border-l border-border/30 space-y-0.5">
                                                {['general', 'accounts', 'models', 'usage-limits', 'appearance', 'speech', 'advanced', 'developer', 'statistics', 'gallery', 'about'].map(id => (
                                                    <SettingsMenuItem
                                                        key={id}
                                                        id={id}
                                                        icon={id === 'models' ? Database : id === 'appearance' ? Image : id === 'speech' ? Mic : id === 'statistics' ? Activity : id === 'about' ? Info : id === 'developer' ? Terminal : id === 'advanced' ? Cpu : id === 'accounts' ? UserCircle : id === 'usage-limits' ? TrendingUp : LayoutGrid}
                                                        label={t(`settings.${id}`)}
                                                        isActive={currentView === 'settings' && settingsCategory === id}
                                                        onClick={() => { const category = id as SettingsCategory; onOpenSettings(category); if (setSettingsCategory) setSettingsCategory(category) }}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* Separator */}
                <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent mx-4 my-2" />

                {/* Chat List Section */}
                <div className="flex-1 flex flex-col min-h-0">
                    {!isCollapsed && (
                        <div className="px-4 py-2">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <History className="w-3.5 h-3.5 text-muted-foreground/60" />
                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{t('sidebar.history')}</span>
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder={t('sidebar.searchChats')}
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    className="w-full bg-muted/20 border border-border/40 focus:border-primary/50 focus:bg-muted/30 text-xs rounded-lg pl-8 pr-3 py-2 outline-none transition-all font-medium placeholder:text-muted-foreground/50"
                                />
                            </div>
                        </div>
                    )}

                    {/* New Folder Button */}
                    {!isCollapsed && (
                        <div className="px-4 pb-2">
                            <div className="flex gap-2 mb-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsCreatingFolder(true)}
                                    className="w-full h-7 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/40 justify-start px-2"
                                >
                                    <FolderPlus className="w-3.5 h-3.5 mr-2" />
                                    {t('sidebar.newFolder') || 'New Folder'}
                                </Button>
                            </div>

                            {/* Folder Creation Input */}
                            {isCreatingFolder && (
                                <div className="mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-md border border-primary/30">
                                        <input
                                            autoFocus
                                            value={newFolderName}
                                            onChange={(e) => setNewFolderName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleCreateFolder()
                                                if (e.key === 'Escape') setIsCreatingFolder(false)
                                            }}
                                            onBlur={() => { if (!newFolderName) setIsCreatingFolder(false) }}
                                            placeholder="Folder Name..."
                                            className="w-full bg-transparent text-xs outline-none px-1 py-0.5"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Chat Statistics Summary */}
                    {!isCollapsed && chats.length > 0 && (
                        <div className="px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground/60 border-b border-border/30 mb-2">
                            <span>{chats.length} {t('sidebar.chatCount')}</span>
                            <span>•</span>
                            <span>{chats.reduce((acc, c) => acc + (c.messages?.length || 0), 0)} {t('sidebar.messageCount')}</span>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto px-3 space-y-6 custom-scrollbar py-2">
                        {isLoading ? (
                            <div className="space-y-4 pt-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex flex-col gap-2 px-2 animate-pulse">
                                        {!isCollapsed && <div className="h-3 w-16 bg-muted/20 rounded" />}
                                        <div className={cn("h-10 rounded-md bg-muted/20 w-full", isCollapsed && "h-10 w-10 mx-auto")} />
                                        {!isCollapsed && <div className="h-10 rounded-md bg-muted/20 w-full" />}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {/* Pinned Chats Section */}
                                {pinnedChats.length > 0 && (
                                    <div className="mb-4 space-y-1">
                                        {!isCollapsed && (
                                            <div className="px-2 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest flex items-center gap-2">
                                                <Pin className="w-3 h-3" />
                                                <span>{t('sidebar.pinned') || 'Pinned'}</span>
                                            </div>
                                        )}
                                        {pinnedChats.map(chat => (
                                            <div key={chat.id} className="relative group">
                                                <button
                                                    onClick={() => {
                                                        onChangeView('chat')
                                                        setCurrentChatId(chat.id)
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 rounded-md transition-all duration-200",
                                                        isCollapsed ? "justify-center p-2.5" : "text-left px-3 py-2.5",
                                                        currentView === 'chat' && currentChatId === chat.id
                                                            ? "bg-gradient-to-r from-primary/10 to-transparent text-primary border-l-2 border-primary"
                                                            : "text-muted-foreground/80 hover:bg-muted/10 hover:text-foreground border-l-2 border-transparent"
                                                    )}
                                                >
                                                    <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                                                    {!isCollapsed && <span className="truncate text-xs flex-1 font-medium">{chat.title || t('sidebar.newChat')}</span>}
                                                </button>
                                                {/* Unpin Action */}
                                                {!isCollapsed && (
                                                    <div className="opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2">
                                                        <div onClick={(e) => { e.stopPropagation(); togglePin(chat.id, !chat.isPinned) }} className="p-1 hover:text-primary rounded-md cursor-pointer hover:bg-muted/10">
                                                            <Pin className="w-3 h-3 fill-current" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <div className="h-px bg-border/30 mx-2 my-2" />
                                    </div>
                                )}

                                {/* Folders Section */}
                                {!isCollapsed && sortedFolders.map((folder: Folder) => (
                                    <div key={folder.id} className="space-y-0.5">
                                        <div
                                            className={cn(
                                                "group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/10 cursor-pointer text-muted-foreground hover:text-foreground transition-colors",
                                                expandedFolders.has(folder.id) && "text-foreground"
                                            )}
                                            onClick={() => toggleFolder(folder.id)}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {expandedFolders.has(folder.id) ? (
                                                    <FolderOpen className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                                ) : (
                                                    <FolderIcon className="w-3.5 h-3.5 shrink-0" />
                                                )}

                                                {editingFolderId === folder.id ? (
                                                    <input
                                                        autoFocus
                                                        value={editFolderName}
                                                        onChange={e => setEditFolderName(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleRenameFolder()
                                                            if (e.key === 'Escape') setEditingFolderId(null)
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                        onBlur={handleRenameFolder}
                                                        className="bg-transparent border-none outline-none text-xs font-medium min-w-0 flex-1"
                                                    />
                                                ) : (
                                                    <span className="text-xs font-medium truncate select-none">{folder.name}</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditingFolderId(folder.id)
                                                        setEditFolderName(folder.name)
                                                    }}
                                                    className="p-1 hover:text-primary hover:bg-muted/20 rounded"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                </div>
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteFolder(folder.id)
                                                    }}
                                                    className="p-1 hover:text-destructive hover:bg-muted/20 rounded"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Folder Chats */}
                                        <AnimatePresence initial={false}>
                                            {expandedFolders.has(folder.id) && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden ml-2 pl-2 border-l border-border/30 space-y-0.5"
                                                >
                                                    {chats.filter(c => c.folderId === folder.id).map(chat => (
                                                        <div
                                                            key={chat.id}
                                                            className="group flex items-center gap-1"
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    onChangeView('chat')
                                                                    setCurrentChatId(chat.id)
                                                                }}
                                                                className={cn(
                                                                    "flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 transition-all duration-200 text-xs text-left min-w-0 relative",
                                                                    currentView === 'chat' && currentChatId === chat.id
                                                                        ? "bg-primary/10 text-primary"
                                                                        : "text-muted-foreground/80 hover:bg-muted/10 hover:text-foreground"
                                                                )}
                                                            >
                                                                <MessageSquare className="w-3 h-3 shrink-0 opacity-70" />
                                                                <span className="truncate flex-1">{chat.title || t('sidebar.newChat')}</span>

                                                                {/* Chat Actions */}
                                                                <div className={cn(
                                                                    "opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 absolute right-1 bg-gradient-to-l from-background to-transparent pl-2",
                                                                    editingChatId === chat.id && "hidden"
                                                                )}>
                                                                    <div
                                                                        title={t('sidebar.removeFromFolder') || 'Remove from folder'}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            moveChatToFolder(chat.id, null)
                                                                        }}
                                                                        className="p-1 hover:text-orange-400 rounded-md cursor-pointer hover:bg-muted/10"
                                                                    >
                                                                        <FolderIcon className="w-2.5 h-2.5" />
                                                                    </div>
                                                                    <div onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }} className="p-1 hover:text-destructive rounded-md cursor-pointer hover:bg-muted/10">
                                                                        <Trash2 className="w-2.5 h-2.5" />
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {chats.filter(c => c.folderId === folder.id).length === 0 && (
                                                        <div className="px-3 py-2 text-[10px] text-muted-foreground/40 italic">
                                                            {t('sidebar.emptyFolder') || 'Empty'}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}

                                {/* Unfoldered Groups */}
                                {Object.entries(dateGroups).map(([category, categoryChats]) => (
                                    categoryChats.length > 0 && (
                                        <div key={category} className="space-y-1 mt-2">
                                            {!isCollapsed && (
                                                <div className="px-2 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest flex items-center justify-between group/cat">
                                                    {category}
                                                </div>
                                            )}
                                            {categoryChats.map(chat => (
                                                <div key={chat.id} className="relative group">
                                                    <button
                                                        onClick={() => {
                                                            onChangeView('chat')
                                                            setCurrentChatId(chat.id)
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 rounded-md transition-all duration-200",
                                                            isCollapsed ? "justify-center p-2.5" : "text-left px-3 py-2.5",
                                                            currentView === 'chat' && currentChatId === chat.id
                                                                ? "bg-gradient-to-r from-primary/10 to-transparent text-primary border-l-2 border-primary"
                                                                : "text-muted-foreground/80 hover:bg-muted/10 hover:text-foreground border-l-2 border-transparent"
                                                        )}
                                                        title={isCollapsed ? chat.title : undefined}
                                                    >
                                                        <div className="relative">
                                                            <MessageSquare className={cn("w-4 h-4 shrink-0 transition-colors", currentView === 'chat' && currentChatId === chat.id ? "text-primary" : "opacity-50 group-hover:opacity-100")} />
                                                            {isChatGenerating(chat) && (
                                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                                            )}
                                                        </div>
                                                        {!isCollapsed && (
                                                            <>
                                                                {editingChatId === chat.id ? (
                                                                    <input
                                                                        ref={editInputRef}
                                                                        value={editTitle}
                                                                        onChange={e => setEditTitle(e.target.value)}
                                                                        onBlur={handleSaveEdit}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleSaveEdit()
                                                                            if (e.key === 'Escape') setEditingChatId(null)
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="flex-1 bg-transparent border-none outline-none text-xs font-medium min-w-0"
                                                                    />
                                                                ) : (
                                                                    <span className="truncate text-xs flex-1 font-medium">{chat.title || t('sidebar.newChat')}</span>
                                                                )}

                                                                <div className={cn(
                                                                    "opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 absolute right-2 bg-gradient-to-l from-background to-transparent pl-2",
                                                                    editingChatId === chat.id && "hidden"
                                                                )}>
                                                                    {/* Move to Folder - Quick Action */}
                                                                    {activeFolders.length > 0 && (
                                                                        <div className="relative group/folder">
                                                                            <div
                                                                                className="p-1 hover:text-primary rounded-md cursor-pointer hover:bg-muted/10"
                                                                            >
                                                                                <CornerUpRight className="w-3 h-3" />
                                                                            </div>
                                                                            <div onClick={(e) => { e.stopPropagation(); togglePin(chat.id, !chat.isPinned) }} className="p-1 hover:text-primary rounded-md cursor-pointer hover:bg-muted/10">
                                                                                <Pin className="w-3 h-3" />
                                                                            </div>
                                                                            {/* Simple Hover Dropdown for Folders */}
                                                                            <div className="hidden group-hover/folder:block absolute right-0 top-full z-50 w-32 py-1 bg-card border border-border/40 rounded-md shadow-xl -mt-1">
                                                                                <div className="text-[9px] px-2 py-1 text-muted-foreground uppercase font-bold tracking-wider">Move to...</div>
                                                                                {sortedFolders.map(f => (
                                                                                    <div
                                                                                        key={f.id}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation()
                                                                                            moveChatToFolder(chat.id, f.id)
                                                                                        }}
                                                                                        className="px-2 py-1.5 hover:bg-primary/20 hover:text-primary cursor-pointer text-xs truncate flex items-center gap-2"
                                                                                    >
                                                                                        <FolderIcon className="w-3 h-3 opacity-50" />
                                                                                        {f.name}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <div onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }} className="p-1 hover:text-destructive rounded-md cursor-pointer hover:bg-muted/10">
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="p-2 border-t border-border/30 bg-muted/5 space-y-1">
                    {/* Active Project Indicator */}
                    {!isCollapsed && selectedProject && (
                        <div className="px-3 py-2 bg-muted/20 rounded-md border border-border/40 mb-1">
                            <div className="text-[10px] text-muted-foreground/50 uppercase font-bold tracking-wider mb-0.5">Project</div>
                            <div className="text-xs font-medium truncate flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {selectedProject.title}
                            </div>
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSidebar}
                        className="w-full h-6 text-muted-foreground/50 hover:text-foreground hover:bg-muted/10 transition-colors"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>
                </div>
            </aside >

            <PromptManagerModal
                isOpen={showPrompts}
                onClose={() => setShowPrompts(false)}
                prompts={prompts}
                onCreatePrompt={createPrompt}
                onUpdatePrompt={updatePrompt}
                onDeletePrompt={deletePrompt}
            />
        </>
    )
}


