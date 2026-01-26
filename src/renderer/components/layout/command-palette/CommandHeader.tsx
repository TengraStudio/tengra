import { Command, Search, X } from 'lucide-react';
import React from 'react';

interface CommandHeaderProps {
    search: string;
    setSearch: (val: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onClose: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
    t: (key: string) => string;
}

export const CommandHeader: React.FC<CommandHeaderProps> = ({
    search, setSearch, onKeyDown, onClose, inputRef, t
}) => {
    return (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <Search className="w-5 h-5 text-foreground/40" />
            <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('commandPalette.searchPlaceholder')}
                className="flex-1 bg-transparent text-foreground placeholder-foreground/40 outline-none text-sm"
            />
            <div className="flex items-center gap-1 text-foreground/30 text-[10px] uppercase font-bold tracking-widest border border-white/10 px-1.5 py-0.5 rounded bg-white/5">
                <Command className="w-3 h-3" />
                <span>K</span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-foreground/40 hover:text-foreground/80 transition-colors">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
