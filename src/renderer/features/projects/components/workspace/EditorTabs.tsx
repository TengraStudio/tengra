import { X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { EditorTab } from '@/types';

interface EditorTabsProps {
    openTabs: EditorTab[];
    activeTabId: string | null;
    setActiveTabId: (id: string | null) => void;
    closeTab: (id: string) => void;
}

/**
 * EditorTabs Component
 *
 * Renders the horizontal list of open file tabs in the editor area.
 */
export const EditorTabs: React.FC<EditorTabsProps> = ({
    openTabs,
    activeTabId,
    setActiveTabId,
    closeTab,
}) => {
    return (
        <div className="flex bg-background overflow-x-auto border-b border-white/5 scrollbar-none">
            {openTabs.map(tab => {
                const isActive = tab.id === activeTabId;
                const isDirty = tab.content !== tab.savedContent;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={cn(
                            'group flex items-center gap-2 px-3 py-2 text-xs border-r border-white/5 transition-all min-w-[120px] max-w-[200px]',
                            isActive
                                ? 'bg-muted text-success border-t-2 border-t-emerald-500'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-muted-foreground border-t-2 border-t-transparent'
                        )}
                    >
                        <span
                            className={cn('truncate flex-1 text-left', isActive && 'font-medium')}
                        >
                            {tab.name}
                        </span>
                        {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-warning" />}
                        <span
                            onClick={event => {
                                event.stopPropagation();
                                closeTab(tab.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded-sm hover:bg-white/10 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
