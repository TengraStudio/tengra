/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { SidebarChatItem } from '@/components/layout/sidebar/SidebarChatItem';
import { SidebarChatList } from '@/components/layout/sidebar/SidebarChatList';
import { SidebarFooter } from '@/components/layout/sidebar/SidebarFooter';
import { SidebarHeader } from '@/components/layout/sidebar/SidebarHeader';
import { SidebarNavigation } from '@/components/layout/sidebar/SidebarNavigation';
import { Modal } from '@/components/ui/modal';
import { useChatLibrary, useChatShell } from '@/context/ChatContext'; 
import { AppView } from '@/hooks/useAppState';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Chat } from '@/types';


const PromptManagerModal = lazy(() =>
    import('@/features/prompts/components/PromptManagerModal').then(module => ({ default: module.PromptManagerModal }))
);

interface SidebarProps {
    isCollapsed: boolean
    toggleSidebar: () => void
    currentView: AppView
    onChangeView: (view: AppView) => void
    onSearch: (query: string) => void
}

const SidebarHeaderConnector: React.FC<Pick<SidebarProps, 'isCollapsed' | 'onChangeView'>> = ({
    isCollapsed,
    onChangeView,
}) => {
    const { t } = useTranslation();
    const { createNewChat } = useChatShell();

    return (
        <SidebarHeader
            isCollapsed={isCollapsed}
            newChatLabel={t('frontend.sidebar.newChat')}
            onClickNewChat={() => {
                onChangeView('chat');
                createNewChat();
            }}
        />
    );
};

const SidebarNavigationConnector: React.FC<Pick<SidebarProps, 'currentView' | 'onChangeView' | 'isCollapsed'>> = ({
    currentView,
    onChangeView,
    isCollapsed,
}) => {
    const { t } = useTranslation();
    const { chatsCount } = useChatShell();

    return (
        <SidebarNavigation
            currentView={currentView}
            onChangeView={onChangeView}
            isCollapsed={isCollapsed}
            chatsCount={chatsCount}
            t={t}
        />
    );
};

const SidebarChatSection: React.FC<Pick<SidebarProps, 'currentView' | 'onChangeView' | 'isCollapsed' | 'onSearch'>> = ({
    currentView,
    onChangeView,
    isCollapsed,
    onSearch,
}) => {
    const {
        chats, currentChatId, setCurrentChatId, deleteChat, updateChat,
        folders, createFolder, deleteFolder,
        prompts, createPrompt, updatePrompt, deletePrompt, togglePin, bulkDeleteChats
    } = useChatLibrary();
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showPrompts, setShowPrompts] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const editRef = useRef<HTMLInputElement>(null);
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const chatSearchIndex = useMemo(() => {
        const index = new Map<string, string>();
        for (const chat of chats) {
            index.set(chat.id, chat.title.toLowerCase());
        }
        return index;
    }, [chats]);
    const normalizedSearchQuery = useMemo(() => deferredSearchQuery.trim().toLowerCase(), [deferredSearchQuery]);
    const filteredChats = useMemo(() => {
        if (normalizedSearchQuery === '') {
            return chats;
        }
        return chats.filter(chat => (chatSearchIndex.get(chat.id) ?? '').includes(normalizedSearchQuery));
    }, [chatSearchIndex, chats, normalizedSearchQuery]);
    const { pinnedChats, recentChats } = useMemo(() => {
        const pinned: Chat[] = [];
        const recent: Chat[] = [];
        for (const chat of filteredChats) {
            if (chat.isPinned) {
                pinned.push(chat);
                continue;
            }
            if (!chat.folderId && recent.length < 20) {
                recent.push(chat);
            }
        }
        return { pinnedChats: pinned, recentChats: recent };
    }, [filteredChats]);

    useEffect(() => {
        if (editingId && editRef.current) {
            editRef.current.focus();
            editRef.current.select();
        }
    }, [editingId]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        onSearch(e.target.value);
    }, [onSearch]);
    const startEdit = useCallback((id: string, _title: string) => {
        setEditingId(id);
    }, []);
    const saveEdit = useCallback(() => {
        if (editingId && editRef.current?.value.trim()) {
            void updateChat(editingId, { title: editRef.current.value.trim() });
        }
        setEditingId(null);
    }, [editingId, updateChat]);
    const renderChatItem = useCallback((chat: Chat) => (
        <SidebarChatItem
            key={chat.id}
            chat={chat}
            isActive={currentView === 'chat' && currentChatId === chat.id}
            isCollapsed={isCollapsed}
            isEditing={editingId === chat.id}
            saveEdit={saveEdit}
            startEdit={startEdit}
            togglePin={(id, pinned) => { void togglePin(id, pinned); }}
            deleteChat={(id) => { void deleteChat(id); }}
            onSelect={(id) => { onChangeView('chat'); void setCurrentChatId(id); }}
            editRef={editRef}
            cancelEdit={() => setEditingId(null)}
        />
    ), [currentView, currentChatId, isCollapsed, editingId, saveEdit, startEdit, togglePin, deleteChat, onChangeView, setCurrentChatId]);
    const handleClearAll = useCallback(() => {
        if (chats.length > 0) {
            setShowClearConfirm(true);
        }
    }, [chats.length]);
    const confirmClearAll = useCallback(() => {
        const ids = chats.map(chat => chat.id);
        void bulkDeleteChats(ids);
        setShowClearConfirm(false);
    }, [bulkDeleteChats, chats]);

    return (
        <>
            <SidebarChatList
                isCollapsed={isCollapsed}
                searchQuery={searchQuery}
                onSearchChange={handleSearch}
                pinnedChats={pinnedChats}
                activeFolders={folders}
                expandedFolders={expandedFolders}
                filteredChats={filteredChats}
                recentChats={recentChats}
                chatsCount={chats.length}
                t={t}
                toggleFolder={(id: string) => setExpandedFolders(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) {
                        next.delete(id);
                    } else {
                        next.add(id);
                    }
                    return next;
                })}
                deleteFolder={(id) => { void deleteFolder(id); }}
                createFolder={(name) => { void createFolder(name); }}
                renderChatItem={renderChatItem}
                onClearAll={handleClearAll}
            />

            {showPrompts && (
                <Suspense fallback={null}>
                    <PromptManagerModal
                        isOpen={showPrompts}
                        onClose={() => setShowPrompts(false)}
                        prompts={prompts}
                        onCreatePrompt={(title, content) => { void createPrompt(title, content); }}
                        onUpdatePrompt={(id, prompt) => { void updatePrompt(id, prompt); }}
                        onDeletePrompt={(id) => { void deletePrompt(id); }}
                    />
                </Suspense>
            )}

            <Modal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                title={t('frontend.sidebar.clearHistory')}
                footer={(
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowClearConfirm(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={confirmClearAll}
                            className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            {t('common.delete')}
                        </button>
                    </div>
                )}
            >
                <p className="text-sm text-muted-foreground">
                    {t('frontend.sidebar.confirmClearAll')}
                </p>
            </Modal>
        </>
    );
};

/**
 * Main application sidebar with navigation, chat list, and footer controls.
 */
export const Sidebar = React.memo(({
    isCollapsed,
    toggleSidebar,
    currentView,
    onChangeView,
    onSearch
}: SidebarProps) => { 
    const { t } = useTranslation();

    return (
        <>
            <aside
                data-testid="sidebar"
                aria-label={t('frontend.aria.applicationSidebar')}
                className={cn(
                    'flex h-full flex-col overflow-hidden border-r border-border/40 bg-card/80 backdrop-blur-sm transition-width duration-300 ease-out',
                    isCollapsed ? 'w-20' : 'w-full'
                )}>
                <SidebarHeaderConnector
                    isCollapsed={isCollapsed}
                    onChangeView={onChangeView}
                />

                <SidebarNavigationConnector
                    currentView={currentView}
                    onChangeView={onChangeView}
                    isCollapsed={isCollapsed}
                />

                <div className="mx-3 my-2 h-px bg-border/40" />

                <SidebarChatSection
                    isCollapsed={isCollapsed}
                    currentView={currentView}
                    onChangeView={onChangeView}
                    onSearch={onSearch}
                />

                <SidebarFooter
                    isCollapsed={isCollapsed} 
                    toggleSidebar={toggleSidebar}
                    t={t}
                />
            </aside>
        </>
    );
});
Sidebar.displayName = 'Sidebar';

