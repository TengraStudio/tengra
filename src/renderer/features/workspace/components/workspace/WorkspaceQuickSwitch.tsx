import React from 'react';

import { cn } from '@/lib/utils';

export interface QuickSwitchItem {
    id: string;
    label: string;
    path?: string;
}

interface WorkspaceQuickSwitchProps {
    isOpen: boolean;
    onClose: () => void;
    items: QuickSwitchItem[];
    query: string;
    onQueryChange: (query: string) => void;
    selectedIndex: number;
    onSelectedIndexChange: (index: number | ((prev: number) => number)) => void;
    onSelect: (tabId: string) => void;
    t: (key: string) => string | undefined;
}

export const WorkspaceQuickSwitch: React.FC<WorkspaceQuickSwitchProps> = ({
    isOpen,
    onClose,
    items,
    query,
    onQueryChange,
    selectedIndex,
    onSelectedIndexChange,
    onSelect,
    t,
}) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="absolute inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-start justify-center p-8"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl rounded-xl border border-border/50 bg-background p-3 space-y-2"
                onClick={event => event.stopPropagation()}
            >
                <input
                    autoFocus
                    value={query}
                    onChange={event => onQueryChange(event.target.value)}
                    onKeyDown={event => {
                        if (items.length === 0 && event.key !== 'Escape') {
                            return;
                        }
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            onSelectedIndexChange(prev => Math.min(prev + 1, items.length - 1));
                            return;
                        }
                        if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            onSelectedIndexChange(prev => Math.max(prev - 1, 0));
                            return;
                        }
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            const selected = items[selectedIndex];
                            if (!selected) {
                                return;
                            }
                            onSelect(selected.id);
                            return;
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            onClose();
                        }
                    }}
                    placeholder={t('workspace.quickSwitch') || 'Quick switch'}
                    className="w-full rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                />
                <div className="max-h-72 overflow-y-auto space-y-1">
                    {items.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onSelect(item.id)}
                            className={cn(
                                'w-full text-left rounded-md px-3 py-2 hover:bg-muted/30 transition-colors',
                                items[selectedIndex]?.id === item.id && 'bg-muted/30'
                            )}
                        >
                            <div className="text-sm text-foreground">{item.label}</div>
                            <div className="text-xxs text-muted-foreground truncate">
                                {item.path}
                            </div>
                        </button>
                    ))}
                    {items.length === 0 && (
                        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                            {t('workspaceDashboard.noResults') || 'No results found'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
