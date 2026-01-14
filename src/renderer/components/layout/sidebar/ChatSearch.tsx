import { FolderPlus,Search } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'

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
    t
}) => {
    return (
        <div className="px-4 py-2 space-y-2">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder={t('sidebar.searchChats')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-muted/20 border border-border/40 focus:border-primary/50 focus:bg-muted/30 text-xs rounded-lg pl-8 pr-3 py-2 outline-none transition-all font-medium placeholder:text-muted-foreground/50"
                />
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreatingFolder(true)}
                className="w-full h-7 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/40 justify-start px-2"
            >
                <FolderPlus className="w-3.5 h-3.5 mr-2" />
                {t('sidebar.newFolder')}
            </Button>
        </div>
    )
}
