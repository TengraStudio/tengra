import { FolderPlus, MessageSquare, Pin, Search } from 'lucide-react';
import React, { useLayoutEffect,useRef } from 'react';

import { Chat, Folder } from '@/types';

import { SidebarFolderSection } from './SidebarFolderSection';

interface SidebarChatListProps {
    isCollapsed: boolean;
    searchQuery: string;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    pinnedChats: Chat[];
    activeFolders: Folder[];
    expandedFolders: Set<string>;
    filteredChats: Chat[];
    recentChats: Chat[];
    chatsCount: number;
    t: (key: string) => string;
    toggleFolder: (id: string) => void;
    deleteFolder: (id: string) => void;
    createFolder: (name: string) => void;
    renderChatItem: (chat: Chat) => React.ReactNode;
}

export const SidebarChatList = React.memo(
    ({
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
        renderChatItem,
    }: SidebarChatListProps) => {
        // Preserve scroll position across re-renders
        const scrollContainerRef = useRef<HTMLDivElement>(null);
        const scrollPositionRef = useRef<number>(0);

        // Save scroll position before render
        useLayoutEffect(() => {
            const container = scrollContainerRef.current;
            if (container) {
                scrollPositionRef.current = container.scrollTop;
            }
        });

        // Restore scroll position after render
        useLayoutEffect(() => {
            const container = scrollContainerRef.current;
            if (container && scrollPositionRef.current > 0) {
                container.scrollTop = scrollPositionRef.current;
            }
        }, [pinnedChats, activeFolders, recentChats, expandedFolders]);

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
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto px-2 space-y-3 scrollbar-thin scrollbar-thumb-border/30"
                >
                    {/* Pinned */}
                    {pinnedChats.length > 0 && (
                        <div>
                            {!isCollapsed && (
                                <p className="px-2 py-1 text-xxs font-semibold text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
                                    <Pin className="w-3 h-3" /> {t('sidebar.pinned')}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {pinnedChats.map(chat => (
                                    <div
                                        key={chat.id}
                                        className="animate-in fade-in slide-in-from-left-1 duration-200 fill-mode-backwards"
                                    >
                                        {renderChatItem(chat)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Folders */}
                    {activeFolders.length > 0 && (
                        <div>
                            {!isCollapsed && (
                                <div className="flex items-center justify-between px-2 py-1">
                                    <p className="text-xxs font-semibold text-muted-foreground/50 uppercase tracking-wider">
                                        {t('sidebar.folders')}
                                    </p>
                                    <button
                                        onClick={() => createFolder(t('sidebar.newFolder'))}
                                        className="p-0.5 text-muted-foreground/50 hover:text-foreground"
                                    >
                                        <FolderPlus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {activeFolders.map(folder => (
                                    <SidebarFolderSection
                                        key={folder.id}
                                        folder={folder}
                                        isExpanded={expandedFolders.has(folder.id)}
                                        // Filter chats for this folder specifically
                                        folderChats={filteredChats.filter(
                                            c => c.folderId === folder.id
                                        )}
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
                    {recentChats.length > 0 && (
                        <div>
                            {!isCollapsed && (
                                <p className="px-2 py-1 text-xxs font-semibold text-muted-foreground/50 uppercase tracking-wider">
                                    {t('sidebar.recent')}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {recentChats.map(chat => (
                                    <div
                                        key={chat.id}
                                        className="animate-in fade-in slide-in-from-left-1 duration-200 fill-mode-backwards"
                                    >
                                        {renderChatItem(chat)}
                                    </div>
                                ))}
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
    }
);

SidebarChatList.displayName = 'SidebarChatList';
