/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { RefObject, useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

import { invokeTypedIpc } from '@/lib/ipc-client';
import { appLogger } from '@/utils/renderer-logger';

import {
    terminalClearCommandHistoryResponseSchema,
    TerminalCommandHistoryEntry,
    terminalCommandHistoryEntrySchema,
    TerminalIpcContract} from '../utils/terminal-ipc';

export type TerminalHistoryEntry = TerminalCommandHistoryEntry;

export type TaskRunnerEntry = {
    id: string;
    label: string;
    command: string;
    source: 'npm' | 'make' | 'cargo';
};

interface UseTerminalCommandToolsOptions {
    hasActiveSession: boolean;
    activeTabIdRef: RefObject<string | null>;
    workspacePath?: string;
    writeCommandToActiveTerminal: (command: string) => Promise<void>;
    onBeforeOpen: () => void;
}

function joinWorkspacePath(basePath: string, child: string): string {
    const normalizedBase = basePath.replace(/[\\/]+$/, '');
    if (!normalizedBase) {
        return child;
    }
    return `${normalizedBase}/${child}`;
}

function extractMakeTargets(content: string): string[] {
    const targetPattern = /^([A-Za-z0-9_.-]+)\s*:(?![=])/;
    const ignored = new Set(['.PHONY']);
    const targets = new Set<string>();
    content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }
        const match = targetPattern.exec(trimmed);
        if (!match) {
            return;
        }
        const target = match[1] ?? '';
        if (!target || ignored.has(target) || target.startsWith('.')) {
            return;
        }
        targets.add(target);
    });
    return Array.from(targets);
}

export function useTerminalCommandTools({
    hasActiveSession,
    activeTabIdRef,
    workspacePath,
    writeCommandToActiveTerminal,
    onBeforeOpen,
}: UseTerminalCommandToolsOptions) {
    const [isCommandHistoryOpen, setIsCommandHistoryOpen] = useState(false);
    const [isCommandHistoryLoading, setIsCommandHistoryLoading] = useState(false);
    const [commandHistoryQuery, setCommandHistoryQuery] = useState('');
    const [commandHistoryItems, setCommandHistoryItems] = useState<TerminalHistoryEntry[]>([]);

    const [isTaskRunnerOpen, setIsTaskRunnerOpen] = useState(false);
    const [isTaskRunnerLoading, setIsTaskRunnerLoading] = useState(false);
    const [taskRunnerQuery, setTaskRunnerQuery] = useState('');
    const [taskRunnerItems, setTaskRunnerItems] = useState<TaskRunnerEntry[]>([]);

    const openCommandHistory = useCallback(() => {
        if (!hasActiveSession) {
            return;
        }
        onBeforeOpen();
        setIsTaskRunnerOpen(false);
        setIsCommandHistoryOpen(true);
    }, [hasActiveSession, onBeforeOpen]);

    const closeCommandHistory = useCallback(() => {
        setIsCommandHistoryOpen(false);
        setCommandHistoryQuery('');
        setIsCommandHistoryLoading(false);
    }, []);

    const executeHistoryCommand = useCallback(async (entry: TerminalHistoryEntry) => {
        if (!activeTabIdRef.current) {
            return;
        }
        try {
            await writeCommandToActiveTerminal(entry.command);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to execute command history entry', error as Error);
        }
    }, [activeTabIdRef, writeCommandToActiveTerminal]);

    const clearCommandHistory = useCallback(async () => {
        try {
            const success = await invokeTypedIpc<TerminalIpcContract, 'terminal:clearCommandHistory'>('terminal:clearCommandHistory', [], { responseSchema: terminalClearCommandHistoryResponseSchema });
            if (success) {
                setCommandHistoryItems([]);
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to clear command history', error as Error);
        }
    }, []);

    useEffect(() => {
        if (!isCommandHistoryOpen) {
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            void (async () => {
                try {
                    setIsCommandHistoryLoading(true);
                    const entries = await invokeTypedIpc<TerminalIpcContract, 'terminal:getCommandHistory'>('terminal:getCommandHistory', [commandHistoryQuery, 80], { responseSchema: z.array(terminalCommandHistoryEntrySchema) });
                    if (!cancelled) {
                        setCommandHistoryItems(entries);
                    }
                } catch (error) {
                    if (!cancelled) {
                        setCommandHistoryItems([]);
                    }
                    appLogger.error('TerminalPanel', 'Failed to load command history', error as Error);
                } finally {
                    if (!cancelled) {
                        setIsCommandHistoryLoading(false);
                    }
                }
            })();
        }, 120);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [commandHistoryQuery, isCommandHistoryOpen]);

    const openTaskRunner = useCallback(() => {
        if (!hasActiveSession) {
            return;
        }
        onBeforeOpen();
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(true);
    }, [hasActiveSession, onBeforeOpen]);

    const closeTaskRunner = useCallback(() => {
        setIsTaskRunnerOpen(false);
        setTaskRunnerQuery('');
        setTaskRunnerItems([]);
        setIsTaskRunnerLoading(false);
    }, []);

    const executeTaskRunnerEntry = useCallback(async (entry: TaskRunnerEntry) => {
        if (!activeTabIdRef.current) {
            return;
        }
        try {
            await writeCommandToActiveTerminal(entry.command);
            setIsTaskRunnerOpen(false);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to execute task runner command', error as Error);
        }
    }, [activeTabIdRef, writeCommandToActiveTerminal]);

    useEffect(() => {
        if (!isTaskRunnerOpen) {
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            void (async () => {
                if (!workspacePath) {
                    setTaskRunnerItems([]);
                    return;
                }

                try {
                    setIsTaskRunnerLoading(true);
                    const items: TaskRunnerEntry[] = [];

                    const packageJsonPath = joinWorkspacePath(workspacePath, 'package.json');
                    if (await window.electron.files.exists(packageJsonPath)) {
                        const packageRaw = await window.electron.files.readFile(packageJsonPath);
                        const parsed = JSON.parse(packageRaw) as { scripts?: Record<string, string> };
                        Object.entries(parsed.scripts ?? {}).forEach(([name, command]) => {
                            if (!name || !command) {
                                return;
                            }
                            items.push({
                                id: `npm:${name}`,
                                label: name,
                                command: `npm run ${name}`,
                                source: 'npm',
                            });
                        });
                    }

                    const makefilePath = joinWorkspacePath(workspacePath, 'Makefile');
                    if (await window.electron.files.exists(makefilePath)) {
                        const makefileRaw = await window.electron.files.readFile(makefilePath);
                        extractMakeTargets(makefileRaw).forEach(target => {
                            items.push({
                                id: `make:${target}`,
                                label: target,
                                command: `make ${target}`,
                                source: 'make',
                            });
                        });
                    }

                    const cargoTomlPath = joinWorkspacePath(workspacePath, 'Cargo.toml');
                    if (await window.electron.files.exists(cargoTomlPath)) {
                        const cargoDefaults = ['build', 'run', 'test', 'check', 'clippy'];
                        cargoDefaults.forEach(command => {
                            items.push({
                                id: `cargo:${command}`,
                                label: command,
                                command: `cargo ${command}`,
                                source: 'cargo',
                            });
                        });
                    }

                    const normalizedQuery = taskRunnerQuery.trim().toLowerCase();
                    const filtered = normalizedQuery
                        ? items.filter(
                            item =>
                                item.label.toLowerCase().includes(normalizedQuery) ||
                                item.command.toLowerCase().includes(normalizedQuery) ||
                                item.source.toLowerCase().includes(normalizedQuery)
                        )
                        : items;

                    if (!cancelled) {
                        setTaskRunnerItems(filtered);
                    }
                } catch (error) {
                    if (!cancelled) {
                        setTaskRunnerItems([]);
                    }
                    appLogger.error('TerminalPanel', 'Failed to load task runner entries', error as Error);
                } finally {
                    if (!cancelled) {
                        setIsTaskRunnerLoading(false);
                    }
                }
            })();
        }, 120);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [isTaskRunnerOpen, workspacePath, taskRunnerQuery]);

    return {
        isCommandHistoryOpen,
        setIsCommandHistoryOpen,
        isCommandHistoryLoading,
        commandHistoryQuery,
        setCommandHistoryQuery,
        commandHistoryItems,
        openCommandHistory,
        closeCommandHistory,
        executeHistoryCommand,
        clearCommandHistory,
        isTaskRunnerOpen,
        setIsTaskRunnerOpen,
        isTaskRunnerLoading,
        taskRunnerQuery,
        setTaskRunnerQuery,
        taskRunnerItems,
        openTaskRunner,
        closeTaskRunner,
        executeTaskRunnerEntry,
    };
}
