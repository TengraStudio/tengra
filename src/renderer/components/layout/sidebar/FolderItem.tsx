/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChatListItem } from '@renderer/components/layout/sidebar/ChatListItem';
import { Edit2, FolderIcon, FolderOpen, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Chat, Folder } from '@/types';

interface FolderItemProps {
    folder: Folder;
    chats: Chat[];
    expanded: boolean;
    onToggle: () => void;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onMoveChat: (chatId: string, folderId: string | null) => void;
    currentChatId: string | null;
    onSelectChat: (id: string) => void;
    onDeleteChat: (id: string) => void;
    onTogglePinChat: (id: string, pinned: boolean) => void;
    isGenerating: (chat: Chat) => boolean;
    t: (key: string) => string;
}

export const FolderItem: React.FC<FolderItemProps> = ({
    folder,
    chats,
    expanded,
    onToggle,
    onRename,
    onDelete,
    onMoveChat,
    currentChatId,
    onSelectChat,
    onDeleteChat,
    onTogglePinChat,
    isGenerating,
    t,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(folder.name);

    const handleRename = () => {
        if (name.trim() && name !== folder.name) {
            onRename(folder.id, name.trim());
        }
        setIsEditing(false);
    };

    return (
        <div className="space-y-0.5">
            <div
                className={cn(
                    'group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/10 cursor-pointer text-muted-foreground hover:text-foreground',
                    expanded && 'text-foreground'
                )}
                onClick={onToggle}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {expanded ? (
                        <FolderOpen className="w-3.5 h-3.5 text-primary/70" />
                    ) : (
                        <FolderIcon className="w-3.5 h-3.5" />
                    )}
                    {isEditing ? (
                        <input
                            autoFocus
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onBlur={handleRename}
                            onKeyDown={e => e.key === 'Enter' && handleRename()}
                            className="bg-transparent border-none outline-none typo-caption font-medium w-full"
                        />
                    ) : (
                        <span className="typo-caption font-medium truncate">{folder.name}</span>
                    )}
                    <span className="text-xxs text-muted-foreground/40">{chats.length}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit2
                        className="w-3 h-3 hover:text-primary"
                        onClick={e => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }}
                    />
                    <Trash2
                        className="w-3 h-3 hover:text-destructive"
                        onClick={e => {
                            e.stopPropagation();
                            onDelete(folder.id);
                        }}
                    />
                </div>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-2 pl-2 border-l border-border/30 space-y-0.5 overflow-hidden"
                    >
                        {chats.map(chat => (
                            <ChatListItem
                                key={chat.id}
                                chat={chat}
                                currentChatId={currentChatId}
                                isGenerating={isGenerating(chat)}
                                onSelect={onSelectChat}
                                onDelete={onDeleteChat}
                                onTogglePin={onTogglePinChat}
                                onMoveToFolder={onMoveChat}
                                t={t}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

FolderItem.displayName = 'FolderItem';
