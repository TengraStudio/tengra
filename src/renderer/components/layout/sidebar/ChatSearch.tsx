/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconFolderPlus, IconSearch } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';

/* Batch-02: Extracted Long Classes */
const C_CHATSEARCH_1 = "absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors";
const C_CHATSEARCH_2 = "w-full border border-border/30 bg-muted/20 focus:border-primary/50 focus:bg-muted/30 typo-caption rounded-lg pl-8 pr-3 py-2 outline-none transition-all font-medium placeholder:text-muted-foreground/50";
const C_CHATSEARCH_3 = "w-full h-7 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/40 justify-start px-2";



interface ChatSearchProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    setIsCreatingFolder: (show: boolean) => void;
    t: (key: string) => string;
}

export const ChatSearch: React.FC<ChatSearchProps> = ({
    searchQuery,
    setSearchQuery,
    setIsCreatingFolder,
    t,
}) => {
    return (
        <div className="space-y-2 px-3 pb-2">
            <div className="relative group">
                <IconSearch className={C_CHATSEARCH_1} />
                <input
                    type="text"
                    placeholder={t('frontend.sidebar.searchChats')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={C_CHATSEARCH_2}
                />
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreatingFolder(true)}
                className={C_CHATSEARCH_3}
            >
                <IconFolderPlus className="w-3.5 h-3.5 mr-2" />
                {t('frontend.sidebar.newFolder')}
            </Button>
        </div>
    );
};

ChatSearch.displayName = 'ChatSearch';

