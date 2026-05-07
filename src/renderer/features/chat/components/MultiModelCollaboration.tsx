/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Multi-Model Collaboration Component
 * Allows users to run multiple LLMs simultaneously and compare/combine results
 *
 * PERF-003: Extracted sub-components with React.memo, memoized callbacks with
 * useCallback, and stabilized the presence interval via useRef.
 */

import { IconAlertTriangle, IconCircleCheck, IconCircleX,IconCopy, IconLoader2, IconRefresh, IconSparkles } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ResponsiveContainer } from '@/components/responsive/ResponsiveContainer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Message } from '@/types';

// #region Types

interface MultiModelCollaborationProps {
    messages: Message[]
    onResult?: (result: string) => void
    availableModels?: Array<{ provider: string; model: string; label: string }>
}

type Strategy = 'consensus' | 'voting' | 'best-of-n' | 'chain-of-thought'

type TranslateFn = (key: string, options?: Record<string, string | number>) => string

interface ModelResponse {
    provider: string
    model: string
    content: string
    latency: number
}

interface CollaborationResult {
    response?: string
    responses: ModelResponse[]
    consensus?: string
    bestResponse?: {
        provider: string
        model: string
        content: string
    }
}

interface PresenceParticipant {
    id: string
    name: string
    role: 'owner' | 'guest' | 'ai'
    isOnline: boolean
}

interface CursorMarker {
    id: string
    user: string
    target: string
    highlightedAt: number
}

interface ChangeAnnotation {
    id: string
    author: string
    note: string
    timestamp: number
}

// #endregion Types

// #region Existing Sub-Components

interface ModelItemProps {
    model: { provider: string; model: string }
    onRemove: () => void
    disabled: boolean
    t: TranslateFn
}

const ModelItem: React.FC<ModelItemProps> = ({ model, onRemove, disabled, t }) => (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
        <span className="flex-1 text-sm">{model.provider}/{model.model}</span>
        <Button variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
            {t('frontend.chat.collaboration.remove')}
        </Button>
    </div>
);

interface ResponseCardProps {
    response: ModelResponse
}

const ResponseCard: React.FC<ResponseCardProps> = ({ response }) => (
    <Card className="p-3">
        <div className="flex items-start justify-between mb-2">
            <span className="text-sm font-medium">{response.provider}/{response.model}</span>
            <span className="typo-caption text-muted-foreground">{response.latency}ms</span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">{response.content}</p>
    </Card>
);

interface FinalResultProps {
    results: CollaborationResult
    t: TranslateFn
}

const FinalResult: React.FC<FinalResultProps> = ({ results, t }) => {
    if (!results.consensus && !results.bestResponse) { return null; }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{t('frontend.chat.collaboration.finalResult')}</label>
            <Card className="p-4 bg-primary/5">
                {results.consensus && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <IconCircleCheck className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{t('frontend.chat.collaboration.consensus')}</span>
                        </div>
                        <p className="text-sm">{results.consensus}</p>
                    </div>
                )}
                {results.bestResponse && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <IconCircleCheck className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{t('frontend.chat.collaboration.bestResponse')}</span>
                        </div>
                        <p className="text-sm mb-2">{results.bestResponse.content}</p>
                        <p className="typo-caption text-muted-foreground">
                            {t('frontend.chat.collaboration.from', { provider: results.bestResponse.provider, model: results.bestResponse.model })}
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

// #endregion Existing Sub-Components

// #region Extracted Sub-Components (PERF-003)

interface PresenceCardProps {
    presence: PresenceParticipant[]
    allowGuests: boolean
    onToggleGuests: () => void
    t: TranslateFn
}

/** Displays real-time participant presence indicators. */
const PresenceCard = React.memo<PresenceCardProps>(({ presence, allowGuests, onToggleGuests, t }) => (
    <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('frontend.chat.collaboration.presence')}</span>
            <Button variant={allowGuests ? 'secondary' : 'outline'} size="sm" onClick={onToggleGuests}>
                {allowGuests ? t('frontend.chat.collaboration.guestsAllowed') : t('frontend.chat.collaboration.guestsBlocked')}
            </Button>
        </div>
        {presence.map((participant) => (
            <div key={participant.id} className="typo-caption flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', participant.isOnline ? 'bg-success' : 'bg-muted-foreground')} />
                <span>{participant.name}</span>
            </div>
        ))}
    </Card>
));
PresenceCard.displayName = 'PresenceCard';

interface SharedMemoryCardProps {
    sharedMemoryNote: string
    sharedMemory: string[]
    onNoteChange: (value: string) => void
    onAddMemory: (note: string) => void
    t: TranslateFn
}

/** Allows participants to add and view shared memory notes. */
const SharedMemoryCard = React.memo<SharedMemoryCardProps>(({
    sharedMemoryNote, sharedMemory, onNoteChange, onAddMemory, t
}) => (
    <Card className="p-3 space-y-2">
        <label className="text-sm font-medium">{t('frontend.chat.collaboration.sharedMemory')}</label>
        <div className="flex gap-2">
            <Input
                value={sharedMemoryNote}
                onChange={(event) => { onNoteChange(event.target.value); }}
                placeholder={t('frontend.chat.collaboration.memoryPlaceholder')}
            />
            <Button size="sm" onClick={() => { onAddMemory(sharedMemoryNote); }}>{t('common.add')}</Button>
        </div>
        {sharedMemory.map((entry) => (
            <p key={entry} className="typo-caption text-muted-foreground">{entry}</p>
        ))}
    </Card>
));
SharedMemoryCard.displayName = 'SharedMemoryCard';

interface CursorMarkersCardProps {
    cursorMarkers: CursorMarker[]
    onAddMarker: () => void
    t: TranslateFn
}

/** Shows cursor markers indicating where participants are focused. */
const CursorMarkersCard = React.memo<CursorMarkersCardProps>(({ cursorMarkers, onAddMarker, t }) => (
    <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t('frontend.chat.collaboration.cursorMarkers')}</label>
            <Button size="sm" variant="outline" onClick={onAddMarker}>
                {t('frontend.chat.collaboration.addMarker')}
            </Button>
        </div>
        {cursorMarkers.map((marker) => (
            <p key={marker.id} className="typo-caption text-muted-foreground">
                {marker.user} → {marker.target}
            </p>
        ))}
    </Card>
));
CursorMarkersCard.displayName = 'CursorMarkersCard';

interface AnnotationsCardProps {
    annotations: ChangeAnnotation[]
    onAnnotate: () => void
    t: TranslateFn
}

/** Displays change annotations created by participants. */
const AnnotationsCard = React.memo<AnnotationsCardProps>(({ annotations, onAnnotate, t }) => (
    <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t('frontend.chat.collaboration.changeAnnotations')}</label>
            <Button size="sm" variant="outline" onClick={onAnnotate}>
                {t('frontend.chat.collaboration.annotate')}
            </Button>
        </div>
        {annotations.map((annotation) => (
            <p key={annotation.id} className="typo-caption text-muted-foreground">
                {annotation.author}: {annotation.note}
            </p>
        ))}
    </Card>
));
AnnotationsCard.displayName = 'AnnotationsCard';

interface SessionRecordingCardProps {
    sessionRecording: boolean
    onToggleRecording: () => void
    shareLink: string
    onGenerateLink: () => void
    recordedEvents: string[]
    t: TranslateFn
}

/** Controls session recording and share-link generation. */
const SessionRecordingCard = React.memo<SessionRecordingCardProps>(({
    sessionRecording, onToggleRecording, shareLink, onGenerateLink, recordedEvents, t
}) => (
    <Card className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant={sessionRecording ? 'destructive' : 'outline'}
                onClick={onToggleRecording}
            >
                {sessionRecording ? t('frontend.chat.collaboration.stopRecording') : t('frontend.chat.collaboration.startRecording')}
            </Button>
            <Button size="sm" variant="outline" onClick={onGenerateLink}>
                <IconCopy className="w-3 h-3 mr-1" />
                {t('frontend.chat.collaboration.generateShareLink')}
            </Button>
        </div>
        {shareLink && <Input value={shareLink} readOnly />}
        {recordedEvents.map((event, index) => (
            <p key={`${event}-${index}`} className="typo-caption text-muted-foreground">{event}</p>
        ))}
    </Card>
));
SessionRecordingCard.displayName = 'SessionRecordingCard';

// #endregion Extracted Sub-Components

// #region Custom Hook

interface CollaborationState {
    t: TranslateFn
    selectedModels: Array<{ provider: string; model: string }>
    strategy: Strategy
    setStrategy: React.Dispatch<React.SetStateAction<Strategy>>
    isRunning: boolean
    results: CollaborationResult | null
    error: string | null
    sharedContext: string
    sharedMemoryNote: string
    sharedMemory: string[]
    presence: PresenceParticipant[]
    cursorMarkers: CursorMarker[]
    annotations: ChangeAnnotation[]
    sessionRecording: boolean
    recordedEvents: string[]
    shareLink: string
    allowGuests: boolean
    handleAddModel: () => void
    handleRemoveModel: (index: number) => void
    handleRunClick: () => void
    handleToggleGuests: () => void
    handleNoteChange: (value: string) => void
    handleAddMemory: (note: string) => void
    handleAddCursorMarkerClick: () => void
    handleAnnotateClick: () => void
    handleToggleRecording: () => void
    handleGenerateLink: () => void
    handleContextChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
    handleDismissError: () => void
}

/** Encapsulates all collaboration state and memoized callbacks. */
function useCollaborationState(
    messages: Message[],
    availableModels: Array<{ provider: string; model: string; label: string }>,
    onResult?: (result: string) => void
): CollaborationState {
    const { t } = useTranslation();

    const [selectedModels, setSelectedModels] = useState<Array<{ provider: string; model: string }>>([]);
    const [strategy, setStrategy] = useState<Strategy>('consensus');
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<CollaborationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sharedContext, setSharedContext] = useState('');
    const [sharedMemoryNote, setSharedMemoryNote] = useState('');
    const [sharedMemory, setSharedMemory] = useState<string[]>([]);
    const [presence, setPresence] = useState<PresenceParticipant[]>([
        { id: 'owner', name: t('frontend.chat.collaboration.ownerDisplayName'), role: 'owner', isOnline: true },
        { id: 'guest', name: t('frontend.chat.collaboration.guestReviewerName'), role: 'guest', isOnline: true },
        { id: 'ai', name: t('frontend.chat.collaboration.aiPartnerName'), role: 'ai', isOnline: true }
    ]);
    const [cursorMarkers, setCursorMarkers] = useState<CursorMarker[]>([]);
    const [annotations, setAnnotations] = useState<ChangeAnnotation[]>([]);
    const [sessionRecording, setSessionRecording] = useState(false);
    const [recordedEvents, setRecordedEvents] = useState<string[]>([]);
    const [shareLink, setShareLink] = useState('');
    const [allowGuests, setAllowGuests] = useState(true);
    const sessionId = useMemo(() => `collab-${Date.now().toString(36)}`, []);

    // Refs for stable callbacks that read frequently-changing values
    const sessionRecordingRef = useRef(sessionRecording);
    sessionRecordingRef.current = sessionRecording;
    const allowGuestsRef = useRef(allowGuests);
    allowGuestsRef.current = allowGuests;

    // Memoized presence updater – reads allowGuests via ref so the
    // interval never needs to be torn down and re-created.
    const updatePresence = useCallback(() => {
        setPresence((current) => current.map((p) => {
            if (p.role !== 'guest') { return p; }
            return { ...p, isOnline: allowGuestsRef.current };
        }));
    }, []);

    useEffect(() => {
        const interval = window.setInterval(updatePresence, 3000);
        return () => { window.clearInterval(interval); };
    }, [updatePresence]);

    // Stable recording helper – reads sessionRecording via ref
    const appendRecordingEvent = useCallback((eventText: string): void => {
        if (!sessionRecordingRef.current) { return; }
        const timestamp = new Date().toLocaleTimeString();
        setRecordedEvents((cur) => [`[${timestamp}] ${eventText}`, ...cur].slice(0, 25));
    }, []);

    const handleAddModel = useCallback(() => {
        if (availableModels.length === 0) { return; }
        const first = availableModels[0];
        setSelectedModels((cur) => [...cur, { provider: first.provider, model: first.model }]);
    }, [availableModels]);

    const handleRemoveModel = useCallback((index: number) => {
        setSelectedModels((cur) => cur.filter((_, i) => i !== index));
    }, []);

    const addAnnotation = useCallback((note: string): void => {
        const entry: ChangeAnnotation = {
            id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
            author: t('frontend.chat.collaboration.ownerDisplayName'), note, timestamp: Date.now()
        };
        setAnnotations((cur) => [entry, ...cur].slice(0, 10));
        appendRecordingEvent(`${t('frontend.chat.collaboration.annotationRecorded')}: ${note}`);
    }, [appendRecordingEvent, t]);

    const addCursorMarker = useCallback((user: string, target: string): void => {
        const marker: CursorMarker = {
            id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
            user, target, highlightedAt: Date.now()
        };
        setCursorMarkers((cur) => [marker, ...cur].slice(0, 10));
        appendRecordingEvent(`${t('frontend.chat.collaboration.cursorMarked')}: ${user}`);
    }, [appendRecordingEvent, t]);

    const handleAddMemory = useCallback((note: string): void => {
        const trimmed = note.trim();
        if (!trimmed) { return; }
        setSharedMemory((cur) => [trimmed, ...cur].slice(0, 10));
        setSharedMemoryNote('');
        appendRecordingEvent(`${t('frontend.chat.collaboration.memoryUpdated')}: ${trimmed}`);
    }, [appendRecordingEvent, t]);

    const handleRun = useCallback(async () => {
        if (selectedModels.length === 0) {
            setError(t('frontend.chat.collaboration.selectModelError'));
            return;
        }
        setIsRunning(true);
        setError(null);
        setResults(null);
        try {
            const result = await window.electron.modelCollaboration.run({
                messages, models: selectedModels, strategy
            });
            setResults(result);
            addAnnotation(t('frontend.chat.collaboration.responseSynchronized'));
            addCursorMarker(t('frontend.chat.collaboration.aiPartnerName'), t('frontend.chat.collaboration.latestResponse'));
            appendRecordingEvent(t('frontend.chat.collaboration.collaborationRunFinished'));
            if (result.response) { onResult?.(result.response); }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('frontend.chat.collaboration.runFailed'));
        } finally {
            setIsRunning(false);
        }
    }, [selectedModels, messages, strategy, onResult, t, addAnnotation, addCursorMarker, appendRecordingEvent]);

    const handleRunClick = useCallback(() => {
        void (async () => { await handleRun(); })();
    }, [handleRun]);

    const handleToggleGuests = useCallback(() => {
        setAllowGuests((cur) => !cur);
        appendRecordingEvent(t('frontend.chat.collaboration.guestPolicyChanged'));
    }, [appendRecordingEvent, t]);

    const handleNoteChange = useCallback((value: string) => {
        setSharedMemoryNote(value);
    }, []);

    const handleAddCursorMarkerClick = useCallback(() => {
        addCursorMarker(t('frontend.chat.collaboration.guestReviewerName'), t('frontend.chat.collaboration.promptArea'));
    }, [addCursorMarker, t]);

    const handleAnnotateClick = useCallback(() => {
        addAnnotation(t('frontend.chat.collaboration.annotationTemplate'));
    }, [addAnnotation, t]);

    const handleToggleRecording = useCallback(() => {
        setSessionRecording((cur) => !cur);
        appendRecordingEvent(t('frontend.chat.collaboration.recordingToggled'));
    }, [appendRecordingEvent, t]);

    const handleGenerateLink = useCallback(() => {
        void (async () => {
            const link = `tengra://share/${sessionId}?guest=${allowGuestsRef.current ? '1' : '0'}`;
            setShareLink(link);
            await navigator.clipboard.writeText(link).catch(() => { /* clipboard unavailable */ });
            appendRecordingEvent(t('frontend.chat.collaboration.linkGenerated'));
        })();
    }, [sessionId, appendRecordingEvent, t]);

    const handleContextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setSharedContext(event.target.value);
        appendRecordingEvent(t('frontend.chat.collaboration.contextUpdated'));
    }, [appendRecordingEvent, t]);

    const handleDismissError = useCallback(() => { setError(null); }, []);

    return {
        t, selectedModels, strategy, setStrategy, isRunning, results, error,
        sharedContext, sharedMemoryNote, sharedMemory,
        presence, cursorMarkers, annotations,
        sessionRecording, recordedEvents, shareLink, allowGuests,
        handleAddModel, handleRemoveModel, handleRunClick,
        handleToggleGuests, handleNoteChange, handleAddMemory,
        handleAddCursorMarkerClick, handleAnnotateClick,
        handleToggleRecording, handleGenerateLink, handleContextChange,
        handleDismissError
    };
}

// #endregion Custom Hook

// #region Main Component

export function MultiModelCollaboration({
    messages, onResult, availableModels = []
}: MultiModelCollaborationProps) {
    const s = useCollaborationState(messages, availableModels, onResult);

    return (
        <ResponsiveContainer className="w-full space-y-4">
            <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <IconSparkles className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">{s.t('frontend.chat.collaboration.title')}</h3>
                </div>

                {availableModels.length === 0 && (
                    <div className="p-4 bg-muted/50 border border-muted rounded-md text-center space-y-2">
                        <IconAlertTriangle className="w-6 h-6 text-warning mx-auto" />
                        <p className="text-sm text-muted-foreground">{s.t('frontend.chat.collaboration.noModelsAvailable')}</p>
                    </div>
                )}

                {availableModels.length > 0 && s.selectedModels.length === 0 && !s.isRunning && !s.results && (
                    <div className="p-4 bg-muted/50 border border-dashed border-muted-foreground/25 rounded-md text-center space-y-1">
                        <p className="text-sm font-medium">{s.t('frontend.chat.collaboration.emptyStateTitle')}</p>
                        <p className="typo-caption text-muted-foreground">{s.t('frontend.chat.collaboration.emptyStateDescription')}</p>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium">{s.t('frontend.chat.collaboration.selectedModels')}</label>
                    {s.selectedModels.map((model, index) => (
                        <ModelItem
                            key={index}
                            model={model}
                            onRemove={() => s.handleRemoveModel(index)}
                            disabled={s.isRunning}
                            t={s.t}
                        />
                    ))}
                    <Button variant="outline" size="sm" onClick={s.handleAddModel} disabled={s.isRunning || availableModels.length === 0}>
                        {s.t('frontend.chat.collaboration.addModel')}
                    </Button>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">{s.t('frontend.chat.collaboration.strategy')}</label>
                    <Select value={s.strategy} onValueChange={(v) => s.setStrategy(v as Strategy)} disabled={s.isRunning}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="consensus">{s.t('frontend.chat.collaboration.strategyConsensus')}</SelectItem>
                            <SelectItem value="vote">{s.t('frontend.chat.collaboration.strategyVote')}</SelectItem>
                            <SelectItem value="best-of-n">{s.t('frontend.chat.collaboration.strategyBestOfN')}</SelectItem>
                            <SelectItem value="chain-of-thought">{s.t('frontend.chat.collaboration.strategyChain')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">{s.t('frontend.chat.collaboration.sharedContext')}</label>
                    <Textarea
                        value={s.sharedContext}
                        onChange={s.handleContextChange}
                        placeholder={s.t('frontend.chat.collaboration.sharedContextPlaceholder')}
                        disabled={s.isRunning}
                    />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <PresenceCard
                        presence={s.presence} allowGuests={s.allowGuests}
                        onToggleGuests={s.handleToggleGuests} t={s.t}
                    />
                    <SharedMemoryCard
                        sharedMemoryNote={s.sharedMemoryNote} sharedMemory={s.sharedMemory}
                        onNoteChange={s.handleNoteChange} onAddMemory={s.handleAddMemory} t={s.t}
                    />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <CursorMarkersCard cursorMarkers={s.cursorMarkers} onAddMarker={s.handleAddCursorMarkerClick} t={s.t} />
                    <AnnotationsCard annotations={s.annotations} onAnnotate={s.handleAnnotateClick} t={s.t} />
                </div>

                <SessionRecordingCard
                    sessionRecording={s.sessionRecording} onToggleRecording={s.handleToggleRecording}
                    shareLink={s.shareLink} onGenerateLink={s.handleGenerateLink}
                    recordedEvents={s.recordedEvents} t={s.t}
                />

                <Button onClick={s.handleRunClick} disabled={s.isRunning || s.selectedModels.length === 0} className="w-full">
                    {s.isRunning ? (
                        <><IconLoader2 className="w-4 h-4 mr-2 animate-spin" />{s.t('frontend.chat.collaboration.running')}</>
                    ) : (
                        <><IconSparkles className="w-4 h-4 mr-2" />{s.t('frontend.chat.collaboration.run')}</>
                    )}
                </Button>

                {s.error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md space-y-2">
                        <div className="flex items-center gap-2">
                            <IconCircleX className="w-4 h-4 text-destructive shrink-0" />
                            <span className="text-sm text-destructive flex-1">{s.error}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={s.handleRunClick} disabled={s.isRunning || s.selectedModels.length === 0}>
                                <IconRefresh className="w-3 h-3 mr-1" />{s.t('frontend.chat.collaboration.retry')}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={s.handleDismissError}>
                                {s.t('frontend.chat.collaboration.dismiss')}
                            </Button>
                        </div>
                    </div>
                )}

                {s.results && (
                    <div className="space-y-4 mt-4 pt-4 border-t">
                        <h4 className="font-semibold">{s.t('frontend.chat.collaboration.results')}</h4>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{s.t('frontend.chat.collaboration.individualResponses')}</label>
                            {s.results.responses.map((response, index: number) => (
                                <ResponseCard key={index} response={response} />
                            ))}
                        </div>
                        <FinalResult results={s.results} t={s.t} />
                    </div>
                )}
            </Card>
        </ResponsiveContainer>
    );
}

// #endregion Main Component



