import { SidebarItem } from '@renderer/components/layout/sidebar/SidebarItem';
import { Folder as FolderIcon, FolderOpen, Trash2 } from 'lucide-react';
import React from 'react';

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
                icon={isExpanded ? FolderOpen : FolderIcon}
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
                        <Trash2 className="w-3 h-3" />
                    </button>
                )}
            />

            {isExpanded && (
                <div className="ml-3 pl-2 border-l border-border/30 space-y-0.5 mt-0.5">
                    {folderChats.map(chat => renderChatItem(chat))}
                    {folderChats.length === 0 && (
                        <p className="text-xxs text-muted-foreground/50 py-1 px-2 italic">{t('sidebar.emptyFolder')}</p>
                    )}
                </div>
            )}
        </div>
    );
});

SidebarFolderSection.displayName = 'SidebarFolderSection';
