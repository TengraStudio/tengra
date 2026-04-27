/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconEdit, IconMessage, IconPin, IconTrash } from '@tabler/icons-react';
import React from 'react';

import { SidebarItem } from '@/components/layout/sidebar/SidebarItem';
import { UI_PRIMITIVES } from '@/constants/ui-primitives';
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
                    icon={IconMessage}
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
                            <IconEdit className="w-3 h-3" />
                        </button>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                togglePin(chat.id, !chat.isPinned);
                            }}
                            className={UI_PRIMITIVES.ACTION_BUTTON_GHOST}
                            title={chat.isPinned ? t('common.unpin') : t('common.pin')}
                        >
                            <IconPin className={cn('w-3 h-3', chat.isPinned && 'fill-current')} />
                        </button>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                deleteChat(chat.id);
                            }}
                            className={cn(UI_PRIMITIVES.ACTION_BUTTON_GHOST, "hover:text-destructive hover:bg-destructive/10")}
                            title={t('common.delete')}
                        >
                            <IconTrash className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {isEditing && (
                    <div className={cn(UI_PRIMITIVES.ITEM_OVERLAY, "z-20")}>
                        <IconMessage className="w-4 h-4 text-primary shrink-0" />
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
