import { TerminalSquare, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';

type TerminalTabsBarProps = {
    tabs: TerminalTab[];
    activeTabId: string | null;
    draggingTabId: string | null;
    dragOverTabId: string | null;
    onSelectTab: (tabId: string) => void;
    onCloseTab: (tabId: string) => void;
    onTabDragStart: (event: React.DragEvent<HTMLButtonElement>, tabId: string) => void;
    onTabDragOver: (event: React.DragEvent<HTMLButtonElement>, tabId: string) => void;
    onTabDrop: (event: React.DragEvent<HTMLButtonElement>, tabId: string) => void;
    onTabDragEnd: () => void;
};

export function TerminalTabsBar({
    tabs,
    activeTabId,
    draggingTabId,
    dragOverTabId,
    onSelectTab,
    onCloseTab,
    onTabDragStart,
    onTabDragOver,
    onTabDrop,
    onTabDragEnd,
}: TerminalTabsBarProps) {
    return (
        <div className="flex-1 flex items-center gap-1 overflow-x-auto custom-scrollbar no-thumb min-w-0 mr-2">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    draggable
                    onClick={() => {
                        onSelectTab(tab.id);
                    }}
                    onDragStart={event => {
                        onTabDragStart(event, tab.id);
                    }}
                    onDragOver={event => {
                        onTabDragOver(event, tab.id);
                    }}
                    onDrop={event => {
                        onTabDrop(event, tab.id);
                    }}
                    onDragEnd={onTabDragEnd}
                    className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap border border-transparent min-w-[100px] max-w-[200px] flex-shrink-0',
                        activeTabId === tab.id
                            ? 'bg-accent text-foreground border-border shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                        draggingTabId === tab.id && 'opacity-60',
                        dragOverTabId === tab.id &&
                            draggingTabId !== tab.id &&
                            'border-primary/70'
                    )}
                >
                    <TerminalSquare
                        className={cn(
                            'w-3.5 h-3.5 flex-shrink-0',
                            activeTabId === tab.id ? 'text-primary' : 'opacity-70'
                        )}
                    />
                    <span className="truncate flex-1 text-left">{tab.name}</span>
                    <div
                        onClick={event => {
                            event.stopPropagation();
                            onCloseTab(tab.id);
                        }}
                        className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    >
                        <X className="w-3 h-3" />
                    </div>
                </button>
            ))}
        </div>
    );
}
