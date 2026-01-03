import { Chat, Folder, Project } from '../types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
    Plus, Settings, ChevronLeft, ChevronRight, Folder as FolderIcon, FolderPlus,
    Pin, Trash2, Upload,
    Search,
    Star, Copy, Archive, Pencil,
    Globe, Palette, Box, BarChart2, LayoutGrid, User, Store, Puzzle
} from 'lucide-react'
import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent, ReactNode } from 'react'
import { useTranslation, Language } from '../i18n'

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
    currentView: 'chat' | 'projects' | 'settings' | 'mcp'
    onChangeView: (view: 'chat' | 'projects' | 'mcp') => void
    onSearch: (query: string) => void
    activeProject?: Project | null
    settingsCategory?: any
    onSelectSettingsCategory?: (category: any) => void

    // Folders
    folders: Folder[]
    onCreateFolder: (name: string) => void
    onDeleteFolder: (id: string) => void
    onUpdateFolder: (id: string, name: string) => void
    onMoveChat: (chatId: string, folderId: string | null) => void
    language: Language
}

export function Sidebar({
    chats,
    currentChatId,
    onSelectChat,
    onNewChat,
    onDeleteChat,
    onDuplicateChat,
    onArchiveChat,
    onUpdateChatTitle,
    onTogglePin,
    onToggleFavorite,
    onOpenSettings,
    isCollapsed,
    toggleSidebar,
    currentView,
    onChangeView,
    onSearch,
    activeProject,
    settingsCategory,
    onSelectSettingsCategory,
    folders, onCreateFolder, onDeleteFolder, onUpdateFolder: _onUpdateFolder, onMoveChat: _onMoveChat,
    language
}: SidebarProps) {
    const { t } = useTranslation(language)
    const [hoveredChatId, setHoveredChatId] = useState<string | null>(null)
    const [editingChatId, setEditingChatId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const editInputRef = useRef<HTMLInputElement>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [mcpExpanded, setMcpExpanded] = useState(true)

    useEffect(() => {
        if (editingChatId && editInputRef.current) {
            editInputRef.current.focus()
            editInputRef.current.select()
        }
    }, [editingChatId])

    const handleStartEdit = (chat: Chat) => {
        setEditingChatId(chat.id)
        setEditTitle(chat.title || '')
    }

    const handleSaveEdit = () => {
        if (editingChatId && onUpdateChatTitle) {
            onUpdateChatTitle(editingChatId, editTitle)
        }
        setEditingChatId(null)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') handleSaveEdit()
        if (e.key === 'Escape') setEditingChatId(null)
    }

    const toggleFolder = (folderId: string) => {
        const next = new Set(expandedFolders)
        if (next.has(folderId)) next.delete(folderId)
        else next.add(folderId)
        setExpandedFolders(next)
    }

    const groupChatsByDate = (chatsToGroup: Chat[]) => {
        const groups: Record<string, Chat[]> = {
            'Bugün': [],
            'Dün': [],
            'Geçen Hafta': [],
            'Daha Eski': []
        }

        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const yesterday = today - 86400000

        chatsToGroup.forEach(chat => {
            const date = new Date(chat.createdAt).getTime()
            if (date >= today) groups['Bugün'].push(chat)
            else if (date >= yesterday) groups['Dün'].push(chat)
            else if (date >= today - 7 * 86400000) groups['Geçen Hafta'].push(chat)
            else groups['Daha Eski'].push(chat)
        })

        return groups
    }

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchQuery(value)
        onSearch(value)
    }

    const handleImportJson = async (_e: ChangeEvent<HTMLInputElement>) => {
        // Implement import logic
    }

    const SectionHeader = ({ title, action }: { title: string; action?: ReactNode }) => (
        <div className="px-4 py-2 text-sm font-bold text-muted-foreground/70 uppercase tracking-wider flex items-center justify-between">
            <span>{title}</span>
            {action}
        </div>
    )

    return (
        <aside
            className={cn(
                "flex flex-col h-full z-30 relative overflow-hidden transition-all duration-300 border-r border-border bg-background",
                isCollapsed ? "w-[80px]" : "w-80"
            )}
        >
            <div className="p-4 flex items-center justify-between border-b border-white/5 h-18 shrink-0">
                {!isCollapsed && (
                    <div className="flex items-center gap-3 font-bold text-xl tracking-tight">
                        <img src="./src/renderer/assets/zenith_logo.png" alt="ZENITH" className="w-10 h-10 object-contain" />
                        <span className="text-foreground font-black tracking-tighter text-xl italic uppercase">ZENITH</span>
                    </div>
                )}
                <Button variant="ghost" size="icon" onClick={toggleSidebar} className={cn("text-muted-foreground hover:text-foreground hover:bg-muted/20 shrink-0 w-10 h-10", isCollapsed && "mx-auto")}>
                    {isCollapsed ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
                </Button>
            </div>

            {currentView !== 'settings' && !isCollapsed && (
                <div className="px-4 py-4 flex items-center gap-3 border-b border-border/10 bg-gradient-to-b from-muted/10 to-transparent">
                    <button
                        onClick={() => onChangeView('chat')}
                        className={cn(
                            "flex-1 py-3 text-sm font-semibold transition-all duration-500 rounded-xl border",
                            currentView === 'chat'
                                ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_20px_-5px_rgba(6,182,212,0.35)]"
                                : "bg-transparent text-muted-foreground/60 border-transparent hover:text-muted-foreground hover:bg-muted/10"
                        )}
                    >
                        {t('sidebar.chats')}
                    </button>
                    <button
                        onClick={() => onChangeView('projects')}
                        className={cn(
                            "flex-1 py-3 text-sm font-semibold transition-all duration-500 rounded-xl border",
                            currentView === 'projects'
                                ? "bg-pink-500/15 text-pink-300 border-pink-500/40 shadow-[0_0_20px_-5px_rgba(236,72,153,0.35)]"
                                : "bg-transparent text-muted-foreground/60 border-transparent hover:text-muted-foreground hover:bg-muted/10"
                        )}
                    >
                        {t('sidebar.projects')}
                    </button>
                </div>
            )}

            {currentView === 'chat' && (
                <div className="px-4 py-4 shrink-0 space-y-3">
                    <Button onClick={onNewChat} className={cn("w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-3 group transition-all duration-200 rounded-xl", isCollapsed ? "h-12 w-12 p-0" : "py-4")} title="Yeni Sohbet">
                        <Plus className={cn("transition-transform duration-300 w-6 h-6", !isCollapsed && "group-hover:rotate-90")} />
                        {!isCollapsed && <span className="font-bold text-base">{t('sidebar.newChat')}</span>}
                    </Button>
                    {!isCollapsed && (
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
                            <input type="text" placeholder={t('sidebar.searchChats')} value={searchQuery} onChange={handleSearch} className="w-full bg-secondary/50 border-transparent focus:bg-secondary text-base rounded-xl pl-12 pr-12 py-3 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40 transition-all font-medium" />
                            <label className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-2 hover:bg-muted/20 rounded-lg transition-colors group/import">
                                <Upload className="w-5 h-5 text-muted-foreground/50 group-hover/import:text-primary transition-colors" />
                                <input type="file" accept=".json" className="hidden" onChange={handleImportJson} />
                            </label>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar flex flex-col">
                {currentView === 'chat' && (
                    chats.length === 0 ? (!isCollapsed && <div className="text-center py-12 opacity-40 text-sm font-bold uppercase tracking-widest border-2 border-dashed border-border/30 rounded-xl">{t('sidebar.noChats')}</div>) : (
                        <div className="space-y-5">
                            {folders.length > 0 && (
                                <div className="space-y-2">
                                    <div className="px-3 py-1 text-sm font-semibold text-muted-foreground/70 uppercase tracking-wider flex items-center justify-between group">
                                        <span>{t('sidebar.folders')}</span>
                                        <button onClick={() => onCreateFolder(t('sidebar.newFolder'))} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-muted/20 rounded-lg"><FolderPlus className="w-5 h-5" /></button>
                                    </div>
                                    {folders.map(folder => {
                                        const isExpanded = expandedFolders.has(folder.id)
                                        const folderChats = chats.filter(c => c.folderId === folder.id)
                                        return (
                                            <div key={folder.id} className="space-y-1">
                                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/10 cursor-pointer text-base group" onClick={() => toggleFolder(folder.id)}>
                                                    <ChevronRight className={cn("w-5 h-5 transition-transform", isExpanded && "rotate-90")} />
                                                    <FolderIcon className="w-5 h-5 text-blue-400" />
                                                    <span className="flex-1 truncate font-medium">{folder.name}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id) }} className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                                {isExpanded && (
                                                    <div className="ml-5 pl-3 border-l-2 border-border/20 space-y-1">
                                                        {folderChats.map(chat => (
                                                            <button key={chat.id} onClick={() => onSelectChat(chat.id)} className={cn("w-full text-left px-3 py-2.5 rounded-lg text-base truncate transition-colors flex items-center gap-2", currentChatId === chat.id ? "bg-accent/50 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/10")}>
                                                                <span className="truncate">{chat.title || 'Yeni Sohbet'}</span>
                                                            </button>
                                                        ))}
                                                        {folderChats.length === 0 && <div className="text-sm text-muted-foreground/50 px-3 py-2 italic">{t('sidebar.emptyFolder')}</div>}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {Object.entries(groupChatsByDate(chats.filter(c => !c.folderId))).map(([category, categoryChats]) => (
                                categoryChats.length > 0 && (
                                    <div key={category} className="space-y-2">
                                        {!isCollapsed && <div className="px-3 mb-2 text-sm font-semibold text-muted-foreground/50 uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur-md py-2 z-10">{category}</div>}
                                        <div className="space-y-1">
                                            {categoryChats.map(chat => (
                                                <div
                                                    key={chat.id}
                                                    onMouseEnter={() => setHoveredChatId(chat.id)}
                                                    onMouseLeave={() => setHoveredChatId(null)}
                                                    className={cn(
                                                        "w-full rounded-xl transition-all group relative flex items-center",
                                                        isCollapsed ? "justify-center p-3" : "py-1 justify-between",
                                                        currentChatId === chat.id ? "bg-accent/60 text-foreground border border-border shadow-sm font-semibold" : "text-muted-foreground/70 border border-transparent hover:bg-accent/30 hover:text-foreground/90"
                                                    )}
                                                    title={isCollapsed ? chat.title : undefined}
                                                >
                                                    {isCollapsed ? (
                                                        <button
                                                            onClick={() => onSelectChat(chat.id)}
                                                            className="relative w-full h-full flex items-center justify-center p-2"
                                                        >
                                                            <div className="w-3 h-3 rounded-full bg-current opacity-50" />
                                                            {chat.isPinned && <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />}
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => onSelectChat(chat.id)}
                                                                className="flex-1 text-left px-4 py-3 truncate text-base font-medium pr-10"
                                                            >
                                                                {editingChatId === chat.id ? (
                                                                    <input
                                                                        ref={editInputRef}
                                                                        value={editTitle}
                                                                        onChange={e => setEditTitle(e.target.value)}
                                                                        onBlur={handleSaveEdit}
                                                                        onKeyDown={handleKeyDown}
                                                                        className="w-full bg-background border border-primary/40 rounded-lg px-3 py-1 text-base focus:outline-none"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                ) : (
                                                                    <span>{chat.title || 'Yeni Analiz'}</span>
                                                                )}
                                                            </button>

                                                            <div className={cn("absolute right-2 flex items-center gap-1 transition-opacity bg-background/80 backdrop-blur-sm rounded-lg p-1 border border-border/50", (hoveredChatId === chat.id || chat.isPinned) ? "opacity-100" : "opacity-0")}>
                                                                <button onClick={(e) => { e.stopPropagation(); onTogglePin(chat.id, !chat.isPinned) }} className={cn("p-1.5 rounded-lg transition-all hover:bg-muted/50", chat.isPinned ? "text-primary" : "text-muted-foreground")} title="İğnele"><Pin className={cn("w-4 h-4", chat.isPinned && "fill-current")} /></button>
                                                                <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(chat.id, !chat.isFavorite) }} className={cn("p-1.5 rounded-lg transition-all hover:bg-muted/50", chat.isFavorite ? "text-yellow-400" : "text-muted-foreground")} title="Favori"><Star className={cn("w-4 h-4", chat.isFavorite && "fill-current")} /></button>
                                                                {hoveredChatId === chat.id && (
                                                                    <>
                                                                        <button onClick={(e) => { e.stopPropagation(); onDuplicateChat?.(chat.id) }} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary" title="Kopyala"><Copy className="w-4 h-4" /></button>
                                                                        <button onClick={(e) => { e.stopPropagation(); onArchiveChat?.(chat.id, !chat.isArchived) }} className={cn("p-1.5 rounded-lg hover:bg-muted/50", chat.isArchived ? "text-amber-500" : "text-muted-foreground")} title="Arşivle"><Archive className="w-4 h-4" /></button>
                                                                        <button onClick={(e) => { e.stopPropagation(); handleStartEdit(chat) }} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary" title="Yeniden Adlandır"><Pencil className="w-4 h-4" /></button>
                                                                        <button onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id) }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400" title="Sil"><Trash2 className="w-4 h-4" /></button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    )
                )}

                {currentView === 'projects' && !isCollapsed && (
                    <div className="flex flex-col flex-1 min-h-0 space-y-4">
                        <SectionHeader
                            title={activeProject ? 'Aktif Proje' : 'Proje'}
                            action={activeProject ? (
                                <span className="text-sm leading-none font-semibold text-muted-foreground/70 truncate max-w-[160px]">
                                    {activeProject.title || 'Project'}
                                </span>
                            ) : null}
                        />
                        <div className="flex-1 min-h-0 rounded-xl border border-white/10 bg-black/20 overflow-hidden" id="workspace-sidebar">
                            {!activeProject && (
                                <div className="p-4 text-sm text-muted-foreground/60">
                                    Proje secilince calisma alani burada gorunecek.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {currentView === 'settings' && !isCollapsed && (
                    <div className="space-y-4">
                        <button
                            onClick={() => onChangeView('chat')}
                            className="w-full px-4 py-3 rounded-xl transition-all flex items-center gap-3 text-muted-foreground hover:bg-accent hover:text-foreground group"
                        >
                            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                            <span className="text-base font-medium">{t('common.back') || 'Geri'}</span>
                        </button>
                        <SectionHeader title={t('settings.title')} />
                        <div className="space-y-1.5">
                            {[
                                { id: 'accounts', label: t('settings.accounts'), icon: Globe },
                                { id: 'general', label: t('settings.general'), icon: Settings },
                                { id: 'appearance', label: t('settings.appearance'), icon: Palette },
                                { id: 'models', label: t('settings.models'), icon: Box },
                                { id: 'statistics', label: 'Istatistikler', icon: BarChart2 },
                                { id: 'gallery', label: 'Galeri', icon: LayoutGrid },
                                { id: 'personas', label: 'Personalar', icon: User }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => onSelectSettingsCategory?.(item.id)}
                                    className={cn(
                                        "w-full px-4 py-3 rounded-xl transition-all flex items-center gap-4",
                                        settingsCategory === item.id
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                    )}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="text-base font-medium">{item.label}</span>
                                </button>
                            ))}
                            <button
                                onClick={() => setMcpExpanded((prev) => !prev)}
                                className={cn(
                                    "w-full px-4 py-3 rounded-xl transition-all flex items-center gap-4",
                                    String(settingsCategory || '').startsWith('mcp-')
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                )}
                            >
                                <Puzzle className="w-5 h-5" />
                                <span className="text-base font-medium">{t('mcp.management')}</span>
                            </button>
                            {mcpExpanded && (
                                <div className="ml-8 space-y-1.5">
                                    <button
                                        onClick={() => onSelectSettingsCategory?.('mcp-servers')}
                                        className={cn(
                                            "w-full px-4 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center gap-3",
                                            settingsCategory === 'mcp-servers'
                                                ? "bg-emerald-500/10 text-emerald-300"
                                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                        )}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                        Sunucularim
                                    </button>
                                    <button
                                        onClick={() => onSelectSettingsCategory?.('mcp-marketplace')}
                                        className={cn(
                                            "w-full px-4 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center gap-3",
                                            settingsCategory === 'mcp-marketplace'
                                                ? "bg-emerald-500/10 text-emerald-300"
                                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                        )}
                                    >
                                        <Store className="w-4 h-4" />
                                        Marketplace
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-white/5 shrink-0 space-y-2">
                <Button variant="ghost" onClick={onOpenSettings} className={cn("w-full flex items-center gap-4 text-muted-foreground hover:text-white hover:bg-white/5 transition-all", isCollapsed ? "justify-center p-0 h-12 w-12 rounded-xl" : "justify-start px-4 py-4 rounded-xl")}>
                    <Settings className={cn("transition-transform duration-500 hover:rotate-90", isCollapsed ? "w-6 h-6" : "w-5 h-5")} />
                    {!isCollapsed && <span className="font-medium text-base">Ayarlar</span>}
                </Button>
            </div>
        </aside>
    )
}
