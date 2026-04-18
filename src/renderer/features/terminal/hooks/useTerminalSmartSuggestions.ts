/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { type IDecoration, type Terminal as XTerm } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';

import { invokeTypedIpc } from '@/lib/ipc-client';
import { appLogger } from '@/utils/renderer-logger';

import {
    terminalGetSuggestionsResponseSchema,
    TerminalIpcContract,
    terminalWriteResponseSchema
} from '../utils/terminal-ipc';

interface UseTerminalSmartSuggestionsOptions {
    xtermRef: React.RefObject<XTerm | null>;
    tabId: string;
    shell: string;
    cwd?: string;
    enabled?: boolean;
}

/**
 * Hook to provide smart command suggestions (ghost-text) in xterm.js
 */
export function useTerminalSmartSuggestions({
    xtermRef,
    tabId,
    shell,
    cwd,
    enabled = true
}: UseTerminalSmartSuggestionsOptions) {
    const [suggestion, setSuggestion] = useState<string>('');
    const decorationRef = useRef<IDecoration | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout>();

    // Separate effect to handle suggestion clearing when disabled or xterm changes
    useEffect(() => {
        const xterm = xtermRef.current;
        if (!xterm || !enabled) {
            // Use setTimeout to avoid synchronous setState inside effect body
            const timer = setTimeout(() => {
                setSuggestion('');
            }, 0);
            return () => {
                clearTimeout(timer);
            };
        }
        return undefined;
    }, [xtermRef, enabled]);

    useEffect(() => {
        const xterm = xtermRef.current;
        if (!xterm || !enabled) {
            return;
        }

        const handleInput = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                void (async () => {
                    try {
                        const activeBuffer = xterm.buffer.active;
                        const line = activeBuffer.getLine(activeBuffer.cursorY + activeBuffer.baseY);
                        if (!line) {
                            return;
                        }

                        const lineStr = line.translateToString(true);
                        const cursorX = activeBuffer.cursorX;
                        const currentLineToCursor = lineStr.substring(0, cursorX);

                        const commandMatch = currentLineToCursor.match(/[$#%>]\s*(.*)$/) || [null, currentLineToCursor.trim()];
                        const command = commandMatch[1]?.trim() || '';

                        if (!command || command.length < 2) {
                            setSuggestion('');
                            return;
                        }

                        const suggestions = await invokeTypedIpc<TerminalIpcContract, 'terminal:getSuggestions'>('terminal:getSuggestions', [{
                            command,
                            shell,
                            cwd: cwd || '',
                            historyLimit: 20
                        }], { responseSchema: terminalGetSuggestionsResponseSchema });

                        if (suggestions && suggestions.length > 0) {
                            const sugg = suggestions[0];
                            if (sugg.startsWith(command)) {
                                setSuggestion(sugg.substring(command.length));
                            } else {
                                setSuggestion('');
                            }
                        } else {
                            setSuggestion('');
                        }
                    } catch (error) {
                        appLogger.error('TerminalSuggestions', 'Failed to fetch terminal suggestions', error as Error);
                        setSuggestion('');
                    }
                })();
            }, 500);
        };

        const disposable = xterm.onData(handleInput);

        return () => {
            disposable.dispose();
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [xtermRef, tabId, shell, cwd, enabled]);

    // Render decoration
    useEffect(() => {
        const xterm = xtermRef.current;
        if (!xterm || !suggestion || !enabled) {
            const currentDecoration = decorationRef.current;
            if (currentDecoration) {
                currentDecoration.dispose();
                decorationRef.current = null;
            }
            return;
        }

        const activeBuffer = xterm.buffer.active;

        const currentMarker = xterm.registerMarker(activeBuffer.baseY + activeBuffer.cursorY);
        if (!currentMarker) {
            return;
        }

        const decoration = xterm.registerDecoration({
            marker: currentMarker,
            x: activeBuffer.cursorX,
            width: suggestion.length
        });

        if (decoration) {
            decoration.onRender((element: HTMLElement) => {
                element.innerText = suggestion;
                element.style.color = 'var(--foreground)';
                element.style.opacity = '0.4';
                element.style.pointerEvents = 'none';
                element.style.whiteSpace = 'pre';
                element.style.fontFamily = xterm.options.fontFamily || 'monospace';

                const fontSize = xterm.options.fontSize;
                element.style.fontSize = fontSize ? `${fontSize}px` : '13px';
            });
            decorationRef.current = decoration;
        }

        return () => {
            decoration?.dispose();
            currentMarker.dispose();
        };
    }, [xtermRef, suggestion, enabled]);

    // Handle acceptance (Tab or Right Arrow)
    useEffect(() => {
        const xterm = xtermRef.current;
        if (!xterm || !suggestion || !enabled) {
            return;
        }

        const handleKey = (e: { key: string, domEvent: KeyboardEvent }) => {
            if (e.domEvent.key === 'Tab' || e.domEvent.key === 'ArrowRight') {
                if (suggestion) {
                    e.domEvent.preventDefault();
                    e.domEvent.stopPropagation();
                    void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [tabId, suggestion], { responseSchema: terminalWriteResponseSchema });
                    setSuggestion('');
                }
            } else {
                setSuggestion('');
            }
        };

        const disposable = xterm.onKey(handleKey);
        return () => {
            disposable.dispose();
        };
    }, [xtermRef, suggestion, tabId, enabled]);

    return { suggestion, setSuggestion };
}
