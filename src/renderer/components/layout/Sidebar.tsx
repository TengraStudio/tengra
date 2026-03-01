import { SidebarChatItem } from '@renderer/components/layout/sidebar/SidebarChatItem';
import { SidebarChatList } from '@renderer/components/layout/sidebar/SidebarChatList';
import { SidebarFooter } from '@renderer/components/layout/sidebar/SidebarFooter';
import { SidebarHeader } from '@renderer/components/layout/sidebar/SidebarHeader';
import { SidebarNavigation } from '@renderer/components/layout/sidebar/SidebarNavigation';
import { Modal } from '@renderer/components/ui/modal';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { useChat } from '@/context/ChatContext';
import { useProject } from '@/context/ProjectContext';
import { PromptManagerModal } from '@/features/prompts/components/PromptManagerModal';
import { SettingsCategory } from '@/features/settings/types';
import { AppView } from '@/hooks/useAppState';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Chat } from '@/types';

interface SidebarProps {
    isCollapsed: boolean
    toggleSidebar: () => void
    currentView: AppView
    onChangeView: (view: AppView) => void
    onOpenSettings: (category?: SettingsCategory) => void
    onSearch: (query: string) => void
}

/**
 * Main application sidebar with navigation, chat list, and footer controls.
 */
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
        prompts, createPrompt, updatePrompt, deletePrompt, togglePin, bulkDeleteChats
    } = useChat();

    // const { language: authLanguage } = useAuth() // Removed unused
    const { selectedProject } = useProject();
    const { t, language } = useTranslation();

    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showPrompts, setShowPrompts] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    // editValue state removed for performance (uncontrolled input)
    const editRef = useRef<HTMLInputElement>(null);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const activeFolders = useMemo(() => folders, [folders]);
    const chatSearchIndex = useMemo(() => {
        const index = new Map<string, string>();
        for (const chat of chats) {
            index.set(chat.id, chat.title.toLowerCase());
        }
        return index;
    }, [chats]);
    const normalizedSearchQuery = useMemo(
        () => deferredSearchQuery.trim().toLowerCase(),
        [deferredSearchQuery]
    );

    const filteredChats = useMemo(() => {
        if (normalizedSearchQuery === '') {
            return chats;
        }
        return chats.filter(chat =>
            (chatSearchIndex.get(chat.id) ?? '').includes(normalizedSearchQuery)
        );
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
        // No need to set editValue, input uses defaultValue
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
            // editValue removed
            // setEditValue removed
            saveEdit={saveEdit}
            startEdit={startEdit}
            togglePin={(id, p) => { void togglePin(id, p); }}
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
    }, [chats]);

    const confirmClearAll = useCallback(() => {
        const ids = chats.map(c => c.id);
        void bulkDeleteChats(ids);
        setShowClearConfirm(false);
    }, [chats, bulkDeleteChats]);

    return (
        <>
            <aside
                data-testid="sidebar"
                aria-label={t('aria.applicationSidebar')}
                className={cn(
                    "flex flex-col h-full transition-all duration-300 ease-in-out bg-background",
                    isCollapsed ? "w-[70px]" : "w-full"
                )}>
                <SidebarHeader
                    isCollapsed={isCollapsed}
                    newChatLabel={t('sidebar.newChat')}
                    onClickNewChat={() => { onChangeView('chat'); void createNewChat(); }}
                />

                <SidebarNavigation
                    currentView={currentView}
                    onChangeView={onChangeView}
                    isCollapsed={isCollapsed}
                    chatsCount={chats.length}
                    t={t}
                />

                <div className="mx-3 my-2 h-px bg-border/30" />

                <SidebarChatList
                    isCollapsed={isCollapsed}
                    searchQuery={searchQuery}
                    onSearchChange={handleSearch}
                    pinnedChats={pinnedChats}
                    activeFolders={activeFolders}
                    expandedFolders={expandedFolders}
                    filteredChats={filteredChats}
                    recentChats={recentChats}
                    chatsCount={chats.length}
                    t={t}
                    toggleFolder={(id: string) => setExpandedFolders(prev => {
                        const next = new Set(prev);
                        if (next.has(id)) { next.delete(id); }
                        else { next.add(id); }
                        return next;
                    })}
                    deleteFolder={(id) => { void deleteFolder(id); }}
                    createFolder={(name) => { void createFolder(name); }}
                    renderChatItem={renderChatItem}
                    onClearAll={handleClearAll}
                />

                <SidebarFooter
                    isCollapsed={isCollapsed}
                    selectedProject={selectedProject}
                    currentView={currentView}
                    showSettingsMenu={showSettingsMenu}
                    toggleSettingsMenu={() => setShowSettingsMenu(!showSettingsMenu)}
                    toggleSidebar={toggleSidebar}
                    onOpenSettings={onOpenSettings}
                    t={t}
                    language={language}
                />
            </aside>

            <PromptManagerModal
                isOpen={showPrompts}
                onClose={() => setShowPrompts(false)}
                prompts={prompts}
                onCreatePrompt={(title, content) => { void createPrompt(title, content); }}
                onUpdatePrompt={(id, p) => { void updatePrompt(id, p); }}
                onDeletePrompt={(id) => { void deletePrompt(id); }}
            />

            <Modal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                title={t('sidebar.clearHistory')}
                footer={
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
                }
            >
                <p className="text-sm text-muted-foreground">
                    {t('sidebar.confirmClearAll')}
                </p>
            </Modal>
        </>
    );
});
Sidebar.displayName = 'Sidebar';
