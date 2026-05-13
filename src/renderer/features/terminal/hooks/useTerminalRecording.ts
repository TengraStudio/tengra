/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TerminalTab } from '@/types';

/**
 * Terminal recording event
 */
export interface TerminalRecordingEvent {
    /** Event type */
    type: 'data' | 'exit';
    /** Event data payload */
    data: string;
    /** Relative timestamp in milliseconds from recording start */
    at: number;
}

/**
 * Terminal recording metadata and events
 */
export interface TerminalRecording {
    /** Unique recording identifier */
    id: string;
    /** Associated terminal tab ID */
    tabId: string;
    /** Terminal tab name at recording time */
    tabName: string;
    /** Recording start timestamp */
    startedAt: number;
    /** Recording end timestamp */
    endedAt: number;
    /** Total recording duration in milliseconds */
    durationMs: number;
    /** Recorded events */
    events: TerminalRecordingEvent[];
}

/**
 * Props for useTerminalRecording hook
 */
interface UseTerminalRecordingProps {
    /** Current terminal tabs */
    tabs: TerminalTab[];
    /** Currently active tab ID */
    activeTabId: string | null;
    /** Callback to set recording panel open state */
    setIsRecordingPanelOpen: (open: boolean) => void;
}

/**
 * Hook for managing terminal recording and replay functionality
 * 
 * @param props - Hook configuration
 * @returns Recording state and control functions
 */
export function useTerminalRecording({
    tabs,
    activeTabId,
    setIsRecordingPanelOpen,
}: UseTerminalRecordingProps) {
    const [recordings, setRecordings] = useState<TerminalRecording[]>([]);
    const [activeRecordingTabId, setActiveRecordingTabId] = useState<string | null>(null);
    const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
    const [isReplayRunning, setIsReplayRunning] = useState(false);
    const [replayText, setReplayText] = useState('');

    const tabsRef = useRef<TerminalTab[]>(tabs);
    const activeTabIdRef = useRef<string | null>(activeTabId);
    const recordingCaptureRef = useRef<{
        tabId: string;
        tabName: string;
        startedAt: number;
        events: TerminalRecordingEvent[];
    } | null>(null);
    const replayTimeoutsRef = useRef<number[]>([]);

    // Update refs when tabs or activeTabId change
    useEffect(() => {
        tabsRef.current = tabs;
    }, [tabs]);

    useEffect(() => {
        activeTabIdRef.current = activeTabId;
    }, [activeTabId]);

    /**
     * Clear all pending replay timers
     */
    const clearReplayTimers = useCallback(() => {
        replayTimeoutsRef.current.forEach(timerId => {
            window.clearTimeout(timerId);
        });
        replayTimeoutsRef.current = [];
    }, []);

    /**
     * Stop currently running replay
     */
    const stopReplay = useCallback(() => {
        clearReplayTimers();
        setIsReplayRunning(false);
    }, [clearReplayTimers]);

    /**
     * Cleanup replay timers on unmount
     */
    useEffect(() => {
        return () => {
            clearReplayTimers();
        };
    }, [clearReplayTimers]);

    /**
     * Complete active recording session
     */
    const completeRecording = useCallback(() => {
        const active = recordingCaptureRef.current;
        if (!active) {
            return;
        }

        const endedAt = Date.now();
        const recording: TerminalRecording = {
            id: `rec-${endedAt}-${Math.random().toString(36).slice(2, 7)}`,
            tabId: active.tabId,
            tabName: active.tabName,
            startedAt: active.startedAt,
            endedAt,
            durationMs: Math.max(0, endedAt - active.startedAt),
            events: active.events.slice(),
        };

        recordingCaptureRef.current = null;
        setActiveRecordingTabId(null);
        setRecordings(prev => [recording, ...prev].slice(0, 50));
        setSelectedRecordingId(recording.id);
    }, []);

    /**
     * Start recording active terminal session
     */
    const startRecording = useCallback(() => {
        const tabId = activeTabIdRef.current;
        if (!tabId) {
            return;
        }
        const tab = tabsRef.current.find(item => item.id === tabId);
        if (!tab) {
            return;
        }

        if (recordingCaptureRef.current) {
            completeRecording();
        }

        recordingCaptureRef.current = {
            tabId,
            tabName: tab.name,
            startedAt: Date.now(),
            events: [],
        };
        setActiveRecordingTabId(tabId);
        setIsRecordingPanelOpen(true);
        setReplayText('');
        stopReplay();
    }, [completeRecording, stopReplay, setIsRecordingPanelOpen]);

    /**
     * Stop active recording session
     */
    const stopRecording = useCallback(() => {
        completeRecording();
    }, [completeRecording]);

    /**
     * Toggle recording state for active terminal
     */
    const toggleRecording = useCallback(() => {
        if (activeRecordingTabId) {
            stopRecording();
            return;
        }
        startRecording();
    }, [activeRecordingTabId, startRecording, stopRecording]);

    /**
     * Export recording to JSON file
     * 
     * @param recording - Recording to export
     */
    const exportRecording = useCallback((recording: TerminalRecording) => {
        const payload = JSON.stringify(recording, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `terminal-recording-${recording.tabName.replace(/\s+/g, '-').toLowerCase()}-${new Date(recording.endedAt).toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, []);

    /**
     * Get currently selected recording
     */
    const selectedRecording = selectedRecordingId
        ? (recordings.find(recording => recording.id === selectedRecordingId) ?? null)
        : null;

    /**
     * Get text for selected recording
     */
    const selectedRecordingText = (selectedRecording && selectedRecording.events)
        ? selectedRecording.events
              .filter(event => event.type === 'data')
              .map(event => event.data)
              .join('')
        : '';

    /**
     * Start replaying a recording
     * 
     * @param recording - Recording to replay
     */
    const startReplay = useCallback(
        (recording: TerminalRecording) => {
            stopReplay();
            setReplayText('');

            const playbackEvents = (recording && recording.events)
                ? recording.events.filter(event => event.type === 'data')
                : [];
            
            if (playbackEvents.length === 0) {
                setIsReplayRunning(false);
                return;
            }

            setIsReplayRunning(true);
            let elapsed = 0;
            let previousAt = 0;

            playbackEvents.forEach((event, index) => {
                const stepDelta = Math.max(0, event.at - previousAt);
                previousAt = event.at;
                elapsed += Math.min(stepDelta, 80);

                const timerId = window.setTimeout(() => {
                    setReplayText(prev => prev + event.data);
                    if (index === playbackEvents.length - 1) {
                        setIsReplayRunning(false);
                    }
                }, elapsed);

                replayTimeoutsRef.current.push(timerId);
            });
        },
        [stopReplay]
    );

    /**
     * Capture terminal data event for active recording
     * 
     * @param data - Terminal output data
     */
    const captureRecordingEvent = useCallback((data: string) => {
        const active = recordingCaptureRef.current;
        if (!active) {
            return;
        }

        const event: TerminalRecordingEvent = {
            type: 'data',
            data,
            at: Date.now() - active.startedAt,
        };

        active.events.push(event);
    }, []);

    return {
        recordings,
        activeRecordingTabId,
        selectedRecordingId,
        selectedRecording,
        selectedRecordingText,
        isReplayRunning,
        replayText,
        recordingCaptureRef,
        completeRecording,
        setSelectedRecordingId,
        setReplayText,
        startRecording,
        stopRecording,
        toggleRecording,
        startReplay,
        stopReplay,
        exportRecording,
        captureRecordingEvent,
    };
}

