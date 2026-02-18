import { X } from 'lucide-react';
import { type MouseEventHandler, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';

import type { ResolvedTerminalAppearance, TerminalAppearancePreferences } from '../types/terminal-appearance';

import { TerminalEmptyState } from './TerminalEmptyState';
import { TerminalInstance } from './TerminalInstance';

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
    projectPath?: string;
    terminalAppearance: TerminalAppearancePreferences;
    resolvedTerminalAppearance: ResolvedTerminalAppearance;
    setTerminalInstance: (id: string, terminal: import('xterm').Terminal | null) => void;
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
    const metadata = tab.metadata as Record<string, unknown>;
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
    projectPath,
    terminalAppearance,
    resolvedTerminalAppearance,
    setTerminalInstance,
    emptyTitle,
    emptyActionLabel,
    createDefaultTerminal,
    renderTabContent,
}: TerminalSplitViewProps) {
    return (
        <div className="flex-1 overflow-hidden relative" onContextMenu={onContextMenu}>
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
                            projectPath={projectPath}
                            appearance={terminalAppearance}
                            resolvedAppearance={resolvedTerminalAppearance}
                            onTerminalInstanceChange={setTerminalInstance}
                        />
                    );
                })}
            {isGalleryView && tabs.length > 0 && (
                <div className="absolute inset-0 p-2 overflow-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 auto-rows-[260px]">
                        {tabs.map(tab => (
                            <div
                                key={tab.id}
                                className={cn(
                                    'relative rounded-lg border overflow-hidden bg-background/70',
                                    activeTabId === tab.id
                                        ? 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]'
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
                                <div className="absolute top-0 inset-x-0 z-10 h-7 flex items-center justify-between px-2 bg-background/80 border-b border-border/70 backdrop-blur">
                                    <div className="text-[11px] truncate text-foreground/90">
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
                                            <X className="w-3 h-3" />
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
                                            projectPath={projectPath}
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
    );
}
