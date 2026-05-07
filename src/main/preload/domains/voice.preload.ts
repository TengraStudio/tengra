/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { VOICE_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface VoiceBridge {
    detectWakeWord: (payload: { transcript: string; wakeWord?: string }) => Promise<{
        activated: boolean;
        wakeWord: string;
        intent: 'none' | 'new_chat' | 'open_settings' | 'stop_speaking' | 'send_message' | 'search_workspace';
        commandText: string;
        confidence: number;
    }>;
    startSession: (payload?: { wakeWord?: string; locale?: string }) => Promise<{
        id: string;
        wakeWord: string;
        locale: string;
        state: 'listening' | 'speaking' | 'idle';
        turnCount: number;
        startedAt: number;
        updatedAt: number;
    }>;
    submitUtterance: (payload: {
        sessionId: string;
        transcript: string;
        assistantSpeaking?: boolean;
    }) => Promise<{
        session: {
            id: string;
            wakeWord: string;
            locale: string;
            state: 'listening' | 'speaking' | 'idle';
            turnCount: number;
            startedAt: number;
            updatedAt: number;
        };
        interruptAssistant: boolean;
        intent: 'none' | 'new_chat' | 'open_settings' | 'stop_speaking' | 'send_message' | 'search_workspace';
        commandText: string;
        responseMode: 'listen' | 'speak' | 'idle';
    }>;
    endSession: (sessionId: string) => Promise<{ success: true }>;
    createNote: (payload: { title?: string; transcript: string }) => Promise<{
        id: string;
        title: string;
        transcript: string;
        summary: string;
        keyPoints: string[];
        actionItems: string[];
        highlights: Array<{ timestampSec: number; text: string; speaker: string }>;
        speakers: string[];
        createdAt: number;
        updatedAt: number;
    }>;
    listNotes: () => Promise<{
        notes: Array<{
            id: string;
            title: string;
            transcript: string;
            summary: string;
            keyPoints: string[];
            actionItems: string[];
            highlights: Array<{ timestampSec: number; text: string; speaker: string }>;
            speakers: string[];
            createdAt: number;
            updatedAt: number;
        }>
    }>;
    getNote: (noteId: string) => Promise<{
        id: string;
        title: string;
        transcript: string;
        summary: string;
        keyPoints: string[];
        actionItems: string[];
        highlights: Array<{ timestampSec: number; text: string; speaker: string }>;
        speakers: string[];
        createdAt: number;
        updatedAt: number;
    }>;
}

export function createVoiceBridge(ipc: IpcRenderer): VoiceBridge {
    return {
        detectWakeWord: payload => ipc.invoke(VOICE_CHANNELS.DETECT_WAKE_WORD, payload),
        startSession: payload => ipc.invoke(VOICE_CHANNELS.START_SESSION, payload),
        submitUtterance: payload => ipc.invoke(VOICE_CHANNELS.SUBMIT_UTTERANCE, payload),
        endSession: sessionId => ipc.invoke(VOICE_CHANNELS.END_SESSION, sessionId),
        createNote: payload => ipc.invoke(VOICE_CHANNELS.CREATE_NOTE, payload),
        listNotes: () => ipc.invoke(VOICE_CHANNELS.LIST_NOTES),
        getNote: noteId => ipc.invoke(VOICE_CHANNELS.GET_NOTE, noteId),
    };
}

