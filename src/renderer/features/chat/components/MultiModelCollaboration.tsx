/**
 * Multi-Model Collaboration Component
 * Allows users to run multiple LLMs simultaneously and compare/combine results
 */

import { CheckCircle2, Copy, Loader2, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ResponsiveContainer } from '@/components/responsive/ResponsiveContainer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';
import { Message } from '@/types';

interface MultiModelCollaborationProps {
    messages: Message[]
    onResult?: (result: string) => void
    availableModels?: Array<{ provider: string; model: string; label: string }>
}

type Strategy = 'consensus' | 'voting' | 'best-of-n' | 'chain-of-thought'

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

interface ModelItemProps {
    model: { provider: string; model: string }
    onRemove: () => void
    disabled: boolean
}

const ModelItem: React.FC<ModelItemProps & { t: (key: string) => string }> = ({ model, onRemove, disabled, t }) => (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
        <span className="flex-1 text-sm">{model.provider}/{model.model}</span>
        <Button variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
            {t('chat.collaboration.remove')}
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
            <span className="text-xs text-muted-foreground">{response.latency}ms</span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">{response.content}</p>
    </Card>
);

interface FinalResultProps {
    results: CollaborationResult
}

const FinalResult: React.FC<FinalResultProps & { t: (key: string, options?: Record<string, string | number>) => string }> = ({ results, t }) => {
    if (!results.consensus && !results.bestResponse) { return null; }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{t('chat.collaboration.finalResult')}</label>
            <Card className="p-4 bg-primary/5">
                {results.consensus && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{t('chat.collaboration.consensus')}</span>
                        </div>
                        <p className="text-sm">{results.consensus}</p>
                    </div>
                )}
                {results.bestResponse && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{t('chat.collaboration.bestResponse')}</span>
                        </div>
                        <p className="text-sm mb-2">{results.bestResponse.content}</p>
                        <p className="text-xs text-muted-foreground">
                            {t('chat.collaboration.from', { provider: results.bestResponse.provider, model: results.bestResponse.model })}
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export function MultiModelCollaboration({
    messages,
    onResult,
    availableModels = []
}: MultiModelCollaborationProps) {
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

    const appendRecordingEvent = (eventText: string): void => {
        if (!sessionRecording) {
            return;
        }
        const timestamp = new Date().toLocaleTimeString();
        setRecordedEvents((current) => [`[${timestamp}] ${eventText}`, ...current].slice(0, 25));
    };

    const handleAddModel = () => {
        if (availableModels.length > 0) {
            const firstModel = availableModels[0];
            setSelectedModels([...selectedModels, {
                provider: firstModel.provider,
                model: firstModel.model
            }]);
        }
    };

    const handleRemoveModel = (index: number) => {
        setSelectedModels(selectedModels.filter((_, i) => i !== index));
    };

    const addAnnotation = (note: string): void => {
        const entry: ChangeAnnotation = {
            id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
            author: 'You',
            note,
            timestamp: Date.now()
        };
        setAnnotations((current) => [entry, ...current].slice(0, 10));
        appendRecordingEvent(`${t('chat.collaboration.annotationRecorded')}: ${note}`);
    };

    const addCursorMarker = (user: string, target: string): void => {
        const marker: CursorMarker = {
            id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
            user,
            target,
            highlightedAt: Date.now()
        };
        setCursorMarkers((current) => [marker, ...current].slice(0, 10));
        appendRecordingEvent(`${t('chat.collaboration.cursorMarked')}: ${user}`);
    };

    const handleAddMemory = (): void => {
        const trimmed = sharedMemoryNote.trim();
        if (!trimmed) {
            return;
        }
        setSharedMemory((current) => [trimmed, ...current].slice(0, 10));
        setSharedMemoryNote('');
        appendRecordingEvent(`${t('chat.collaboration.memoryUpdated')}: ${trimmed}`);
    };

    const handleRun = async () => {
        if (selectedModels.length === 0) {
            setError(t('chat.collaboration.selectModelError'));
            return;
        }

        setIsRunning(true);
        setError(null);
        setResults(null);

        try {
            const result = await window.electron.collaboration.run({
                messages,
                models: selectedModels,
                strategy
            });

            setResults(result);
            addAnnotation(t('chat.collaboration.responseSynchronized'));
            addCursorMarker('AI Partner', t('chat.collaboration.latestResponse'));
            appendRecordingEvent(t('chat.collaboration.collaborationRunFinished'));
            // Use the main response field from the result
            if (result.response) {
                onResult?.(result.response);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('chat.collaboration.runFailed'));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <ResponsiveContainer className="w-full space-y-4">
            <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">{t('chat.collaboration.title')}</h3>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">{t('chat.collaboration.selectedModels')}</label>
                    {selectedModels.map((model, index) => (
                        <ModelItem
                            key={index}
                            model={model}
                            onRemove={() => handleRemoveModel(index)}
                            disabled={isRunning}
                            t={t}
                        />
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddModel}
                        disabled={isRunning || availableModels.length === 0}
                    >
                        {t('chat.collaboration.addModel')}
                    </Button>
                </div>

                {/* Strategy Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">{t('chat.collaboration.strategy')}</label>
                    <Select
                        value={strategy}
                        onValueChange={(value) => setStrategy(value as Strategy)}
                        disabled={isRunning}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="consensus">{t('chat.collaboration.strategyConsensus')}</SelectItem>
                            <SelectItem value="vote">{t('chat.collaboration.strategyVote')}</SelectItem>
                            <SelectItem value="best-of-n">{t('chat.collaboration.strategyBestOfN')}</SelectItem>
                            <SelectItem value="chain-of-thought">{t('chat.collaboration.strategyChain')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">{t('chat.collaboration.sharedContext')}</label>
                    <Textarea
                        value={sharedContext}
                        onChange={(event) => {
                            setSharedContext(event.target.value);
                            appendRecordingEvent(t('chat.collaboration.contextUpdated'));
                        }}
                        placeholder={t('chat.collaboration.sharedContextPlaceholder')}
                        disabled={isRunning}
                    />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <Card className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{t('chat.collaboration.presence')}</span>
                            <Button
                                variant={allowGuests ? 'secondary' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setAllowGuests((current) => !current);
                                    appendRecordingEvent(t('chat.collaboration.guestPolicyChanged'));
                                }}
                            >
                                {allowGuests ? t('chat.collaboration.guestsAllowed') : t('chat.collaboration.guestsBlocked')}
                            </Button>
                        </div>
                        {presence.map((participant) => (
                            <div key={participant.id} className="text-xs flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${participant.isOnline ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                                <span>{participant.name}</span>
                            </div>
                        ))}
                    </Card>
                    <Card className="p-3 space-y-2">
                        <label className="text-sm font-medium">{t('chat.collaboration.sharedMemory')}</label>
                        <div className="flex gap-2">
                            <Input
                                value={sharedMemoryNote}
                                onChange={(event) => { setSharedMemoryNote(event.target.value); }}
                                placeholder={t('chat.collaboration.memoryPlaceholder')}
                            />
                            <Button size="sm" onClick={handleAddMemory}>{t('common.add')}</Button>
                        </div>
                        {sharedMemory.map((entry) => (
                            <p key={entry} className="text-xs text-muted-foreground">{entry}</p>
                        ))}
                    </Card>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <Card className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">{t('chat.collaboration.cursorMarkers')}</label>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { addCursorMarker('Guest Reviewer', t('chat.collaboration.promptArea')); }}
                            >
                                {t('chat.collaboration.addMarker')}
                            </Button>
                        </div>
                        {cursorMarkers.map((marker) => (
                            <p key={marker.id} className="text-xs text-muted-foreground">
                                {marker.user} → {marker.target}
                            </p>
                        ))}
                    </Card>
                    <Card className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">{t('chat.collaboration.changeAnnotations')}</label>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { addAnnotation(t('chat.collaboration.annotationTemplate')); }}
                            >
                                {t('chat.collaboration.annotate')}
                            </Button>
                        </div>
                        {annotations.map((annotation) => (
                            <p key={annotation.id} className="text-xs text-muted-foreground">
                                {annotation.author}: {annotation.note}
                            </p>
                        ))}
                    </Card>
                </div>

                <Card className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            variant={sessionRecording ? 'destructive' : 'outline'}
                            onClick={() => {
                                setSessionRecording((current) => !current);
                                appendRecordingEvent(t('chat.collaboration.recordingToggled'));
                            }}
                        >
                            {sessionRecording ? t('chat.collaboration.stopRecording') : t('chat.collaboration.startRecording')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                void (async () => {
                                    const link = `tengra://share/${sessionId}?guest=${allowGuests ? '1' : '0'}`;
                                    setShareLink(link);
                                    await navigator.clipboard.writeText(link).catch(() => {});
                                    appendRecordingEvent(t('chat.collaboration.linkGenerated'));
                                })();
                            }}
                        >
                            <Copy className="w-3 h-3 mr-1" />
                            {t('chat.collaboration.generateShareLink')}
                        </Button>
                    </div>
                    {shareLink && <Input value={shareLink} readOnly />}
                    {recordedEvents.map((event, index) => (
                        <p key={`${event}-${index}`} className="text-xs text-muted-foreground">{event}</p>
                    ))}
                </Card>

                {/* Run Button */}
                <Button
                    onClick={() => { void (async () => { await handleRun(); })(); }}
                    disabled={isRunning || selectedModels.length === 0}
                    className="w-full"
                >
                    {isRunning ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('chat.collaboration.running')}
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            {t('chat.collaboration.run')}
                        </>
                    )}
                </Button>

                {/* Error Display */}
                {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">{error}</span>
                    </div>
                )}

                {/* Results Display */}
                {results && (
                    <div className="space-y-4 mt-4 pt-4 border-t">
                        <h4 className="font-semibold">{t('chat.collaboration.results')}</h4>
                        
                        {/* Individual Responses */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('chat.collaboration.individualResponses')}</label>
                            {results.responses.map((response, index: number) => (
                                <ResponseCard key={index} response={response} />
                            ))}
                        </div>

                        {/* Consensus/Best Response */}
                        <FinalResult results={results} t={t} />
                    </div>
                )}
            </Card>
        </ResponsiveContainer>
    );
}

