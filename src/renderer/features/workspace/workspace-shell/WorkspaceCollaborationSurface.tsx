import { Bot, Lock, Radio, Users } from 'lucide-react';
import React from 'react';

import { useCollaboration } from '@/features/collaboration/hooks/useCollaboration';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

const MAX_FEED_ENTRIES = 8;
const LOCAL_ACTOR_STORAGE_KEY = 'workspace.collaboration.actor-id';

interface WorkspaceCollaborationSurfaceProps {
    workspaceId: string;
    activeFilePath?: string;
    language: Language;
}

interface WorkspacePresenceEntry {
    actorId: string;
    name: string;
    filePath: string | null;
    isLocal: boolean;
}

interface WorkspaceCollaborationFeedEvent {
    kind: 'workspace:file-focus' | 'workspace:file-release';
    actorId: string;
    actorName: string;
    filePath: string;
    createdAt: number;
}

function getLocalActorId(): string {
    const storedActorId = localStorage.getItem(LOCAL_ACTOR_STORAGE_KEY);
    if (storedActorId) {
        return storedActorId;
    }

    const nextActorId = window.crypto.randomUUID();
    localStorage.setItem(LOCAL_ACTOR_STORAGE_KEY, nextActorId);
    return nextActorId;
}

function readStringField(
    record: Record<string, string | number | boolean | null | undefined>,
    field: string
): string | null {
    const value = record[field];
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function getFileName(filePath: string): string {
    const segments = filePath.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? filePath;
}

function appendFeedEntry(
    currentEntries: WorkspaceCollaborationFeedEvent[],
    nextEntry: WorkspaceCollaborationFeedEvent
): WorkspaceCollaborationFeedEvent[] {
    return [nextEntry, ...currentEntries].slice(0, MAX_FEED_ENTRIES);
}

function parseFeedEvent(payload: string): WorkspaceCollaborationFeedEvent | null {
    try {
        const parsed = JSON.parse(payload);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const record = parsed as Record<string, string | number | boolean | null | undefined>;
        const kind = readStringField(record, 'kind');
        const actorId = readStringField(record, 'actorId');
        const actorName = readStringField(record, 'actorName');
        const filePath = readStringField(record, 'filePath');
        const createdAt = typeof record.createdAt === 'number' ? record.createdAt : Date.now();

        if (
            (kind !== 'workspace:file-focus' && kind !== 'workspace:file-release') ||
            !actorId ||
            !actorName ||
            !filePath
        ) {
            return null;
        }

        return {
            kind,
            actorId,
            actorName,
            filePath,
            createdAt,
        };
    } catch {
        return null;
    }
}

function collectPresence(
    awareness: ReturnType<typeof useCollaboration>['awareness'],
    localActorId: string
): WorkspacePresenceEntry[] {
    if (!awareness) {
        return [];
    }

    const entries: WorkspacePresenceEntry[] = [];
    awareness.getStates().forEach(state => {
        if (!state || typeof state !== 'object' || Array.isArray(state)) {
            return;
        }

        const record = state as Record<
            string,
            string | number | boolean | null | Record<string, string | number | boolean | null>
        >;
        const user = record.user;
        if (!user || typeof user !== 'object' || Array.isArray(user)) {
            return;
        }

        const userRecord = user as Record<string, string | number | boolean | null>;
        const actorId = readStringField(userRecord, 'actorId');
        const name = readStringField(userRecord, 'name');
        if (!actorId || !name) {
            return;
        }

        const filePath = readStringField(
            record as Record<string, string | number | boolean | null | undefined>,
            'filePath'
        );
        entries.push({
            actorId,
            name,
            filePath,
            isLocal: actorId === localActorId,
        });
    });

    return entries;
}

export function WorkspaceCollaborationSurface({
    workspaceId,
    activeFilePath,
    language,
}: WorkspaceCollaborationSurfaceProps): React.ReactElement | null {
    const { t } = useTranslation(language);
    const localActorId = React.useMemo(() => getLocalActorId(), []);
    const roomId = React.useMemo(() => `workspace:${workspaceId}`, [workspaceId]);
    const previousFilePathRef = React.useRef<string | null>(null);
    const [feedEntries, setFeedEntries] = React.useState<WorkspaceCollaborationFeedEvent[]>([]);
    const collaboration = useCollaboration({
        type: 'workspace',
        id: workspaceId,
        enabled: workspaceId.trim().length > 0,
    });

    const emitFeedEvent = React.useCallback(
        async (entry: WorkspaceCollaborationFeedEvent) => {
            try {
                await window.electron.liveCollaboration.sendUpdate({
                    roomId,
                    data: JSON.stringify(entry),
                });
            } catch (error) {
                appLogger.warn('WorkspaceCollaborationSurface', 'Failed to broadcast collaboration event', {
                    roomId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        },
        [roomId]
    );

    React.useEffect(() => {
        if (!collaboration.awareness) {
            return;
        }

        collaboration.awareness.setLocalStateField('user', {
            actorId: localActorId,
            name: t('chat.collaboration.ownerDisplayName'),
        });
    }, [collaboration.awareness, localActorId, t]);

    React.useEffect(() => {
        if (!collaboration.awareness) {
            return;
        }

        collaboration.awareness.setLocalStateField('filePath', activeFilePath ?? null);
        collaboration.awareness.setLocalStateField('updatedAt', Date.now());
    }, [activeFilePath, collaboration.awareness]);

    React.useEffect(() => {
        const unsubscribe = window.electron.liveCollaboration.onSyncUpdate(payload => {
            if (payload.roomId !== roomId) {
                return;
            }

            const nextEntry = parseFeedEvent(payload.data);
            if (!nextEntry || nextEntry.actorId === localActorId) {
                return;
            }

            setFeedEntries(previousEntries => appendFeedEntry(previousEntries, nextEntry));
        });

        return () => {
            unsubscribe();
        };
    }, [localActorId, roomId]);

    React.useEffect(() => {
        if (collaboration.status !== 'connected') {
            return;
        }

        const previousFilePath = previousFilePathRef.current;
        if (previousFilePath === activeFilePath) {
            return;
        }

        previousFilePathRef.current = activeFilePath ?? null;
        if (previousFilePath) {
            const releaseEntry: WorkspaceCollaborationFeedEvent = {
                kind: 'workspace:file-release',
                actorId: localActorId,
                actorName: t('chat.collaboration.ownerDisplayName'),
                filePath: previousFilePath,
                createdAt: Date.now(),
            };
            setFeedEntries(previousEntries => appendFeedEntry(previousEntries, releaseEntry));
            void emitFeedEvent(releaseEntry);
        }

        if (!activeFilePath) {
            return;
        }

        const focusEntry: WorkspaceCollaborationFeedEvent = {
            kind: 'workspace:file-focus',
            actorId: localActorId,
            actorName: t('chat.collaboration.ownerDisplayName'),
            filePath: activeFilePath,
            createdAt: Date.now(),
        };
        setFeedEntries(previousEntries => appendFeedEntry(previousEntries, focusEntry));
        void emitFeedEvent(focusEntry);
    }, [activeFilePath, collaboration.status, emitFeedEvent, localActorId, t]);

    React.useEffect(() => {
        return () => {
            if (collaboration.status !== 'connected' || !previousFilePathRef.current) {
                return;
            }
            void emitFeedEvent({
                kind: 'workspace:file-release',
                actorId: localActorId,
                actorName: t('chat.collaboration.ownerDisplayName'),
                filePath: previousFilePathRef.current,
                createdAt: Date.now(),
            });
        };
    }, [collaboration.status, emitFeedEvent, localActorId, t]);

    const presenceEntries = React.useMemo(
        () => collectPresence(collaboration.awareness, localActorId),
        [collaboration.awareness, localActorId]
    );
    const remoteLocks = React.useMemo(
        () =>
            presenceEntries.filter(
                entry => !entry.isLocal && typeof entry.filePath === 'string' && entry.filePath.length > 0
            ),
        [presenceEntries]
    );

    if (collaboration.status === 'disconnected' && feedEntries.length === 0) {
        return null;
    }

    return (
        <div className="rounded-xl border border-border/40 bg-background/70 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 tw-text-11 font-semibold uppercase tw-tracking-18 text-muted-foreground/60">
                    <Users className="h-3.5 w-3.5" />
                    <span>{t('chat.collaboration.presence')}</span>
                </div>
                <div
                    className={cn(
                        'flex items-center gap-1 tw-text-10 font-semibold uppercase tw-tracking-18',
                        collaboration.status === 'connected'
                            ? 'text-success'
                            : collaboration.status === 'connecting'
                                ? 'text-warning'
                                : 'text-destructive'
                    )}
                >
                    <Radio className="h-3 w-3" />
                    <span>
                        {collaboration.status === 'connected'
                            ? t('common.active')
                            : collaboration.status === 'connecting'
                                ? t('chat.running')
                                : t('common.error')}
                    </span>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {presenceEntries.map(entry => (
                    <div
                        key={entry.actorId}
                        className={cn(
                            'flex tw-min-w-140 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs',
                            entry.isLocal
                                ? 'border-primary/20 bg-primary/5 text-primary'
                                : 'border-border/50 bg-background/60 text-foreground'
                        )}
                    >
                        {entry.isLocal ? (
                            <Bot className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{entry.name}</div>
                            {entry.filePath && (
                                <div className="truncate tw-text-11 text-muted-foreground">
                                    {getFileName(entry.filePath)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {remoteLocks.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {remoteLocks.map(lockEntry => (
                        <div
                            key={`${lockEntry.actorId}:${lockEntry.filePath}`}
                            className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-2.5 py-1.5 text-xs text-warning"
                        >
                            <Lock className="h-3 w-3" />
                            <span className="truncate">{getFileName(lockEntry.filePath ?? '')}</span>
                        </div>
                    ))}
                </div>
            )}

            {feedEntries.length > 0 && (
                <div className="mt-3 border-t border-border/40 pt-3">
                    <div className="tw-text-11 font-semibold uppercase tw-tracking-18 text-muted-foreground/60">
                        {t('agent.history')}
                    </div>
                    <div className="mt-2 space-y-1.5">
                        {feedEntries.map(entry => (
                            <div
                                key={`${entry.actorId}:${entry.filePath}:${entry.createdAt}:${entry.kind}`}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 px-2.5 py-2 text-xs"
                            >
                                <div className="min-w-0">
                                    <div className="truncate font-medium text-foreground">
                                        {entry.actorName}
                                    </div>
                                    <div className="truncate text-muted-foreground">
                                        {getFileName(entry.filePath)}
                                    </div>
                                </div>
                                <div
                                    className={cn(
                                        'shrink-0 tw-text-10 font-semibold uppercase tw-tracking-16',
                                        entry.kind === 'workspace:file-focus'
                                            ? 'text-primary'
                                            : 'text-muted-foreground'
                                    )}
                                >
                                    {entry.kind === 'workspace:file-focus'
                                        ? t('common.active')
                                        : t('common.close')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
