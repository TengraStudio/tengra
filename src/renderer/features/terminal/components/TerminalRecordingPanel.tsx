/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDownload, IconPlayerPlay, IconSquare, IconX } from '@tabler/icons-react';

import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_TERMINALRECORDINGPANEL_1 = "absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 w-460 max-w-95vw";
const C_TERMINALRECORDINGPANEL_2 = "h-7 px-2 rounded typo-caption border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1";
const C_TERMINALRECORDINGPANEL_3 = "h-7 px-2 rounded typo-caption border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1";
const C_TERMINALRECORDINGPANEL_4 = "h-7 px-2 rounded typo-caption border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1";


interface TerminalRecordingEvent {
    at: number;
    type: 'data' | 'exit';
    data: string;
}

interface TerminalRecordingItem {
    id: string;
    tabId: string;
    tabName: string;
    startedAt: number;
    endedAt: number;
    durationMs: number;
    events: TerminalRecordingEvent[];
}

interface TerminalRecordingPanelProps {
    t: (key: string, options?: Record<string, string | number>) => string;
    hasActiveSession: boolean;
    activeRecordingTabId: string | null;
    activeRecordingLabel: string | null;
    recordings: TerminalRecordingItem[];
    selectedRecordingId: string | null;
    selectedRecording: TerminalRecordingItem | null;
    selectedRecordingText: string;
    replayText: string;
    isReplayRunning: boolean;
    setIsRecordingPanelOpen: (value: boolean) => void;
    toggleRecording: () => void;
    startReplay: (recording: TerminalRecordingItem) => void;
    stopReplay: () => void;
    exportRecording: (recording: TerminalRecordingItem) => void;
    setSelectedRecordingId: (value: string | null) => void;
    setReplayText: (value: string) => void;
}

export function TerminalRecordingPanel({
    t,
    hasActiveSession,
    activeRecordingTabId,
    activeRecordingLabel,
    recordings,
    selectedRecordingId,
    selectedRecording,
    selectedRecordingText,
    replayText,
    isReplayRunning,
    setIsRecordingPanelOpen,
    toggleRecording,
    startReplay,
    stopReplay,
    exportRecording,
    setSelectedRecordingId,
    setReplayText,
}: TerminalRecordingPanelProps) {
    return (
        <div className={C_TERMINALRECORDINGPANEL_1}>
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="typo-caption font-semibold text-foreground">{t('frontend.terminal.recordingsTitle')}</div>
                <button
                    onClick={() => {
                        setIsRecordingPanelOpen(false);
                        stopReplay();
                    }}
                    className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t('common.close')}
                >
                    <IconX className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="flex items-center gap-1 mb-2">
                <button
                    onClick={toggleRecording}
                    disabled={!hasActiveSession && !activeRecordingTabId}
                    className={cn(
                        'h-7 px-2 rounded typo-caption border transition-colors',
                        activeRecordingTabId
                            ? 'border-destructive/50 bg-destructive/10 text-destructive'
                            : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'
                    )}
                >
                    {activeRecordingTabId ? t('frontend.terminal.stopRecording') : t('frontend.terminal.startRecording')}
                </button>
                <button
                    onClick={() => {
                        if (selectedRecording) {
                            startReplay(selectedRecording);
                        }
                    }}
                    disabled={!selectedRecording || isReplayRunning}
                    className={C_TERMINALRECORDINGPANEL_2}
                >
                    <IconPlayerPlay className="w-3 h-3" />
                    {t('frontend.terminal.replay')}
                </button>
                <button
                    onClick={stopReplay}
                    disabled={!isReplayRunning}
                    className={C_TERMINALRECORDINGPANEL_3}
                >
                    <IconSquare className="w-3 h-3" />
                    {t('common.stop')}
                </button>
                <button
                    onClick={() => {
                        if (selectedRecording) {
                            exportRecording(selectedRecording);
                        }
                    }}
                    disabled={!selectedRecording}
                    className={C_TERMINALRECORDINGPANEL_4}
                >
                    <IconDownload className="w-3 h-3" />
                    {t('frontend.terminal.exportRecording')}
                </button>
            </div>
            {activeRecordingTabId && (
                <div className="mb-2 px-2 py-1 rounded border border-destructive/30 bg-destructive/5 typo-overline text-destructive">
                    {t('frontend.terminal.recordingActive')}: {activeRecordingLabel ?? activeRecordingTabId}
                </div>
            )}
            <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1 mb-2">
                {recordings.length === 0 && (
                    <div className="px-2 py-2 typo-caption text-muted-foreground">{t('frontend.terminal.noRecordingsYet')}</div>
                )}
                {recordings.map(recording => (
                    <button
                        key={recording.id}
                        onClick={() => {
                            setSelectedRecordingId(recording.id);
                            setReplayText('');
                            stopReplay();
                        }}
                        className={cn(
                            'w-full text-left px-2 py-1.5 rounded border transition-colors',
                            selectedRecordingId === recording.id
                                ? 'border-primary/60 bg-primary/10'
                                : 'border-border/60 hover:bg-accent/40'
                        )}
                    >
                        <div className="typo-caption text-foreground truncate">{recording.tabName}</div>
                        <div className="typo-overline text-muted-foreground truncate">
                            {new Date(recording.startedAt).toLocaleString()} -{' '}
                            {(recording.durationMs / 1000).toFixed(1)}s - {recording.events.length}{' '}
                            {t('frontend.terminal.eventsLabel')}
                        </div>
                    </button>
                ))}
            </div>
            {selectedRecording && (
                <div className="rounded border border-border/60 bg-background/70">
                    <div className="px-2 py-1 border-b border-border/60 typo-overline text-muted-foreground">
                        {t('frontend.terminal.replayPreview')}
                    </div>
                    <pre className="p-2 typo-overline leading-4 text-foreground max-h-44 overflow-auto whitespace-pre-wrap break-words">
                        {isReplayRunning || replayText ? replayText : selectedRecordingText}
                    </pre>
                </div>
            )}
        </div>
    );
}

