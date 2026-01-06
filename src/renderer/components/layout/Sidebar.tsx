import { Chat, Folder, Project } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import './Sidebar.css'
import {
    Plus, Settings, ChevronLeft, ChevronRight,
    Trash2, Search, MessageSquare, Rocket, ChevronDown,
    LayoutGrid, Mic, Terminal, Database, Image, UserCircle, History, Info, Activity, Cpu
} from 'lucide-react'
import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { useTranslation, Language } from '@/i18n'
import { motion, AnimatePresence } from 'framer-motion'

interface SidebarProps {
    chats: Chat[]
    currentChatId: string | null
    onSelectChat: (id: string) => void
    onNewChat: () => void
    onDeleteChat: (id: string) => void
    onDuplicateChat?: (id: string) => void
    onArchiveChat?: (id: string, isArchived: boolean) => void
    onUpdateChatTitle?: (id: string, title: string) => void
    onTogglePin: (id: string, isPinned: boolean) => void
    onToggleFavorite: (id: string, isFavorite: boolean) => void
    onOpenSettings: (category?: any) => void
    isCollapsed: boolean
    toggleSidebar: () => void
    currentView: 'chat' | 'projects' | 'settings' | 'mcp' | 'council'
    onChangeView: (view: 'chat' | 'projects' | 'settings' | 'mcp' | 'council') => void
    onSearch: (query: string) => void
    activeProject?: Project | null
    settingsCategory?: any
    onSelectSettingsCategory?: (category: any) => void

    // Folders on the sidebar? (Unused but kept for interface compat)
    folders?: Folder[]
    onCreateFolder?: (name: string) => void
    onDeleteFolder?: (id: string) => void
    onUpdateFolder?: (id: string, name: string) => void
    onMoveChat?: (chatId: string, folderId: string | null) => void
    language?: Language
    modelUsageStats?: { name: string, count: number }[]
}

export function Sidebar({
    chats,
    currentChatId,
    onSelectChat,
    onNewChat,
    onDeleteChat,
    onUpdateChatTitle,
    onOpenSettings,
    isCollapsed,
    toggleSidebar,
    currentView,
    onChangeView,
    onSearch,
    language = 'en',
    onSelectSettingsCategory,
    settingsCategory
}: SidebarProps) {
    const { t } = useTranslation(language)
    const [editingChatId, setEditingChatId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const editInputRef = useRef<HTMLInputElement>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    useEffect(() => {
        if (editingChatId && editInputRef.current) {
            editInputRef.current.focus()
            editInputRef.current.select()
        }
    }, [editingChatId])

    const handleSaveEdit = () => {
        if (editingChatId && onUpdateChatTitle) {
            onUpdateChatTitle(editingChatId, editTitle)
        }
        setEditingChatId(null)
    }

    const groupChatsByDate = (chatsToGroup: Chat[]) => {
        const groups: Record<string, Chat[]> = {
            'BugÃ¼n': [],
            'DÃ¼n': [],
            'GeÃ§en Hafta': [],
            'Daha Eski': []
        }

        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const yesterday = today - 86400000

        chatsToGroup.forEach(chat => {
            const date = new Date(chat.createdAt).getTime()
            if (date >= today) groups['BugÃ¼n'].push(chat)
            else if (date >= yesterday) groups['DÃ¼n'].push(chat)
            else if (date >= today - 7 * 86400000) groups['GeÃ§en Hafta'].push(chat)
            else groups['Daha Eski'].push(chat)
        })

        return groups
    }

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchQuery(value)
        onSearch(value)
    }

    const SettingsMenuItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => (
        <button
            onClick={() => {
                onOpenSettings(id)
                if (onSelectSettingsCategory) onSelectSettingsCategory(id)
            }}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 ml-2 border-l border-white/5 hover:border-primary/50",
                (currentView === 'settings' && settingsCategory === id)
                    ? "text-primary bg-primary/5 border-primary"
                    : "text-muted-foreground hover:bg-muted/10 hover:text-foreground"
            )}
        >
            <Icon className="w-3.5 h-3.5 opacity-70" />
            <span>{label}</span>
        </button>
    )

    return (
        <aside
            className={cn(
                "flex flex-col h-full z-30 relative overflow-hidden transition-all duration-300 border-r border-border/40 bg-background/60 backdrop-blur-2xl shadow-xl",
                isCollapsed ? "w-[72px]" : "w-[280px]"
            )}
        >
            {/* Top Navigation Section */}
            <div className="flex flex-col gap-1 p-4 pb-2">
                <Button
                    onClick={onNewChat}
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
                                        <div className="pr-2 py-1 space-y-0.5 ml-2 border-l border-dashed border-border/30">
                                            <SettingsMenuItem id="general" icon={LayoutGrid} label={t('settings.general')} />
                                            <SettingsMenuItem id="accounts" icon={UserCircle} label="Hesaplar" />
                                            <SettingsMenuItem id="models" icon={Database} label={t('settings.models')} />
                                            <SettingsMenuItem id="appearance" icon={Image} label={t('settings.appearance')} />
                                            <SettingsMenuItem id="speech" icon={Mic} label="Ses" />
                                            <SettingsMenuItem id="advanced" icon={Cpu} label="GeliÅŸmiÅŸ" />
                                            <SettingsMenuItem id="developer" icon={Terminal} label="GeliÅŸtirici" />
                                            <SettingsMenuItem id="statistics" icon={Activity} label="Ä°statistikler" />
                                            <SettingsMenuItem id="gallery" icon={Image} label="Galeri" />
                                            <SettingsMenuItem id="about" icon={Info} label="HakkÄ±nda" />
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
                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">GeÃ§miÅŸ</span>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder={t('sidebar.searchChats')}
                                value={searchQuery}
                                onChange={handleSearch}
                                className="w-full bg-black/10 border border-white/5 focus:border-primary/20 focus:bg-black/20 text-xs rounded-lg pl-8 pr-3 py-2 outline-none transition-all font-medium placeholder:text-muted-foreground/30"
                            />
                        </div>
                    </div>
                )}

                {/* Chat Statistics Summary (#60) */}
                {!isCollapsed && chats.length > 0 && (
                    <div className="px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground/40 border-b border-white/5 mb-2">
                        <span>{chats.length} sohbet</span>
                        <span>â€¢</span>
                        <span>{chats.reduce((acc, c) => acc + (c.messages?.length || 0), 0)} mesaj</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-3 space-y-6 custom-scrollbar py-2">
                    {Object.entries(groupChatsByDate(chats)).map(([category, categoryChats]) => (
                        categoryChats.length > 0 && (
                            <div key={category} className="space-y-1">
                                {!isCollapsed && (
                                    <div className="px-2 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                                        {category}
                                    </div>
                                )}
                                {categoryChats.map(chat => (
                                    <button
                                        key={chat.id}
                                        onClick={() => {
                                            onChangeView('chat')
                                            onSelectChat(chat.id)
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 rounded-md transition-all group relative duration-200",
                                            isCollapsed ? "justify-center p-2.5" : "text-left px-3 py-2.5",
                                            currentView === 'chat' && currentChatId === chat.id
                                                ? "bg-gradient-to-r from-primary/10 to-transparent text-primary border-l-2 border-primary"
                                                : "text-muted-foreground/80 hover:bg-white/5 hover:text-foreground border-l-2 border-transparent"
                                        )}
                                        title={isCollapsed ? chat.title : undefined}
                                    >
                                        <MessageSquare className={cn("w-4 h-4 shrink-0 transition-colors", currentView === 'chat' && currentChatId === chat.id ? "text-primary" : "opacity-50 group-hover:opacity-100")} />
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
                                                    <span className="truncate text-xs flex-1 font-medium">{chat.title || 'Yeni Sohbet'}</span>
                                                )}

                                                <div className={cn(
                                                    "opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 absolute right-2 bg-gradient-to-l from-background to-transparent pl-2",
                                                    editingChatId === chat.id && "hidden"
                                                )}>
                                                    <div onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id) }} className="p-1 hover:text-red-400 rounded-md cursor-pointer hover:bg-white/5">
                                                        <Trash2 className="w-3 h-3" />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )
                    ))}
                </div>
            </div>

            {/* Bottom Section - Collapse Toggle Only */}
            <div className="p-2 border-t border-white/5 bg-black/5">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="w-full h-6 text-muted-foreground/30 hover:text-foreground hover:bg-white/5 transition-colors"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
            </div>
        </aside>
    )
}
