import { Pin, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { EditorTab } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { EditorTabContextMenu } from './EditorTabContextMenu';

interface EditorTabsProps {
    openTabs: EditorTab[];
    activeTabId: string | null;
    setActiveTabId: (id: string | null) => void;
    closeTab: (id: string) => void;
    togglePinTab: (id: string) => void;
    closeAllTabs: () => void;
    closeTabsToRight: (id: string) => void;
    closeOtherTabs: (id: string) => void;
    copyTabAbsolutePath: (id: string) => Promise<void>;
    copyTabRelativePath: (id: string) => Promise<void>;
    revealTabInExplorer: (id: string) => Promise<void>;
    t: (key: string) => string;
}

interface TabContextMenuState {
    tabId: string;
    x: number;
    y: number;
}

function sortTabsForDisplay(tabs: EditorTab[]): EditorTab[] {
    const pinnedTabs = tabs.filter(tab => tab.isPinned);
    const regularTabs = tabs.filter(tab => !tab.isPinned);
    return [...pinnedTabs, ...regularTabs];
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
    togglePinTab,
    closeAllTabs,
    closeTabsToRight,
    closeOtherTabs,
    copyTabAbsolutePath,
    copyTabRelativePath,
    revealTabInExplorer,
    t,
}) => {
    const [contextMenu, setContextMenu] = useState<TabContextMenuState | null>(null);
    const orderedTabs = useMemo(() => sortTabsForDisplay(openTabs), [openTabs]);
    const contextTab = useMemo(
        () => orderedTabs.find(tab => tab.id === contextMenu?.tabId) ?? null,
        [contextMenu?.tabId, orderedTabs]
    );

    useEffect(() => {
        if (!contextMenu) {
            return;
        }
        const closeMenu = () => {
            setContextMenu(null);
        };
        window.addEventListener('mousedown', closeMenu);
        window.addEventListener('resize', closeMenu);
        return () => {
            window.removeEventListener('mousedown', closeMenu);
            window.removeEventListener('resize', closeMenu);
        };
    }, [contextMenu]);

    const contextTabIndex = contextTab
        ? orderedTabs.findIndex(tab => tab.id === contextTab.id)
        : -1;
    const canCloseAll = orderedTabs.some(tab => !tab.isPinned);
    const canCloseOthers = contextTab
        ? orderedTabs.some(tab => tab.id !== contextTab.id && !tab.isPinned)
        : false;
    const canCloseToRight =
        contextTabIndex >= 0 &&
        orderedTabs.slice(contextTabIndex + 1).some(tab => !tab.isPinned);

    const runMenuAction = (action: () => void | Promise<void>) => {
        setContextMenu(null);
        void action();
    };
    const confirmCloseTabs = (tabsToClose: EditorTab[]): boolean => {
        const dirtyTabs = tabsToClose.filter(tab => tab.content !== tab.savedContent);
        if (dirtyTabs.length === 0) {
            return true;
        }
        appLogger.warn(
            'EditorTabs',
            t('workspace.unsavedTabsWarning')
        );
        return false;
    };

    return (
        <div className="flex bg-background overflow-x-auto border-b border-border/30 scrollbar-none">
            {orderedTabs.map(tab => {
                const isActive = tab.id === activeTabId;
                const isDirty = tab.content !== tab.savedContent;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        onContextMenu={event => {
                            event.preventDefault();
                            setContextMenu({ tabId: tab.id, x: event.clientX, y: event.clientY });
                        }}
                        className={cn(
                            'group flex items-center gap-2 px-3 py-2 typo-caption border-r border-border/30 transition-all tw-min-w-120 tw-max-w-200',
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
                        {tab.isPinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                        {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-warning" />}
                        <span
                            onClick={event => {
                                event.stopPropagation();
                                if (!confirmCloseTabs([tab])) {
                                    return;
                                }
                                closeTab(tab.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded-sm hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    </button>
                );
            })}
            {contextMenu && contextTab && (
                <EditorTabContextMenu
                    position={{ x: contextMenu.x, y: contextMenu.y }}
                    isPinned={Boolean(contextTab.isPinned)}
                    canCloseAll={canCloseAll}
                    canCloseOthers={canCloseOthers}
                    canCloseToRight={canCloseToRight}
                    onPinToggle={() => runMenuAction(() => togglePinTab(contextTab.id))}
                    onCloseTab={() =>
                        runMenuAction(() => {
                            if (confirmCloseTabs([contextTab])) {
                                closeTab(contextTab.id);
                            }
                        })
                    }
                    onCloseAll={() =>
                        runMenuAction(() => {
                            const closableTabs = orderedTabs.filter(tab => !tab.isPinned);
                            if (confirmCloseTabs(closableTabs)) {
                                closeAllTabs();
                            }
                        })
                    }
                    onCloseToRight={() =>
                        runMenuAction(() => {
                            const contextIndex = orderedTabs.findIndex(tab => tab.id === contextTab.id);
                            const closableTabs = orderedTabs
                                .slice(contextIndex + 1)
                                .filter(tab => !tab.isPinned);
                            if (confirmCloseTabs(closableTabs)) {
                                closeTabsToRight(contextTab.id);
                            }
                        })
                    }
                    onCloseOthers={() =>
                        runMenuAction(() => {
                            const closableTabs = orderedTabs.filter(
                                tab => tab.id !== contextTab.id && !tab.isPinned
                            );
                            if (confirmCloseTabs(closableTabs)) {
                                closeOtherTabs(contextTab.id);
                            }
                        })
                    }
                    onCopyPath={() => runMenuAction(() => copyTabAbsolutePath(contextTab.id))}
                    onCopyRelativePath={() =>
                        runMenuAction(() => copyTabRelativePath(contextTab.id))
                    }
                    onRevealInExplorer={() =>
                        runMenuAction(() => revealTabInExplorer(contextTab.id))
                    }
                    onClose={() => setContextMenu(null)}
                    t={t}
                />
            )}
        </div>
    );
};
