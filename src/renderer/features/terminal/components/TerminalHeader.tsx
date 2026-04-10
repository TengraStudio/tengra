import { Plus, TerminalSquare, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';

interface TerminalHeaderProps {
    tabs: TerminalTab[];
    activeTabId: string | null;
    setActiveTabId: (id: string | null) => void;
    closeTab: (id: string) => void;
    onNewTerminalClick: () => void;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    onNewTerminalClick,
}) => {
    return (
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar no-thumb">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md typo-caption font-medium transition-all whitespace-nowrap border border-transparent",
                        activeTabId === tab.id
                            ? "bg-accent text-foreground border-border shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                >
                    <TerminalSquare className={cn("w-3.5 h-3.5", activeTabId === tab.id ? "text-primary" : "opacity-70")} />
                    {tab.name}
                    <div
                        onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                        className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </div>
                </button>
            ))}

            <button
                onClick={onNewTerminalClick}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors ml-1"
            >
                <Plus className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};
