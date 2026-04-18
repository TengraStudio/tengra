/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SidebarItem } from '@renderer/components/layout/sidebar/SidebarItem';
import { UI_PRIMITIVES } from '@renderer/constants/ui-primitives';
import { Edit2, MessageSquare, Pin, Trash2 } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Chat } from '@/types';

interface SidebarChatItemProps {
    chat: Chat;
    isActive: boolean;
    isCollapsed: boolean;
    isEditing: boolean;
    saveEdit: () => void;
    startEdit: (id: string, title: string) => void;
    togglePin: (id: string, pinned: boolean) => void;
    deleteChat: (id: string) => void;
    onSelect: (id: string) => void;
    editRef: React.RefObject<HTMLInputElement>;
    cancelEdit: () => void;
}

/**
 * Chat item component for the sidebar history list.
 */
export const SidebarChatItem = React.memo(
    ({
        chat,
        isActive,
        isCollapsed,
        isEditing,
        saveEdit,
        startEdit,
        togglePin,
        deleteChat,
        onSelect,
        editRef,
        cancelEdit,
    }: SidebarChatItemProps) => {
        const { t } = useTranslation();

        return (
            <div className="group relative">
                <SidebarItem
                    icon={MessageSquare}
                    label={chat.title || t('sidebar.newChat')}
                    active={isActive}
                    onClick={() => onSelect(chat.id)}
                    className="py-1.5"
                    isCollapsed={isCollapsed}
                    labelClassName={chat.isGenerating ? 'animate-text-shimmer' : undefined}
                />

                {!isEditing && !isCollapsed && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                startEdit(chat.id, chat.title);
                            }}
                            className={UI_PRIMITIVES.ACTION_BUTTON_GHOST}
                            title={t('common.edit')}
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                togglePin(chat.id, !chat.isPinned);
                            }}
                            className={UI_PRIMITIVES.ACTION_BUTTON_GHOST}
                            title={chat.isPinned ? t('common.unpin') : t('common.pin')}
                        >
                            <Pin className={cn('w-3 h-3', chat.isPinned && 'fill-current')} />
                        </button>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                deleteChat(chat.id);
                            }}
                            className={cn(UI_PRIMITIVES.ACTION_BUTTON_GHOST, "hover:text-destructive hover:bg-destructive/10")}
                            title={t('common.delete')}
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {isEditing && (
                    <div className={cn(UI_PRIMITIVES.ITEM_OVERLAY, "z-20")}>
                        <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                        <input
                            ref={editRef}
                            autoFocus
                            defaultValue={chat.title}
                            onBlur={saveEdit}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    saveEdit();
                                }
                                if (e.key === 'Escape') {
                                    cancelEdit();
                                }
                            }}
                            onClick={e => e.stopPropagation()}
                            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                            placeholder={t('sidebar.renameChat')}
                        />
                    </div>
                )}
            </div>
        );
    }
);

SidebarChatItem.displayName = 'SidebarChatItem';
