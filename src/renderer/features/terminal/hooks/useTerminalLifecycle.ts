/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { type MutableRefObject, useEffect, useRef } from 'react';

interface RecordingEvent {
    at: number;
    type: 'data' | 'exit';
    data: string;
}

interface RecordingCapture {
    tabId: string;
    startedAt: number;
    events: RecordingEvent[];
}

interface UseTerminalLifecycleOptions {
    parseSemanticChunk: (tabId: string, chunk: string, flushRemainder?: boolean) => void;
    recordingCaptureRef: MutableRefObject<RecordingCapture | null>;
    completeRecording: () => void;
    createDefaultTerminal: () => Promise<void>;
}

export function useTerminalLifecycle({
    parseSemanticChunk,
    recordingCaptureRef,
    completeRecording,
    createDefaultTerminal,
}: UseTerminalLifecycleOptions) {
    const bufferRef = useRef<Record<string, string>>({});
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const flush = () => {
            const buffer = bufferRef.current;
            bufferRef.current = {};
            timeoutRef.current = null;

            Object.entries(buffer).forEach(([id, data]) => {
                parseSemanticChunk(id, data);
                window.dispatchEvent(new CustomEvent('terminal-data-multiplex', { detail: { id, data } }));
            });
        };

        const c1 = window.electron.terminal.onData(p => {
            bufferRef.current[p.id] = (bufferRef.current[p.id] ?? '') + p.data;

            const activeRecording = recordingCaptureRef.current;
            if (activeRecording?.tabId === p.id && p.data) {
                activeRecording.events.push({
                    at: Date.now() - activeRecording.startedAt,
                    type: 'data',
                    data: p.data,
                });
                if (activeRecording.events.length > 12000) {
                    activeRecording.events = activeRecording.events.slice(-12000);
                }
            }

            if (!timeoutRef.current) {
                timeoutRef.current = setTimeout(flush, 16);
            }
        });

        const c2 = window.electron.terminal.onExit(p => {
            // Flush any remaining data before exit
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                flush();
            }

            parseSemanticChunk(p.id, '', true);
            const activeRecording = recordingCaptureRef.current;
            if (activeRecording?.tabId === p.id) {
                activeRecording.events.push({
                    at: Date.now() - activeRecording.startedAt,
                    type: 'exit',
                    data: String(p.code ?? 0),
                });
                completeRecording();
            }
            window.dispatchEvent(new CustomEvent('terminal-exit-multiplex', { detail: p }));
        });

        return () => {
            c1();
            c2();
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [completeRecording, parseSemanticChunk, recordingCaptureRef]);

    useEffect(() => {
        const handleNewTerminalShortcut = () => {
            void createDefaultTerminal();
        };
        window.addEventListener('workspace-terminal:new', handleNewTerminalShortcut);
        return () => {
            window.removeEventListener('workspace-terminal:new', handleNewTerminalShortcut);
        };
    }, [createDefaultTerminal]);
}
