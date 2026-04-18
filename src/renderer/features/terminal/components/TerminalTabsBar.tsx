/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AlertTriangle, TerminalSquare, X } from 'lucide-react';
import React from 'react';

import { UI_PRIMITIVES } from '@/constants/ui-primitives';
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

interface TerminalTabMetadata {
    panelType?: string;
    closable?: boolean;
}

function resolveTerminalTabMetadata(tab: TerminalTab): TerminalTabMetadata {
    if (typeof tab.metadata !== 'object' || tab.metadata === null) {
        return {};
    }
    const metadata = tab.metadata as Record<string, unknown>;
    return {
        panelType: typeof metadata.panelType === 'string' ? metadata.panelType : undefined,
        closable: typeof metadata.closable === 'boolean' ? metadata.closable : undefined,
    };
}

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
            {tabs.map(tab => {
                const metadata = resolveTerminalTabMetadata(tab);
                const isClosable = metadata.closable !== false;
                const isWorkspaceIssuesTab = metadata.panelType === 'workspace-issues';
                return (
                    <button
                        key={tab.id}
                        draggable={isClosable}
                        onClick={() => onSelectTab(tab.id)}
                        onDragStart={event => isClosable && onTabDragStart(event, tab.id)}
                        onDragOver={event => onTabDragOver(event, tab.id)}
                        onDrop={event => onTabDrop(event, tab.id)}
                        onDragEnd={onTabDragEnd}
                        className={cn(
                            UI_PRIMITIVES.TERMINAL_TAB,
                            activeTabId === tab.id
                                ? 'bg-accent text-foreground border-border shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                            draggingTabId === tab.id && 'opacity-60',
                            dragOverTabId === tab.id && draggingTabId !== tab.id && 'border-primary/70'
                        )}
                    >
                        {isWorkspaceIssuesTab ? (
                            <AlertTriangle
                                className={cn(
                                    'w-3.5 h-3.5 flex-shrink-0',
                                    activeTabId === tab.id ? 'text-warning' : 'opacity-70'
                                )}
                            />
                        ) : (
                            <TerminalSquare
                                className={cn(
                                    'w-3.5 h-3.5 flex-shrink-0',
                                    activeTabId === tab.id ? 'text-primary' : 'opacity-70'
                                )}
                            />
                        )}
                        <span className="truncate flex-1 text-left">{tab.name}</span>
                        {isClosable && (
                            <div
                                onClick={event => {
                                    event.stopPropagation();
                                    onCloseTab(tab.id);
                                }}
                                className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                            >
                                <X className="w-3 h-3" />
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
