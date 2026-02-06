import { CommandItem } from '@renderer/components/layout/CommandPalette';
import { Search } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface ResultsListProps {
    groupedCommands: Record<string, CommandItem[]>;
    categoryLabels: Record<string, string>;
    selectedIndex: number;
    setSelectedIndex: (id: string) => void;
    getFlatIndex: () => number;
    noResults: boolean;
    t: (key: string) => string;
}

export const ResultsList: React.FC<ResultsListProps> = ({
    groupedCommands, categoryLabels, selectedIndex, setSelectedIndex, getFlatIndex, noResults, t
}) => {
    return (
        <div className="flex-1 overflow-y-auto py-2 border-r border-white/5 custom-scrollbar">
            {Object.entries(groupedCommands).map(([category, items]) => (
                <div key={category}>
                    <div className="px-4 py-1.5 text-xxs font-bold text-foreground/20 uppercase tracking-widest">
                        {categoryLabels[category]}
                    </div>
                    {items.map((cmd) => {
                        const flatIdx = getFlatIndex();
                        const isSelected = flatIdx === selectedIndex;
                        return (
                            <button
                                key={cmd.id}
                                onClick={cmd.action}
                                onMouseEnter={() => setSelectedIndex(cmd.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2 text-left transition-all duration-150",
                                    isSelected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                )}
                            >
                                <span className={cn("p-1.5 rounded-lg transition-colors", isSelected ? "bg-white/20" : "bg-muted/10")}>
                                    {cmd.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{cmd.label}</div>
                                    {cmd.description && (
                                        <div className={cn("text-xxs truncate", isSelected ? "text-primary-foreground/70" : "text-muted-foreground/50")}>
                                            {cmd.description}
                                        </div>
                                    )}
                                </div>
                                {cmd.shortcut && (
                                    <kbd className={cn("px-1.5 py-0.5 text-xxxs font-bold rounded border", isSelected ? "bg-white/20 border-white/20 text-foreground" : "bg-white/5 border-white/10 text-foreground/30")}>
                                        {cmd.shortcut}
                                    </kbd>
                                )}
                            </button>
                        );
                    })}
                </div>
            ))}

            {noResults && (
                <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted/10 flex items-center justify-center mb-4">
                        <Search className="w-6 h-6 text-muted-foreground/20" />
                    </div>
                    <div className="text-foreground font-semibold mb-1">{t('commandPalette.noResults')}</div>
                    <div className="text-muted-foreground/50 text-xs">{t('commandPalette.noResultsHint')}</div>
                </div>
            )}
        </div>
    );
};
