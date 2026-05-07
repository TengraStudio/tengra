/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconPlus, IconTerminal, IconX } from '@tabler/icons-react';
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
                    <IconTerminal className={cn("w-3.5 h-3.5", activeTabId === tab.id ? "text-primary" : "opacity-70")} />
                    {tab.name}
                    <div
                        onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                        className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <IconX className="w-3 h-3" />
                    </div>
                </button>
            ))}

            <button
                onClick={onNewTerminalClick}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors ml-1"
            >
                <IconPlus className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

