/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChevronRight, Pin, X } from 'lucide-react';
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
    workspacePath?: string;
    onOpenFile?: (path: string, line?: number) => void;
    t: (key: string) => string;
}

interface TabContextMenuState {
    tabId: string;
    x: number;
    y: number;
}

interface BreadcrumbDropdownState {
    x: number;
    y: number;
    items: Array<{ name: string; path: string; isDirectory: boolean }>;
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
    workspacePath,
    onOpenFile,
    t,
}) => {
    const [contextMenu, setContextMenu] = useState<TabContextMenuState | null>(null);
    const [deletedTabIds, setDeletedTabIds] = useState<Set<string>>(new Set());
    const [breadcrumbDropdown, setBreadcrumbDropdown] = useState<BreadcrumbDropdownState | null>(null);
    const orderedTabs = useMemo(() => sortTabsForDisplay(openTabs), [openTabs]);
    const activeTab = useMemo(
        () => orderedTabs.find(tab => tab.id === activeTabId) ?? null,
        [activeTabId, orderedTabs]
    );
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

    useEffect(() => {
        if (!breadcrumbDropdown) {
            return;
        }
        const closeDropdown = () => setBreadcrumbDropdown(null);
        window.addEventListener('mousedown', closeDropdown);
        window.addEventListener('resize', closeDropdown);
        return () => {
            window.removeEventListener('mousedown', closeDropdown);
            window.removeEventListener('resize', closeDropdown);
        };
    }, [breadcrumbDropdown]);

    useEffect(() => {
        let cancelled = false;
        const checkDeletedTabs = async () => {
            const nextDeleted = new Set<string>();
            await Promise.all(
                orderedTabs.map(async tab => {
                    try {
                        const result = await window.electron.files.readFile(tab.path);
                        if (result.success) {
                            return;
                        }
                        const errorText = String(result.error ?? '').toLowerCase();
                        if (
                            errorText.includes('enoent')
                            || errorText.includes('not found')
                            || errorText.includes('no such file')
                        ) {
                            nextDeleted.add(tab.id);
                        }
                    } catch {
                        // Ignore read failures that are not explicit missing-file errors.
                    }
                })
            );
            if (!cancelled) {
                setDeletedTabIds(nextDeleted);
            }
        };
        void checkDeletedTabs();
        return () => {
            cancelled = true;
        };
    }, [orderedTabs]);

    const buildBreadcrumbSegments = (tabPath: string): Array<{ label: string; path: string; isFile: boolean }> => {
        const separator = tabPath.includes('\\') ? '\\' : '/';
        const parts = tabPath.split(/[\\/]+/).filter(Boolean);
        return parts.map((label, index) => ({
            label,
            path: parts.slice(0, index + 1).join(separator),
            isFile: index === parts.length - 1,
        }));
    };

    const resolveBreadcrumbPath = (rawPath: string): string => {
        const isAbsolute = /^[a-z]:[\\/]/i.test(rawPath) || rawPath.startsWith('/') || rawPath.startsWith('\\');
        if (isAbsolute || !workspacePath) {
            return rawPath;
        }
        const separator = workspacePath.includes('\\') ? '\\' : '/';
        const normalizedRoot = workspacePath.replace(/[\\/]+$/, '');
        return `${normalizedRoot}${separator}${rawPath}`;
    };

    const openBreadcrumbPath = (rawPath: string): void => {
        const resolvedPath = resolveBreadcrumbPath(rawPath);
        const encodedPath = encodeURIComponent(resolvedPath);
        void window.electron.openExternal(`safe-file://${encodedPath}`);
    };

    const openFolderDropdown = async (
        rawPath: string,
        anchorX: number,
        anchorY: number
    ): Promise<void> => {
        const resolvedPath = resolveBreadcrumbPath(rawPath);
        const response = await window.electron.files.listDirectory(resolvedPath);
        const data = Array.isArray((response as { data?: unknown }).data)
            ? ((response as { data: Array<{ name: string; path?: string; isDirectory?: boolean }> }).data)
            : Array.isArray(response)
                ? (response as Array<{ name: string; path?: string; isDirectory?: boolean }>)
                : [];
        const items = data
            .map(item => ({
                name: item.name,
                path: item.path && item.path.length > 0 ? item.path : `${resolvedPath}/${item.name}`,
                isDirectory: Boolean(item.isDirectory),
            }))
            .sort((left, right) => {
                if (left.isDirectory !== right.isDirectory) {
                    return left.isDirectory ? -1 : 1;
                }
                return left.name.localeCompare(right.name);
            })
            .slice(0, 120);
        setBreadcrumbDropdown({
            x: anchorX,
            y: anchorY,
            items,
        });
    };

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
        <div className="border-b border-border/30 bg-background">
            <div className="flex overflow-x-auto scrollbar-none">
                {orderedTabs.map(tab => {
                    const isActive = tab.id === activeTabId;
                    const isDirty = tab.content !== tab.savedContent;
                    const isDeleted = deletedTabIds.has(tab.id);
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            onContextMenu={event => {
                                event.preventDefault();
                                setContextMenu({ tabId: tab.id, x: event.clientX, y: event.clientY });
                            }}
                            className={cn(
                                'group flex items-center gap-2 px-3 py-2 typo-caption border-r border-border/30 transition-all min-w-120 max-w-200',
                                isActive
                                    ? 'bg-muted/70 text-foreground border-t-2 border-t-primary'
                                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-t-2 border-t-transparent'
                            )}
                        >
                            <span
                                className={cn(
                                    'truncate flex-1 text-left',
                                    isActive && 'font-medium',
                                    isDeleted && 'italic line-through opacity-75'
                                )}
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
            </div>
            {activeTab && (
                <div className="flex items-center gap-1 px-3 py-1.5 typo-overline text-muted-foreground/85 border-t border-border/20">
                    {buildBreadcrumbSegments(activeTab.path).map((segment, index) => (
                        <React.Fragment key={`${segment.path}:${index}`}>
                            {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/45" />}
                            <button
                                type="button"
                                onClick={event => {
                                    if (!segment.isFile) {
                                        event.stopPropagation();
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        void openFolderDropdown(segment.path, rect.left, rect.bottom + 6);
                                        return;
                                    }
                                    openBreadcrumbPath(segment.path);
                                }}
                                className={cn(
                                    'max-w-220 truncate transition-colors hover:text-foreground',
                                    segment.isFile ? 'text-foreground/90' : 'text-muted-foreground/85 hover:underline'
                                )}
                                title={segment.path}
                            >
                                {segment.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}
            {breadcrumbDropdown && (
                <div
                    className="fixed z-50 min-w-240 max-w-320 max-h-320 overflow-auto rounded-md border border-border/60 bg-popover shadow-2xl p-1"
                    style={{ left: breadcrumbDropdown.x, top: breadcrumbDropdown.y }}
                    onMouseDown={event => event.stopPropagation()}
                >
                    {breadcrumbDropdown.items.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">{t('workspaceDashboard.empty')}</div>
                    ) : (
                        breadcrumbDropdown.items.map(item => (
                            <button
                                key={item.path}
                                type="button"
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground/90 hover:bg-muted/60"
                                onClick={() => {
                                    setBreadcrumbDropdown(null);
                                    if (item.isDirectory) {
                                        openBreadcrumbPath(item.path);
                                        return;
                                    }
                                    onOpenFile?.(item.path);
                                }}
                            >
                                <span className="truncate">{item.name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
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
