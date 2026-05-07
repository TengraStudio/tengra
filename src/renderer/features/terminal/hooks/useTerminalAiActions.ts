/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback } from 'react';

import { TerminalTab } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { TerminalSemanticIssue } from '../utils/terminal-panel-types';

import type { AiPanelMode, AiResult } from './useTerminalAI';

interface UseTerminalAiActionsParams {
    activeTabId: string | null;
    tabById: Map<string, TerminalTab>;
    workspacePath?: string;
    writeCommandToActiveTerminal: (command: string) => Promise<void>;
    setAiPanelMode: (mode: AiPanelMode) => void;
    setAiSelectedIssue: (issue: TerminalSemanticIssue | null) => void;
    setAiIsLoading: (loading: boolean) => void;
    setAiResult: (result: AiResult | null) => void;
    setIsAiPanelOpen: (open: boolean) => void;
}

export function useTerminalAiActions({
    activeTabId,
    tabById,
    workspacePath,
    writeCommandToActiveTerminal,
    setAiPanelMode,
    setAiSelectedIssue,
    setAiIsLoading,
    setAiResult,
    setIsAiPanelOpen,
}: UseTerminalAiActionsParams) {
    const getActiveShellType = useCallback(() => {
        if (!activeTabId) {
            return 'bash';
        }
        const tab = tabById.get(activeTabId);
        return tab?.type ?? 'bash';
    }, [activeTabId, tabById]);

    const handleAiExplainError = useCallback(
        async (issue: TerminalSemanticIssue) => {
            setAiSelectedIssue(issue);
            setAiPanelMode('explain-error');
            setIsAiPanelOpen(true);
            setAiIsLoading(true);
            setAiResult(null);

            try {
                const result = await window.electron.terminal.explainError({
                    errorOutput: issue.message,
                    shell: getActiveShellType(),
                    cwd: workspacePath ?? undefined,
                });
                setAiResult({ type: 'explain-error', data: result });
            } catch (err) {
                appLogger.error('TerminalPanel', 'Failed to explain error', err as Error);
                setAiResult({
                    type: 'explain-error',
                    data: {
                        summary: 'Failed to analyze error',
                        cause: 'Service error',
                        solution: 'Please try again.',
                    },
                });
            } finally {
                setAiIsLoading(false);
            }
        },
        [getActiveShellType, workspacePath, setAiIsLoading, setAiPanelMode, setAiResult, setAiSelectedIssue, setIsAiPanelOpen]
    );

    const handleAiFixError = useCallback(
        async (issue: TerminalSemanticIssue) => {
            setAiSelectedIssue(issue);
            setAiPanelMode('fix-error');
            setIsAiPanelOpen(true);
            setAiIsLoading(true);
            setAiResult(null);

            let lastCommand = '';
            try {
                const history = await window.electron.terminal.getCommandHistory('', 1);
                if (history.length > 0) {
                    lastCommand = history[0]?.command ?? '';
                }
            } catch {
                // Ignore history fetch errors
            }

            try {
                const result = await window.electron.terminal.fixError({
                    errorOutput: issue.message,
                    command: lastCommand,
                    shell: getActiveShellType(),
                    cwd: workspacePath ?? undefined,
                });
                setAiResult({ type: 'fix-error', data: result });
            } catch (err) {
                appLogger.error('TerminalPanel', 'Failed to suggest fix', err as Error);
                setAiResult({
                    type: 'fix-error',
                    data: {
                        suggestedCommand: '',
                        explanation: 'Failed to suggest fix. Please try again.',
                        confidence: 'low',
                    },
                });
            } finally {
                setAiIsLoading(false);
            }
        },
        [getActiveShellType, workspacePath, setAiIsLoading, setAiPanelMode, setAiResult, setAiSelectedIssue, setIsAiPanelOpen]
    );

    const handleAiApplyFix = useCallback(
        async (command: string) => {
            if (!activeTabId || !command) {
                return;
            }

            try {
                await writeCommandToActiveTerminal(command);
                setIsAiPanelOpen(false);
                setAiResult(null);
            } catch (err) {
                appLogger.error('TerminalPanel', 'Failed to apply fix command', err as Error);
            }
        },
        [activeTabId, writeCommandToActiveTerminal, setIsAiPanelOpen, setAiResult]
    );

    const closeAiPanel = useCallback(() => {
        setIsAiPanelOpen(false);
        setAiResult(null);
        setAiSelectedIssue(null);
    }, [setIsAiPanelOpen, setAiResult, setAiSelectedIssue]);

    return {
        getActiveShellType,
        handleAiExplainError,
        handleAiFixError,
        handleAiApplyFix,
        closeAiPanel,
    };
}

