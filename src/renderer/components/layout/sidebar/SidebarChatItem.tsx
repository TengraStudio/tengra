import { SidebarItem } from '@renderer/components/layout/sidebar/SidebarItem';
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
    // editValue and setEditValue removed from props
    saveEdit: () => void;
    startEdit: (id: string, title: string) => void;
    togglePin: (id: string, pinned: boolean) => void;
    deleteChat: (id: string) => void;
    onSelect: (id: string) => void;
    editRef: React.RefObject<HTMLInputElement>;
    cancelEdit: () => void;
}

export const SidebarChatItem = React.memo(
    ({
        chat,
        isActive,
        isCollapsed,
        isEditing,
        // editValue removed
        // setEditValue removed
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
                />

                {!isEditing && !isCollapsed && (
                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2 bg-card border border-border/50 shadow-sm rounded-md px-1 py-0.5">
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                startEdit(chat.id, chat.title);
                            }}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground pointer-events-auto"
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                togglePin(chat.id, !chat.isPinned);
                            }}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground pointer-events-auto"
                        >
                            <Pin className={cn('w-3 h-3', chat.isPinned && 'fill-current')} />
                        </button>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                deleteChat(chat.id);
                            }}
                            className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground pointer-events-auto"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {isEditing && (
                    <SidebarItem icon={MessageSquare} label="" isCollapsed={isCollapsed}>
                        <input
                            ref={editRef}
                            defaultValue={chat.title} // Uncontrolled
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
                            className="absolute inset-0 bg-background/90 px-2 py-1 text-sm outline-none rounded focus-visible:ring-1 focus-visible:ring-primary"
                        />
                    </SidebarItem>
                )}
            </div>
        );
    }
);

SidebarChatItem.displayName = 'SidebarChatItem';
