/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { type Terminal as XTerm } from '@xterm/xterm';
import { type MutableRefObject,useCallback } from 'react';

import { appLogger } from '@/utils/renderer-logger';

import {
    ANSI_ESCAPE_SEQUENCE_REGEX,
    stripAnsiControlSequences,
    TERMINAL_PASTE_HISTORY_LIMIT,
} from '../constants/terminal-panel-constants';
import { alertDialog, confirmDialog } from '../utils/dialog';
import { buildFormattedClipboardHtml, summarizePasteText } from '../utils/terminal-panel-helpers';

interface UseTerminalClipboardActionsParams {
    activeTabIdRef: MutableRefObject<string | null>;
    terminalInstancesRef: MutableRefObject<Record<string, XTerm | null>>;
    writeInputToTargetSessions: (value: string) => Promise<void>;
    setTerminalContextMenu: (menu: { x: number; y: number } | null) => void;
    setPasteHistory: (fn: (prev: string[]) => string[]) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

export function useTerminalClipboardActions({
    activeTabIdRef,
    terminalInstancesRef,
    writeInputToTargetSessions,
    setTerminalContextMenu,
    setPasteHistory,
    t,
}: UseTerminalClipboardActionsParams) {
    const getActiveTerminalInstance = useCallback(() => {
        if (!activeTabIdRef.current) {
            return null;
        }
        return terminalInstancesRef.current[activeTabIdRef.current] ?? null;
    }, [activeTabIdRef, terminalInstancesRef]);

    const handleCopySelection = useCallback(async (options?: { stripAnsi?: boolean; trimWhitespace?: boolean }) => {
        try {
            const terminal = getActiveTerminalInstance();
            let selectedText = terminal?.hasSelection()
                ? terminal.getSelection()
                : (window.getSelection()?.toString() ?? '');

            if (!selectedText) {
                return;
            }

            if (options?.stripAnsi) {
                selectedText = stripAnsiControlSequences(selectedText);
            }
            if (options?.trimWhitespace) {
                selectedText = selectedText.trim();
            }

            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to copy terminal selection', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [getActiveTerminalInstance, setTerminalContextMenu]);

    const handleCopyWithFormatting = useCallback(async () => {
        try {
            const terminal = getActiveTerminalInstance();
            const selectedText = terminal?.hasSelection()
                ? terminal.getSelection()
                : (window.getSelection()?.toString() ?? '');

            if (!selectedText) {
                return;
            }

            const htmlContent = buildFormattedClipboardHtml(selectedText);
            const clipboardItem = new ClipboardItem({
                'text/plain': new Blob([selectedText], { type: 'text/plain' }),
                'text/html': new Blob([htmlContent], { type: 'text/html' }),
            });
            await navigator.clipboard.write([clipboardItem]);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to copy with formatting', error as Error);
            await handleCopySelection();
        } finally {
            setTerminalContextMenu(null);
        }
    }, [getActiveTerminalInstance, handleCopySelection, setTerminalContextMenu]);

    const handleCopyStripAnsi = useCallback(async () => {
        await handleCopySelection({ stripAnsi: true });
    }, [handleCopySelection]);

    const handlePasteClipboard = useCallback(async () => {
        try {
            if (!activeTabIdRef.current) {
                return;
            }
            const text = await navigator.clipboard.readText();
            if (text) {
                const hasMultipleLines = /\r?\n/.test(text);
                if (hasMultipleLines) {
                    const preview = text
                        .split(/\r?\n/)
                        .slice(0, 3)
                        .join('\n')
                        .slice(0, 240);
                    const confirmed = await confirmDialog(
                        t('frontend.terminal.pasteConfirmLines', {
                            count: text.split(/\r?\n/).length,
                            preview
                        })
                    );
                    if (!confirmed) {
                        return;
                    }
                }
                await writeInputToTargetSessions(text);
                setPasteHistory(prev => {
                    const normalized = text.trim();
                    if (!normalized) {
                        return prev;
                    }
                    const next = [normalized, ...prev.filter(item => item !== normalized)];
                    return next.slice(0, TERMINAL_PASTE_HISTORY_LIMIT);
                });
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to paste into terminal', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [activeTabIdRef, setPasteHistory, setTerminalContextMenu, t, writeInputToTargetSessions]);

    const handlePasteFromHistory = useCallback(async (entry: string) => {
        try {
            if (!activeTabIdRef.current) {
                return;
            }
            await writeInputToTargetSessions(entry);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to paste from history', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [activeTabIdRef, writeInputToTargetSessions, setTerminalContextMenu]);

    const handleTestPaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                return;
            }
            const hasAnsi = ANSI_ESCAPE_SEQUENCE_REGEX.test(text);
            await alertDialog(summarizePasteText(text, hasAnsi, t));
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to test paste', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [setTerminalContextMenu, t]);

    const handleSelectAll = useCallback(() => {
        getActiveTerminalInstance()?.selectAll();
        setTerminalContextMenu(null);
    }, [getActiveTerminalInstance, setTerminalContextMenu]);

    const handleClearOutput = useCallback(() => {
        const terminal = getActiveTerminalInstance();
        terminal?.clearSelection();
        terminal?.clear();
        setTerminalContextMenu(null);
    }, [getActiveTerminalInstance, setTerminalContextMenu]);

    return {
        getActiveTerminalInstance,
        handleCopySelection,
        handleCopyWithFormatting,
        handleCopyStripAnsi,
        handlePasteClipboard,
        handlePasteFromHistory,
        handleTestPaste,
        handleSelectAll,
        handleClearOutput,
    };
}

