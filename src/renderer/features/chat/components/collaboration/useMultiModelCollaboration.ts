/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Message } from '@/types';

import { ChangeAnnotation,CollaborationResult, CursorMarker, PresenceParticipant, Strategy } from './types';

interface UseMultiModelCollaborationProps {
    messages: Message[];
    onResult?: (result: string) => void;
    availableModels: Array<{ provider: string; model: string; label: string }>;
    t: (key: string, options?: Record<string, string | number>) => string;
}

export function useMultiModelCollaboration({
    messages,
    onResult,
    availableModels,
    t
}: UseMultiModelCollaborationProps) {
    const [selectedModels, setSelectedModels] = useState<Array<{ provider: string; model: string }>>([]);
    const [strategy, setStrategy] = useState<Strategy>('consensus');
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<CollaborationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sharedContext, setSharedContext] = useState('');
    const [sharedMemoryNote, setSharedMemoryNote] = useState('');
    const [sharedMemory, setSharedMemory] = useState<string[]>([]);
    const [presence, setPresence] = useState<PresenceParticipant[]>([
        { id: 'owner', name: 'You', role: 'owner', isOnline: true },
        { id: 'guest', name: 'Guest Reviewer', role: 'guest', isOnline: true },
        { id: 'ai', name: 'AI Partner', role: 'ai', isOnline: true }
    ]);
    const [cursorMarkers, setCursorMarkers] = useState<CursorMarker[]>([]);
    const [annotations, setAnnotations] = useState<ChangeAnnotation[]>([]);
    const [sessionRecording, setSessionRecording] = useState(false);
    const [recordedEvents, setRecordedEvents] = useState<string[]>([]);
    const [shareLink, setShareLink] = useState('');
    const [allowGuests, setAllowGuests] = useState(true);

    const sessionId = useMemo(() => `collab-${Date.now().toString(36)}`, []);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setPresence((current) => current.map((participant) => {
                if (participant.role !== 'guest') {
                    return participant;
                }
                return { ...participant, isOnline: allowGuests };
            }));
        }, 3000);
        return () => { window.clearInterval(interval); };
    }, [allowGuests]);

    const appendRecordingEvent = useCallback((eventText: string): void => {
        if (!sessionRecording) {
            return;
        }
        const timestamp = new Date().toLocaleTimeString();
        setRecordedEvents((current) => [`[${timestamp}] ${eventText}`, ...current].slice(0, 25));
    }, [sessionRecording]);

    const handleAddModel = useCallback(() => {
        if (availableModels.length > 0) {
            const firstModel = availableModels[0];
            setSelectedModels((prev) => [...prev, {
                provider: firstModel.provider,
                model: firstModel.model
            }]);
        }
    }, [availableModels]);

    const handleRemoveModel = useCallback((index: number) => {
        setSelectedModels((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const addAnnotation = useCallback((note: string): void => {
        const entry: ChangeAnnotation = {
            id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
            author: 'You',
            note,
            timestamp: Date.now()
        };
        setAnnotations((current) => [entry, ...current].slice(0, 10));
        appendRecordingEvent(`${t('chat.collaboration.annotationRecorded')}: ${note}`);
    }, [appendRecordingEvent, t]);

    const addCursorMarker = useCallback((user: string, target: string): void => {
        const marker: CursorMarker = {
            id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
            user,
            target,
            highlightedAt: Date.now()
        };
        setCursorMarkers((current) => [marker, ...current].slice(0, 10));
        appendRecordingEvent(`${t('chat.collaboration.cursorMarked')}: ${user}`);
    }, [appendRecordingEvent, t]);

    const handleAddMemory = useCallback((): void => {
        const trimmed = sharedMemoryNote.trim();
        if (!trimmed) {
            return;
        }
        setSharedMemory((current) => [trimmed, ...current].slice(0, 10));
        setSharedMemoryNote('');
        appendRecordingEvent(`${t('chat.collaboration.memoryUpdated')}: ${trimmed}`);
    }, [appendRecordingEvent, sharedMemoryNote, t]);

    const handleRun = useCallback(async () => {
        if (selectedModels.length === 0) {
            setError(t('chat.collaboration.selectModelError'));
            return;
        }

        setIsRunning(true);
        setError(null);
        setResults(null);

        try {
            const result = await window.electron.modelCollaboration.run({
                messages,
                models: selectedModels,
                strategy
            });

            setResults(result);
            addAnnotation(t('chat.collaboration.responseSynchronized'));
            addCursorMarker('AI Partner', t('chat.collaboration.latestResponse'));
            appendRecordingEvent(t('chat.collaboration.collaborationRunFinished'));

            if (result.response) {
                onResult?.(result.response);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('chat.collaboration.runFailed'));
        } finally {
            setIsRunning(false);
        }
    }, [selectedModels, strategy, messages, onResult, addAnnotation, addCursorMarker, appendRecordingEvent, t]);

    const generateShareLink = useCallback(() => {
        void (async () => {
            const link = `tengra://share/${sessionId}?guest=${allowGuests ? '1' : '0'}`;
            setShareLink(link);
            await navigator.clipboard.writeText(link).catch(() => { });
            appendRecordingEvent(t('chat.collaboration.linkGenerated'));
        })();
    }, [sessionId, allowGuests, appendRecordingEvent, t]);

    return {
        selectedModels,
        strategy,
        isRunning,
        results,
        error,
        sharedContext,
        sharedMemoryNote,
        sharedMemory,
        presence,
        cursorMarkers,
        annotations,
        sessionRecording,
        recordedEvents,
        shareLink,
        allowGuests,
        sessionId,
        setStrategy,
        setSharedContext,
        setSharedMemoryNote,
        setSessionRecording,
        setAllowGuests,
        setError,
        handleAddModel,
        handleRemoveModel,
        handleAddMemory,
        handleRun,
        addAnnotation,
        addCursorMarker,
        appendRecordingEvent,
        generateShareLink
    };
}
