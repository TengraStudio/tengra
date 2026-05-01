/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconFolder as FolderIcon, IconFolderOpen, IconTrash } from '@tabler/icons-react';
import React from 'react';

import { SidebarItem } from '@/components/layout/sidebar/SidebarItem';
import { useTranslation } from '@/i18n';
import { Chat, Folder } from '@/types';

interface SidebarFolderSectionProps {
    folder: Folder
    isExpanded: boolean
    folderChats: Chat[]
    isCollapsed: boolean
    toggleFolder: (id: string) => void
    deleteFolder: (id: string) => void
    renderChatItem: (chat: Chat) => React.ReactNode
}

export const SidebarFolderSection = React.memo(({
    folder,
    isExpanded,
    folderChats,
    isCollapsed,
    toggleFolder,
    deleteFolder,
    renderChatItem
}: SidebarFolderSectionProps) => {
    const { t } = useTranslation();

    return (
        <div>
            <SidebarItem
                icon={isExpanded ? IconFolderOpen : FolderIcon}
                label={folder.name}
                onClick={() => toggleFolder(folder.id)}
                badge={folderChats.length}
                className="py-1.5 font-medium"
                isCollapsed={isCollapsed}
                actions={(
                    <button
                        onClick={e => { e.stopPropagation(); deleteFolder(folder.id); }}
                        className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground"
                    >
                        <IconTrash className="w-3 h-3" />
                    </button>
                )}
            />

            {isExpanded && (
                <div className="ml-3 pl-2 border-l border-border/30 space-y-0.5 mt-0.5">
                    {folderChats.map(chat => (
                        <div key={chat.id} className="animate-in fade-in slide-in-from-left-1 duration-200 fill-mode-backwards">
                            {renderChatItem(chat)}
                        </div>
                    ))}
                    {folderChats.length === 0 && (
                        <p className="text-sm text-muted-foreground/50 py-1 px-2">{t('frontend.sidebar.emptyFolder')}</p>
                    )}
                </div>
            )}
        </div>
    );
});

SidebarFolderSection.displayName = 'SidebarFolderSection';
