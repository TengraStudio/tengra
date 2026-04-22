/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { X } from 'lucide-react';
import React from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import { DiffViewer } from '@/components/ui/DiffViewer';
import { cn } from '@/lib/utils';
import { normalizeLanguage } from '@/utils/language-map';

export type ChatPreviewTab =
    | {
        id: string;
        kind: 'file';
        path: string;
        title: string;
        language: string;
        loading: boolean;
        error?: string;
        content?: string;
        readOnly: boolean;
    }
    | {
        id: string;
        kind: 'diff';
        path: string;
        title: string;
        language: string;
        loading: boolean;
        error?: string;
        original?: string;
        modified?: string;
    };

function guessLanguageFromPath(path: string): string {
    const file = (path ?? '').split(/[\\/]/).pop() ?? '';
    const ext = file.includes('.') ? file.split('.').pop() ?? '' : '';
    const normalized = normalizeLanguage(ext);
    return normalized && normalized !== 'text' ? normalized : 'plaintext';
}

export function buildChatPreviewTabId(kind: 'file' | 'diff', path: string): string {
    return `${kind}:${path}`;
}

export function createLoadingFileTab(path: string, readOnly: boolean): ChatPreviewTab {
    const title = (path ?? '').split(/[\\/]/).pop() ?? path ?? 'file';
    return {
        id: buildChatPreviewTabId('file', path),
        kind: 'file',
        path,
        title,
        language: guessLanguageFromPath(path),
        loading: true,
        readOnly,
    };
}

export function createLoadingDiffTab(path: string): ChatPreviewTab {
    const title = (path ?? '').split(/[\\/]/).pop() ?? path ?? 'diff';
    return {
        id: buildChatPreviewTabId('diff', path),
        kind: 'diff',
        path,
        title,
        language: guessLanguageFromPath(path),
        loading: true,
    };
}

export const ChatFilePreviewPanel = React.memo(({
    tabs,
    activeTabId,
    onClose,
    onCloseTab,
    onSelectTab,
}: {
    tabs: ChatPreviewTab[];
    activeTabId: string;
    onClose: () => void;
    onCloseTab: (id: string) => void;
    onSelectTab: (id: string) => void;
}) => {
    const active = React.useMemo(
        () => tabs.find(t => t.id === activeTabId) ?? tabs[0] ?? null,
        [activeTabId, tabs]
    );

    if (!active) {
        return null;
    }

    return (
        <div className="h-full w-46p min-w-420 max-w-820 border-l border-border/50 bg-background flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/10 px-2 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onSelectTab(tab.id)}
                            className={cn(
                                'group flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors',
                                tab.id === active.id
                                    ? 'bg-muted/40 text-foreground'
                                    : 'text-muted-foreground hover:bg-muted/20 hover:text-foreground'
                            )}
                            title={tab.path}
                        >
                            <span className="max-w-220 truncate">{tab.title}</span>
                            <span
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseTab(tab.id);
                                }}
                                role="button"
                                aria-label="Close tab"
                            >
                                <X className="h-3.5 w-3.5" />
                            </span>
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                    aria-label="Close preview"
                    title="Close"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 min-h-0 p-2">
                {active.loading ? (
                    <div className="h-full w-full rounded-lg border border-border/40 bg-muted/10 p-4 text-sm text-muted-foreground">
                        Loading…
                    </div>
                ) : active.error ? (
                    <div className="h-full w-full rounded-lg border border-border/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {active.error}
                    </div>
                ) : active.kind === 'diff' ? (
                    <DiffViewer
                        original={active.original ?? ''}
                        modified={active.modified ?? ''}
                        language={active.language}
                        className="h-full"
                        readOnly
                    />
                ) : (
                    <CodeEditor
                        className="h-full"
                        value={active.content ?? ''}
                        language={active.language}
                        readOnly={active.readOnly}
                        performanceMode
                        inlineSuggestionConfig={null}
                    />
                )}
            </div>
        </div>
    );
});

ChatFilePreviewPanel.displayName = 'ChatFilePreviewPanel';

