import { FolderPlus, MessageSquare, Pin, Search } from 'lucide-react';
import React from 'react';

import { Chat, Folder } from '@/types';

import { SidebarFolderSection } from './SidebarFolderSection';

interface SidebarChatListProps {
    isCollapsed: boolean
    searchQuery: string
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    pinnedChats: Chat[]
    activeFolders: Folder[]
    expandedFolders: Set<string>
    filteredChats: Chat[]
    recentChats: Chat[]
    chatsCount: number
    t: (key: string) => string
    toggleFolder: (id: string) => void
    deleteFolder: (id: string) => void
    createFolder: (name: string) => void
    renderChatItem: (chat: Chat) => React.ReactNode
}

export const SidebarChatList = React.memo(({
    isCollapsed,
    searchQuery,
    onSearchChange,
    pinnedChats,
    activeFolders,
    expandedFolders,
    filteredChats,
    recentChats,
    chatsCount,
    t,
    toggleFolder,
    deleteFolder,
    createFolder,
    renderChatItem
}: SidebarChatListProps) => {
    return (
        <>
            {/* Search */}
            {!isCollapsed && (
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                        <input
                            type="text"
                            placeholder={t('sidebar.searchChats')}
                            value={searchQuery}
                            onChange={onSearchChange}
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
                            {pinnedChats.map(renderChatItem)}
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
                                <SidebarFolderSection
                                    key={folder.id}
                                    folder={folder}
                                    isExpanded={expandedFolders.has(folder.id)}
                                    folderChats={filteredChats.filter(c => c.folderId === folder.id)}
                                    isCollapsed={isCollapsed}
                                    toggleFolder={toggleFolder}
                                    deleteFolder={deleteFolder}
                                    renderChatItem={renderChatItem}
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
                            {recentChats.map(renderChatItem)}
                        </div>
                    </div>
                )}

                {chatsCount === 0 && !isCollapsed && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                        <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-xs">{t('sidebar.noChats')}</p>
                    </div>
                )}
            </div>
        </>
    );
});

SidebarChatList.displayName = 'SidebarChatList';
