import { CornerUpRight, Folder as FolderIcon, MessageSquare, Pin, Trash2 } from 'lucide-react'
import React, { memo } from 'react'

import { cn } from '@/lib/utils'
import { Chat, Folder } from '@/types'

interface ChatListItemProps {
    chat: Chat;
    currentChatId: string | null;
    isGenerating: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onTogglePin: (id: string, pinned: boolean) => void;
    onMoveToFolder?: (chatId: string, folderId: string | null) => void;
    folders?: Folder[];
    t: (key: string) => string;
}

export const ChatListItem = memo<ChatListItemProps>(({
    chat, currentChatId, isGenerating, onSelect, onDelete, onTogglePin,
    onMoveToFolder, folders, t
}) => {
    const isActive = currentChatId === chat.id

    return (
        <div className="relative group chat-item">
            <button
                onClick={() => onSelect(chat.id)}
                className={cn(
                    "w-full flex items-center gap-3 rounded-md transition-all duration-200 text-left px-3 py-2",
                    isActive
                        ? "bg-gradient-to-r from-primary/10 to-transparent text-primary border-l-2 border-primary"
                        : "text-muted-foreground/80 hover:bg-muted/10 hover:text-foreground border-l-2 border-transparent"
                )}
            >
                <div className="relative">
                    <MessageSquare className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "opacity-50")} />
                    {isGenerating && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                    )}
                </div>
                <span className="truncate text-xs flex-1 font-medium">{chat.title || t('sidebar.newChat')}</span>
            </button>

            <div className="opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-l from-background to-transparent pl-2">
                {onMoveToFolder && folders && folders.length > 0 && (
                    <div className="relative group/folder pointer-events-auto">
                        <div className="p-1 hover:text-primary rounded-md cursor-pointer"><CornerUpRight className="w-3 h-3" /></div>
                        <div className="hidden group-hover/folder:block absolute right-0 top-full z-50 w-32 py-1 bg-card border border-border/40 rounded-md shadow-xl -mt-1">
                            {folders.map(f => (
                                <div key={f.id} onClick={(e) => { e.stopPropagation(); onMoveToFolder(chat.id, f.id); }} className="px-2 py-1.5 hover:bg-primary/20 hover:text-primary cursor-pointer text-xs truncate flex items-center gap-2">
                                    <FolderIcon className="w-3 h-3 opacity-50" /> {f.name}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div onClick={(e) => { e.stopPropagation(); onTogglePin(chat.id, !chat.isPinned); }} className="p-1 hover:text-primary rounded-md cursor-pointer pointer-events-auto">
                    <Pin className={cn("w-3 h-3", chat.isPinned && "fill-current")} />
                </div>
                <div onClick={(e) => { e.stopPropagation(); onDelete(chat.id); }} className="p-1 hover:text-destructive rounded-md cursor-pointer pointer-events-auto">
                    <Trash2 className="w-3 h-3" />
                </div>
            </div>
        </div>
    )
})
