/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Folder as FolderIcon, FolderOpen, FolderPlus, type LucideIcon,MessageSquare, Pin as PinIcon, Search, Trash2 } from 'lucide-react';
import React, { useCallback,useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { Chat, Folder } from '@/types';

import { SidebarItem } from './SidebarItem';

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
    onClearAll?: () => void;
}

type SidebarListItem = 
    | { type: 'header', label: string, icon?: LucideIcon, action?: { label: string, icon: LucideIcon, onClick: () => void } }
    | { type: 'chat', chat: Chat, isIndented?: boolean }
    | { type: 'folder', folder: Folder, isExpanded: boolean, count: number }
    | { type: 'empty-state', label: string }
    | { type: 'divider' };

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
        onClearAll,
    }: SidebarChatListProps) => {

        const flattenedItems = useMemo(() => {
            const items: SidebarListItem[] = [];

            // 1. Pinned
            if (pinnedChats.length > 0) {
                if (!isCollapsed) {
                    items.push({ type: 'header', label: t('sidebar.pinned'), icon: PinIcon });
                }
                pinnedChats.forEach(chat => {
                    items.push({ type: 'chat', chat });
                });
                items.push({ type: 'divider' });
            }

            // 2. Folders
            if (activeFolders.length > 0) {
                if (!isCollapsed) {
                    items.push({ 
                        type: 'header', 
                        label: t('sidebar.folders'), 
                        action: { label: t('sidebar.newFolder'), icon: FolderPlus, onClick: () => createFolder(t('sidebar.newFolder')) } 
                    });
                }

                const folderChatsById = new Map<string, Chat[]>();
                filteredChats.forEach(chat => {
                    if (chat.folderId) {
                        const existing = folderChatsById.get(chat.folderId) || [];
                        existing.push(chat);
                        folderChatsById.set(chat.folderId, existing);
                    }
                });

                activeFolders.forEach(folder => {
                    const isExpanded = expandedFolders.has(folder.id);
                    const chats = folderChatsById.get(folder.id) || [];
                    items.push({ type: 'folder', folder, isExpanded, count: chats.length });
                    
                    if (isExpanded) {
                        if (chats.length > 0) {
                            chats.forEach(chat => {
                                items.push({ type: 'chat', chat, isIndented: true });
                            });
                        } else if (!isCollapsed) {
                            items.push({ type: 'empty-state', label: t('sidebar.emptyFolder') });
                        }
                    }
                });
                items.push({ type: 'divider' });
            }

            // 3. Recent
            if (recentChats.length > 0) {
                if (!isCollapsed) {
                    items.push({ 
                        type: 'header', 
                        label: t('sidebar.recent'),
                        action: onClearAll ? { label: t('sidebar.clearHistory'), icon: Trash2, onClick: onClearAll } : undefined
                    });
                }
                recentChats.forEach(chat => {
                    items.push({ type: 'chat', chat });
                });
            }

            if (chatsCount === 0 && !isCollapsed && searchQuery === '') {
                items.push({ type: 'empty-state', label: t('sidebar.noChats') });
            }

            return items;
        }, [pinnedChats, recentChats, activeFolders, expandedFolders, filteredChats, isCollapsed, t, createFolder, onClearAll, chatsCount, searchQuery]);

        const renderItem = useCallback((_index: number, item: SidebarListItem) => {
            switch (item.type) {
                case 'header':
                    return (
                        <div className="flex items-center justify-between px-2 py-1 mt-2 first:mt-0">
                            <p className="text-xxs font-semibold text-muted-foreground/50 flex items-center gap-1 uppercase tracking-wider">
                                {item.icon && <item.icon className="w-2.5 h-2.5" />}
                                {item.label}
                            </p>
                            {item.action && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); item.action?.onClick(); }}
                                    className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
                                    title={item.action.label}
                                >
                                    <item.action.icon className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    );
                case 'chat':
                    return (
                        <div className={item.isIndented ? "ml-3 pl-2 border-l border-border/20" : ""}>
                            {renderChatItem(item.chat)}
                        </div>
                    );
                case 'folder':
                    return (
                        <SidebarItem
                            icon={item.isExpanded ? FolderOpen : FolderIcon}
                            label={item.folder.name}
                            onClick={() => toggleFolder(item.folder.id)}
                            badge={item.count}
                            className="py-1.5 font-medium"
                            isCollapsed={isCollapsed}
                            actions={(
                                <button
                                    onClick={e => { e.stopPropagation(); deleteFolder(item.folder.id); }}
                                    className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                        />
                    );
                case 'empty-state':
                    return (
                        <div className="flex flex-col items-center justify-center py-4 px-2 text-muted-foreground/30 overflow-hidden w-full">
                            {item.label === t('sidebar.noChats') && <MessageSquare className="w-6 h-6 mb-2 opacity-20" />}
                            <p className="text-center text-10 italic font-medium truncate w-full">{item.label}</p>
                        </div>
                    );
                case 'divider':
                    return <div className="h-2" />;
                default:
                    return null;
            }
        }, [isCollapsed, t, toggleFolder, deleteFolder, renderChatItem]);

        return (
            <div className="flex flex-col h-full overflow-x-hidden overflow-y-hidden">
                {/* Search */}
                {!isCollapsed && (
                    <div className="px-3 pb-2 shrink-0">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                            <input
                                type="text"
                                placeholder={t('sidebar.searchChats')}
                                value={searchQuery}
                                onChange={onSearchChange}
                                className="w-full rounded-lg border border-border/40 bg-muted/30 py-2 pl-8 pr-3 text-xs font-medium outline-none transition-colors focus:border-primary/50"
                            />
                        </div>
                    </div>
                )}

                {/* Virtualized List */}
                <div className="flex-1 min-h-0">
                    <Virtuoso
                        data={flattenedItems}
                        itemContent={renderItem}
                        className="scrollbar-thin scrollbar-thumb-border/30 px-2 overflow-x-hidden"
                        followOutput="auto"
                        atBottomThreshold={60}
                    />
                </div>
            </div>
        );
    }
);

SidebarChatList.displayName = 'SidebarChatList';
