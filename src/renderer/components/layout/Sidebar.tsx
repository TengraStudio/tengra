import { SidebarItem } from '@renderer/components/layout/sidebar/SidebarItem'
import {
BarChart, ChevronLeft, ChevronRight, Code,     Edit2, Folder as FolderIcon,
FolderOpen, FolderPlus, Image, MessageSquare,
Mic, Palette, Pin,     Plus,     Rocket, Search, Server,
Settings, Shield, Sparkles, Trash2, User, Users} from 'lucide-react'
import React, { useCallback,useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/context/AuthContext'
import { useChat } from '@/context/ChatContext'
import { useProject } from '@/context/ProjectContext'
import { PromptManagerModal } from '@/features/prompts/components/PromptManagerModal'
import { SettingsCategory } from '@/features/settings/types'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import { Chat, Folder } from '@/types'

interface SidebarProps {
    isCollapsed: boolean
    toggleSidebar: () => void
    currentView: 'chat' | 'projects' | 'settings' | 'mcp' | 'council'
    onChangeView: (view: 'chat' | 'projects' | 'settings' | 'mcp' | 'council') => void
    onOpenSettings: (category?: SettingsCategory) => void
    onSearch: (query: string) => void
}

export const Sidebar = React.memo(({
    onOpenSettings,
    isCollapsed,
    toggleSidebar,
    currentView,
    onChangeView,
    onSearch
}: SidebarProps) => {
    const {
        chats, currentChatId, setCurrentChatId, createNewChat, deleteChat, updateChat,
        folders, createFolder, deleteFolder,
        prompts, createPrompt, updatePrompt, deletePrompt, togglePin
    } = useChat()

    const { language } = useAuth()
    const { selectedProject } = useProject()
    const { t } = useTranslation(language || 'en')

    const [searchQuery, setSearchQuery] = useState('')
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [showPrompts, setShowPrompts] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const editRef = useRef<HTMLInputElement>(null)
    const [showSettingsMenu, setShowSettingsMenu] = useState(false)

    const activeFolders = useMemo(() => folders || [], [folders])

    const filteredChats = useMemo(() => {
        if (!searchQuery) {return chats}
        const q = searchQuery.toLowerCase()
        return chats.filter(c => c.title?.toLowerCase().includes(q))
    }, [chats, searchQuery])

    const pinnedChats = useMemo(() => filteredChats.filter(c => c.isPinned), [filteredChats])
    const recentChats = useMemo(() => filteredChats.filter(c => !c.isPinned && !c.folderId).slice(0, 20), [filteredChats])

    useEffect(() => {
        if (editingId && editRef.current) {
            editRef.current.focus()
            editRef.current.select()
        }
    }, [editingId])

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value)
        onSearch(e.target.value)
    }, [onSearch])

    const startEdit = useCallback((id: string, title: string) => {
        setEditingId(id)
        setEditValue(title)
    }, [])

    const saveEdit = useCallback(() => {
        if (editingId && editValue.trim()) {
            updateChat(editingId, { title: editValue.trim() })
        }
        setEditingId(null)
    }, [editingId, editValue, updateChat])

    // NavButton replaced by SidebarItem

    const ChatItem = React.memo(({
        chat,
        isActive,
        isCollapsed,
        isEditing,
        editValue,
        setEditValue,
        saveEdit,
        startEdit,
        togglePin,
        deleteChat,
        onSelect,
        editRef,
        cancelEdit
    }: {
        chat: Chat;
        isActive: boolean;
        isCollapsed: boolean;
        isEditing: boolean;
        editValue: string;
        setEditValue: (val: string) => void;
        saveEdit: () => void;
        startEdit: (id: string, title: string) => void;
        togglePin: (id: string, pinned: boolean) => void;
        deleteChat: (id: string) => void;
        onSelect: (id: string) => void;
        editRef: React.RefObject<HTMLInputElement>;
        cancelEdit: () => void;
    }) => {
        return (
            <div className="group relative">
                <SidebarItem
                    icon={MessageSquare}
                    label={chat.title || 'New Chat'}
                    active={isActive}
                    onClick={() => onSelect(chat.id)}
                    className="py-1.5"
                    isCollapsed={isCollapsed}
                    actions={!isEditing && (
                        <>
                            <button onClick={e => { e.stopPropagation(); startEdit(chat.id, chat.title || '') }} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                                <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={e => { e.stopPropagation(); togglePin(chat.id, !chat.isPinned) }} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                                <Pin className={cn("w-3 h-3", chat.isPinned && "fill-current")} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteChat(chat.id) }} className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </>
                    )}
                >
                    {isEditing && (
                        <input
                            ref={editRef}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={e => { if (e.key === 'Enter') {saveEdit();} if (e.key === 'Escape') {cancelEdit()} }}
                            onClick={e => e.stopPropagation()}
                            className="absolute inset-0 bg-background border border-primary rounded-md px-2 text-xs outline-none z-10"
                        />
                    )}
                    {chat.isPinned && !isCollapsed && !isEditing && <Pin className="ml-auto w-3 h-3 opacity-40 fill-current shrink-0" />}
                </SidebarItem>
            </div>
        )
    })

    ChatItem.displayName = 'ChatItem'

    const FolderSection = React.memo(({
        folder,
        isExpanded,
        folderChats,
        isCollapsed,
        toggleFolder,
        deleteFolder,
        renderChatItem
    }: {
        folder: Folder;
        isExpanded: boolean;
        folderChats: Chat[];
        isCollapsed: boolean;
        toggleFolder: (id: string) => void;
        deleteFolder: (id: string) => void;
        renderChatItem: (chat: Chat) => React.ReactNode;
    }) => {
        return (
            <div>
                <SidebarItem
                    icon={isExpanded ? FolderOpen : FolderIcon}
                    label={folder.name}
                    onClick={() => toggleFolder(folder.id)}
                    badge={folderChats.length}
                    className="py-1.5 font-medium"
                    isCollapsed={isCollapsed}
                    actions={(
                        <button
                            onClick={e => { e.stopPropagation(); deleteFolder(folder.id) }}
                            className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                />

                {isExpanded && (
                    <div className="ml-3 pl-2 border-l border-border/30 space-y-0.5 mt-0.5">
                        {folderChats.map(chat => renderChatItem(chat))}
                        {folderChats.length === 0 && (
                            <p className="text-[10px] text-muted-foreground/50 py-1 px-2 italic">Empty folder</p>
                        )}
                    </div>
                )}
            </div>
        )
    })

    FolderSection.displayName = 'FolderSection'

    return (
        <>
            <aside className={cn(
                "flex flex-col h-full transition-all duration-300 ease-in-out",
                "bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60",
                isCollapsed ? "w-[70px]" : "w-full"
            )}>
                {/* Header */}
                <div className="p-3 space-y-2">
                    <button
                        onClick={() => { onChangeView('chat'); createNewChat() }}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors",
                            isCollapsed && "px-0"
                        )}
                    >
                        <Plus className="w-4 h-4" />
                        {!isCollapsed && <span>{t('sidebar.newChat')}</span>}
                    </button>
                </div>

                {/* Navigation */}
                <div className="px-3 space-y-1">
                    <SidebarItem
                        icon={MessageSquare}
                        label={t('sidebar.chats')}
                        active={currentView === 'chat'}
                        onClick={() => onChangeView('chat')}
                        badge={chats.length > 0 ? chats.length : undefined}
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem
                        icon={Rocket}
                        label={t('sidebar.projects')}
                        active={currentView === 'projects'}
                        onClick={() => onChangeView('projects')}
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem
                        icon={Users}
                        label={t('sidebar.council')}
                        active={currentView === 'council'}
                        onClick={() => onChangeView('council')}
                        isCollapsed={isCollapsed}
                    />
                </div>

                <div className="mx-3 my-2 h-px bg-border/30" />

                {/* Search */}
                {!isCollapsed && (
                    <div className="px-3 pb-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                            <input
                                type="text"
                                placeholder={t('sidebar.searchChats')}
                                value={searchQuery}
                                onChange={handleSearch}
                                className="w-full bg-muted/30 border border-border/30 rounded-md pl-7 pr-2 py-1.5 text-xs outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                    </div>
                )}

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto px-2 space-y-3 scrollbar-thin scrollbar-thumb-border/30">
                    {/* Pinned */}
                    {pinnedChats.length > 0 && !isCollapsed && (
                        <div>
                            <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
                                <Pin className="w-3 h-3" /> Pinned
                            </p>
                            <div className="space-y-0.5">
                                {pinnedChats.map(chat => (
                                    <ChatItem
                                        key={chat.id}
                                        chat={chat}
                                        isActive={currentView === 'chat' && currentChatId === chat.id}
                                        isCollapsed={isCollapsed}
                                        isEditing={editingId === chat.id}
                                        editValue={editValue}
                                        setEditValue={setEditValue}
                                        saveEdit={saveEdit}
                                        startEdit={startEdit}
                                        togglePin={togglePin}
                                        deleteChat={deleteChat}
                                        onSelect={(id) => { onChangeView('chat'); setCurrentChatId(id) }}
                                        editRef={editRef}
                                        cancelEdit={() => setEditingId(null)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Folders */}
                    {activeFolders.length > 0 && !isCollapsed && (
                        <div>
                            <div className="flex items-center justify-between px-2 py-1">
                                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Folders</p>
                                <button
                                    onClick={() => createFolder('New Folder')}
                                    className="p-0.5 text-muted-foreground/50 hover:text-foreground"
                                >
                                    <FolderPlus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="space-y-0.5">
                                {activeFolders.map(folder => (
                                    <FolderSection
                                        key={folder.id}
                                        folder={folder}
                                        isExpanded={expandedFolders.has(folder.id)}
                                        folderChats={filteredChats.filter(c => c.folderId === folder.id)}
                                        isCollapsed={isCollapsed}
                                        toggleFolder={(id) => setExpandedFolders(prev => {
                                            const next = new Set(prev)
                                            if (next.has(id)) {next.delete(id)}
                                            else {next.add(id)}
                                            return next
                                        })}
                                        deleteFolder={deleteFolder}
                                        renderChatItem={(chat) => (
                                            <ChatItem
                                                key={chat.id}
                                                chat={chat}
                                                isActive={currentView === 'chat' && currentChatId === chat.id}
                                                isCollapsed={isCollapsed}
                                                isEditing={editingId === chat.id}
                                                editValue={editValue}
                                                setEditValue={setEditValue}
                                                saveEdit={saveEdit}
                                                startEdit={startEdit}
                                                togglePin={togglePin}
                                                deleteChat={deleteChat}
                                                onSelect={(id) => { onChangeView('chat'); setCurrentChatId(id) }}
                                                editRef={editRef}
                                                cancelEdit={() => setEditingId(null)}
                                            />
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent */}
                    {recentChats.length > 0 && !isCollapsed && (
                        <div>
                            <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Recent</p>
                            <div className="space-y-0.5">
                                {recentChats.map(chat => (
                                    <ChatItem
                                        key={chat.id}
                                        chat={chat}
                                        isActive={currentView === 'chat' && currentChatId === chat.id}
                                        isCollapsed={isCollapsed}
                                        isEditing={editingId === chat.id}
                                        editValue={editValue}
                                        setEditValue={setEditValue}
                                        saveEdit={saveEdit}
                                        startEdit={startEdit}
                                        togglePin={togglePin}
                                        deleteChat={deleteChat}
                                        onSelect={(id) => { onChangeView('chat'); setCurrentChatId(id) }}
                                        editRef={editRef}
                                        cancelEdit={() => setEditingId(null)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {chats.length === 0 && !isCollapsed && (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                            <p className="text-xs">{t('sidebar.noChats')}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-border/30 space-y-1">
                    {selectedProject && !isCollapsed && (
                        <div className="px-2 py-1.5 bg-muted/30 rounded-md mb-1">
                            <p className="text-[10px] text-muted-foreground/50 uppercase">Project</p>
                            <p className="text-xs font-medium truncate">{selectedProject.title}</p>
                        </div>
                    )}

                    {/* Settings Dropdown */}
                    <div className="relative">
                        <SidebarItem
                            icon={Settings}
                            label={t('sidebar.settings')}
                            active={currentView === 'settings' || showSettingsMenu}
                            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                            isCollapsed={isCollapsed}
                        />

                        {showSettingsMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowSettingsMenu(false)} />
                                <div className={cn(
                                    "absolute bottom-full left-0 w-48 mb-2 p-1",
                                    "bg-popover/80 backdrop-blur-xl border border-border/50",
                                    "rounded-lg shadow-xl z-50 overflow-hidden",
                                    "flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-200"
                                )}>
                                    {[
                                        { id: 'general', label: t('settings.general') || 'General', icon: Settings },
                                        { id: 'accounts', label: t('settings.accounts') || 'Accounts', icon: User },
                                        { id: 'appearance', label: t('settings.appearance') || 'Appearance', icon: Palette },
                                        { id: 'models', label: t('settings.models') || 'Models', icon: Sparkles },
                                        { id: 'prompts', label: t('settings.prompts') || 'Prompts', icon: MessageSquare },
                                        { id: 'personas', label: t('settings.personas') || 'Personas', icon: Users },
                                        { id: 'speech', label: t('settings.speech') || 'Speech', icon: Mic },
                                        { id: 'statistics', label: t('settings.statistics') || 'Statistics', icon: BarChart },
                                        { id: 'gallery', label: t('settings.gallery') || 'Gallery', icon: Image },
                                        { id: 'mcp-servers', label: 'MCP', icon: Server }, // Merged view for Servers & Marketplace
                                        { id: 'developer', label: t('settings.developer') || 'Developer', icon: Code },
                                        { id: 'advanced', label: t('settings.advanced') || 'Advanced', icon: Shield },
                                        { id: 'about', label: t('settings.about') || 'About', icon: Rocket }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                onOpenSettings(item.id as SettingsCategory)
                                                setShowSettingsMenu(false)
                                            }}
                                            className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors text-left"
                                        >
                                            <item.icon className="w-3.5 h-3.5" />
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={toggleSidebar}
                        className="w-full flex items-center justify-center p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 rounded-md transition-colors"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>
            </aside>

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
})
