/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { History, TerminalSquare, X } from 'lucide-react';

import type { TaskRunnerEntry, TerminalHistoryEntry } from '../hooks/useTerminalCommandTools';

/* Batch-02: Extracted Long Classes */
const C_TERMINALCOMMANDPANELS_1 = "absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 w-420 max-w-95vw";
const C_TERMINALCOMMANDPANELS_2 = "absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 w-420 max-w-95vw";


interface TerminalCommandPanelsProps {
    t: (key: string, options?: Record<string, string | number>) => string;
    isCommandHistoryOpen: boolean;
    isCommandHistoryLoading: boolean;
    commandHistoryQuery: string;
    commandHistoryItems: TerminalHistoryEntry[];
    setCommandHistoryQuery: (value: string) => void;
    closeCommandHistory: () => void;
    clearCommandHistory: () => Promise<void>;
    executeHistoryCommand: (entry: TerminalHistoryEntry) => Promise<void>;
    isTaskRunnerOpen: boolean;
    isTaskRunnerLoading: boolean;
    taskRunnerQuery: string;
    taskRunnerItems: TaskRunnerEntry[];
    setTaskRunnerQuery: (value: string) => void;
    closeTaskRunner: () => void;
    executeTaskRunnerEntry: (entry: TaskRunnerEntry) => Promise<void>;
}

export function TerminalCommandPanels({
    t,
    isCommandHistoryOpen,
    isCommandHistoryLoading,
    commandHistoryQuery,
    commandHistoryItems,
    setCommandHistoryQuery,
    closeCommandHistory,
    clearCommandHistory,
    executeHistoryCommand,
    isTaskRunnerOpen,
    isTaskRunnerLoading,
    taskRunnerQuery,
    taskRunnerItems,
    setTaskRunnerQuery,
    closeTaskRunner,
    executeTaskRunnerEntry,
}: TerminalCommandPanelsProps) {
    return (
        <>
            {isCommandHistoryOpen && (
                <div className={C_TERMINALCOMMANDPANELS_1}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1 typo-caption font-medium text-foreground">
                            <History className="w-3.5 h-3.5 text-muted-foreground" />
                            {t('terminal.commandHistory')}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    void clearCommandHistory();
                                }}
                                className="h-6 px-2 typo-overline rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
                            >
                                {t('terminal.clearHistory')}
                            </button>
                            <button
                                onClick={closeCommandHistory}
                                className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={t('common.close')}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                    <input
                        value={commandHistoryQuery}
                        onChange={event => {
                            setCommandHistoryQuery(event.target.value);
                        }}
                        placeholder={t('terminal.historySearchPlaceholder')}
                        className="w-full h-7 px-2 rounded border border-border bg-background/60 typo-caption outline-none mb-2"
                    />
                    <div className="max-h-56 overflow-y-auto custom-scrollbar">
                        {isCommandHistoryLoading && (
                            <div className="px-2 py-2 typo-caption text-muted-foreground">
                                {t('common.loading')}
                            </div>
                        )}
                        {!isCommandHistoryLoading && commandHistoryItems.length === 0 && (
                            <div className="px-2 py-2 typo-caption text-muted-foreground">
                                {t('terminal.noHistory')}
                            </div>
                        )}
                        {!isCommandHistoryLoading &&
                            commandHistoryItems.map(entry => (
                                <button
                                    key={`${entry.timestamp}-${entry.command}`}
                                    onClick={() => {
                                        void executeHistoryCommand(entry);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/40 transition-colors"
                                    title={entry.command}
                                >
                                    <div className="typo-caption text-foreground truncate">
                                        {entry.command}
                                    </div>
                                    <div className="typo-overline text-muted-foreground truncate">
                                        {new Date(entry.timestamp).toLocaleString()}
                                        {entry.cwd ? ` - ${entry.cwd}` : ''}
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>
            )}
            {isTaskRunnerOpen && (
                <div className={C_TERMINALCOMMANDPANELS_2}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1 typo-caption font-medium text-foreground">
                            <TerminalSquare className="w-3.5 h-3.5 text-muted-foreground" />
                            {t('terminal.taskRunner')}
                        </div>
                        <button
                            onClick={closeTaskRunner}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('common.close')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <input
                        value={taskRunnerQuery}
                        onChange={event => {
                            setTaskRunnerQuery(event.target.value);
                        }}
                        placeholder={t('terminal.tasksSearchPlaceholder')}
                        className="w-full h-7 px-2 rounded border border-border bg-background/60 typo-caption outline-none mb-2"
                    />
                    <div className="max-h-56 overflow-y-auto custom-scrollbar">
                        {isTaskRunnerLoading && (
                            <div className="px-2 py-2 typo-caption text-muted-foreground">
                                {t('common.loading')}
                            </div>
                        )}
                        {!isTaskRunnerLoading && taskRunnerItems.length === 0 && (
                            <div className="px-2 py-2 typo-caption text-muted-foreground">
                                {t('terminal.noTasksFound')}
                            </div>
                        )}
                        {!isTaskRunnerLoading &&
                            taskRunnerItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        void executeTaskRunnerEntry(item);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/40 transition-colors"
                                    title={item.command}
                                >
                                    <div className="typo-caption text-foreground truncate">
                                        {item.command}
                                    </div>
                                    <div className="typo-overline text-muted-foreground truncate">
                                        {item.source} - {item.label}
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>
            )}
        </>
    );
}
