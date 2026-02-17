import { type MutableRefObject,useEffect } from 'react';

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
    useEffect(() => {
        const c1 = window.electron.terminal.onData(p => {
            parseSemanticChunk(p.id, p.data);
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
            window.dispatchEvent(new CustomEvent('terminal-data-multiplex', { detail: p }));
        });
        const c2 = window.electron.terminal.onExit(p => {
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
