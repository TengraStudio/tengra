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
    search,
    setSearch,
    onKeyDown,
    onClose,
    inputRef,
    t,
}) => {
    return (
        <div className="tengra-command-header">
            <Search className="tengra-command-header__search-icon" />
            <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('commandPalette.searchPlaceholder')}
                className="tengra-command-header__input"
            />
            <div className="tengra-command-header__hint">
                <Command className="w-3 h-3" />
                <span>{t('commandPalette.searchKeyHint')}</span>
            </div>
            <button
                onClick={onClose}
                className="tengra-command-header__close"
                aria-label={t('common.close')}
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

CommandHeader.displayName = 'CommandHeader';
