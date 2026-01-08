import { memo } from 'react';
import { Search, X } from 'lucide-react';

interface ChatHeaderProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    t: (key: string) => string;
}

/**
 * ChatHeader Component
 * 
 * Provides a search bar to filter messages within the current chat.
 */
export const ChatHeader = memo(({
    searchTerm,
    setSearchTerm,
    t
}: ChatHeaderProps) => {
    return (
        <div className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-background/30 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                        type="text"
                        placeholder={t('chat.searchMessages')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:border-primary/30 transition-all placeholder:text-muted-foreground/30"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-foreground text-muted-foreground/40"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});
