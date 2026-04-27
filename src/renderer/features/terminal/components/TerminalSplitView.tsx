/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconX } from '@tabler/icons-react';
import { type MouseEventHandler, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';

import { TERMINAL_WORKSPACE_ISSUES_TAB_ID } from '../constants/terminal-panel-constants';
import type { ResolvedTerminalAppearance, TerminalAppearancePreferences } from '../types/terminal-appearance';

import { TerminalEmptyState } from './TerminalEmptyState';
import { TerminalInstance } from './TerminalInstance';

/* Batch-02: Extracted Long Classes */
const C_TERMINALSPLITVIEW_1 = "absolute top-0 inset-x-0 z-10 h-7 flex items-center justify-between px-2 bg-background/80 border-b border-border/70 backdrop-blur";


interface TerminalSplitViewProps {
    onContextMenu: MouseEventHandler<HTMLDivElement>;
    isGalleryView: boolean;
    tabs: TerminalTab[];
    activeTabId: string | null;
    splitView:
    | {
        primaryId: string;
        secondaryId: string;
    }
    | null;
    getTabLayoutClass: (tabId: string) => string;
    handlePaneActivate: (tabId: string) => void;
    closeTab: (tabId: string) => void;
    handleTabSelect: (tabId: string) => void;
    setIsGalleryView: (value: boolean) => void;
    workspacePath?: string;
    terminalAppearance: TerminalAppearancePreferences;
    resolvedTerminalAppearance: ResolvedTerminalAppearance;
    setTerminalInstance: (id: string, terminal: import('@xterm/xterm').Terminal | null) => void;
    emptyTitle: string;
    emptyActionLabel: string;
    createDefaultTerminal: () => Promise<void>;
    renderTabContent?: (tab: TerminalTab) => ReactNode | null;
}

interface TerminalTabMetadata {
    closable?: boolean;
}

function resolveTerminalTabMetadata(tab: TerminalTab): TerminalTabMetadata {
    if (typeof tab.metadata !== 'object' || tab.metadata === null) {
        return {};
    }
    const metadata = tab.metadata as Record<string, RendererDataValue>;
    return {
        closable: typeof metadata.closable === 'boolean' ? metadata.closable : undefined,
    };
}

export function TerminalSplitView({
    onContextMenu,
    isGalleryView,
    tabs,
    activeTabId,
    splitView,
    getTabLayoutClass,
    handlePaneActivate,
    closeTab,
    handleTabSelect,
    setIsGalleryView,
    workspacePath,
    terminalAppearance,
    resolvedTerminalAppearance,
    setTerminalInstance,
    emptyTitle,
    emptyActionLabel,
    createDefaultTerminal,
    renderTabContent,
}: TerminalSplitViewProps) {
    const sessionTabs = tabs.filter(tab => tab.id !== TERMINAL_WORKSPACE_ISSUES_TAB_ID);
    const splitTabIds = new Set(
        splitView ? [splitView.primaryId, splitView.secondaryId] : []
    );
    const orderedSessionTabs = splitView
        ? [
            ...sessionTabs.filter(tab => splitTabIds.has(tab.id)),
            ...sessionTabs.filter(tab => !splitTabIds.has(tab.id)),
        ]
        : sessionTabs;
    const showSessionSidebar = !isGalleryView && sessionTabs.length > 1;

    return (
        <div className="flex-1 overflow-hidden relative" onContextMenu={onContextMenu}>
            <div className="flex h-full min-w-0">
                <div className="relative flex-1 min-w-0">
                    {!isGalleryView &&
                        tabs.map(tab => {
                            const customContent = renderTabContent?.(tab) ?? null;
                            const isVisible = splitView
                                ? tab.id === splitView.primaryId || tab.id === splitView.secondaryId
                                : activeTabId === tab.id;
                            if (customContent) {
                                return (
                                    <div
                                        key={tab.id}
                                        className={cn(getTabLayoutClass(tab.id), !isVisible && 'hidden')}
                                        onMouseDown={() => {
                                            handlePaneActivate(tab.id);
                                        }}
                                    >
                                        {customContent}
                                    </div>
                                );
                            }

                            return (
                                <TerminalInstance
                                    key={tab.id}
                                    tab={tab}
                                    isVisible={isVisible}
                                    className={getTabLayoutClass(tab.id)}
                                    onActivate={() => {
                                        handlePaneActivate(tab.id);
                                    }}
                                    onClose={() => {
                                        closeTab(tab.id);
                                    }}
                                    workspacePath={workspacePath}
                                    appearance={terminalAppearance}
                                    resolvedAppearance={resolvedTerminalAppearance}
                                    onTerminalInstanceChange={setTerminalInstance}
                                />
                            );
                        })}
                    {isGalleryView && tabs.length > 0 && (
                        <div className="absolute inset-0 p-2 overflow-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 auto-rows-260">
                                {tabs.map(tab => (
                                    <div
                                        key={tab.id}
                                        className={cn(
                                            'relative rounded-lg border overflow-hidden bg-background/70',
                                            activeTabId === tab.id
                                                ? 'border-primary/60 shadow-primary-outline'
                                                : 'border-border/70'
                                        )}
                                        onMouseDown={() => {
                                            handleTabSelect(tab.id);
                                        }}
                                        onDoubleClick={() => {
                                            handleTabSelect(tab.id);
                                            setIsGalleryView(false);
                                        }}
                                    >
                                        <div className={C_TERMINALSPLITVIEW_1}>
                                            <div className="typo-overline truncate text-foreground/90">
                                                {tab.name}
                                            </div>
                                            {resolveTerminalTabMetadata(tab).closable !== false && (
                                                <button
                                                    onClick={event => {
                                                        event.stopPropagation();
                                                        closeTab(tab.id);
                                                    }}
                                                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                >
                                                    <IconX className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 top-7">
                                            {renderTabContent?.(tab) ?? (
                                                <TerminalInstance
                                                    tab={tab}
                                                    isVisible={true}
                                                    className="absolute inset-0"
                                                    onActivate={() => {
                                                        handlePaneActivate(tab.id);
                                                    }}
                                                    onClose={() => {
                                                        closeTab(tab.id);
                                                    }}
                                                    workspacePath={workspacePath}
                                                    appearance={terminalAppearance}
                                                    resolvedAppearance={resolvedTerminalAppearance}
                                                    onTerminalInstanceChange={setTerminalInstance}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {tabs.length === 0 && (
                        <TerminalEmptyState
                            title={emptyTitle}
                            actionLabel={emptyActionLabel}
                            onCreate={() => {
                                void createDefaultTerminal();
                            }}
                        />
                    )}
                </div>
                {showSessionSidebar && (
                    <aside className="w-44 shrink-0 border-l border-border/60 bg-background/95 p-1.5 overflow-y-auto">
                        <div className="space-y-1">
                            {orderedSessionTabs.map(tab => {
                                const isActive = activeTabId === tab.id;
                                const closable = resolveTerminalTabMetadata(tab).closable !== false;
                                const splitRole = splitView
                                    ? (tab.id === splitView.primaryId
                                        ? 'primary'
                                        : tab.id === splitView.secondaryId
                                            ? 'secondary'
                                            : null)
                                    : null;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            handleTabSelect(tab.id);
                                        }}
                                        className={cn(
                                            'w-full h-8 px-2 rounded-md flex items-center justify-between gap-2 text-sm transition-colors',
                                            isActive
                                                ? 'bg-accent/70 text-foreground'
                                                : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                                        )}
                                    >
                                        <span className="truncate text-left flex items-center gap-1.5">
                                            {splitRole && (
                                                <span
                                                    className={cn(
                                                        'inline-flex h-4 min-w-4 items-center justify-center rounded border text-sm px-1',
                                                        splitRole === 'primary'
                                                            ? 'border-primary/70 text-primary'
                                                            : 'border-warning/70 text-warning'
                                                    )}
                                                >
                                                    {splitRole === 'primary' ? 'A' : 'B'}
                                                </span>
                                            )}
                                            <span className="truncate">{tab.name}</span>
                                        </span>
                                        {closable && (
                                            <span
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    closeTab(tab.id);
                                                }}
                                                className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive"
                                            >
                                                <IconX className="w-3 h-3" />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}
