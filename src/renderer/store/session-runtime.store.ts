import {
    SessionCapabilityDescriptor,
    SessionEventEnvelope,
    SessionRecoverySnapshot,
    SessionState,
} from '@shared/types/session-engine';

const SESSION_EVENT_FLUSH_DELAY_MS = 50;

type Listener = () => void;

const listeners = new Set<Listener>();
const sessionStates = new Map<string, SessionState | null>();

let sessionRecoverySnapshots: SessionRecoverySnapshot[] = [];
let sessionCapabilityCatalog: SessionCapabilityDescriptor[] = [];
let eventUnsubscribe: (() => void) | null = null;
let recoverySnapshotsLoaded = false;
let capabilityCatalogLoaded = false;
let scheduledEventFlushId: number | null = null;

const queuedSessionIds = new Set<string>();
const sessionRefreshes = new Map<string, Promise<SessionState | null>>();

let recoverySnapshotRefresh: Promise<SessionRecoverySnapshot[]> | null = null;
let capabilityCatalogRefresh: Promise<SessionCapabilityDescriptor[]> | null = null;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function canUseSessionBridge(): boolean {
    return typeof window !== 'undefined' && Boolean(window.electron?.session);
}

function canSubscribeToSessionEvents(): boolean {
    return canUseSessionBridge() && typeof window.electron.session.onEvent === 'function';
}

function canReadSessionState(): boolean {
    return canUseSessionBridge() && typeof window.electron.session.getState === 'function';
}

function canListSessionSnapshots(): boolean {
    return canUseSessionBridge() && typeof window.electron.session.list === 'function';
}

function canListSessionCapabilities(): boolean {
    return canUseSessionBridge() && typeof window.electron.session.listCapabilities === 'function';
}

function queueSessionRefresh(sessionId: string): void {
    queuedSessionIds.add(sessionId);
    if (scheduledEventFlushId !== null || !canUseSessionBridge()) {
        return;
    }

    scheduledEventFlushId = window.setTimeout(() => {
        const sessionIds = Array.from(queuedSessionIds);
        queuedSessionIds.clear();
        scheduledEventFlushId = null;
        void flushQueuedSessionUpdates(sessionIds);
    }, SESSION_EVENT_FLUSH_DELAY_MS);
}

async function flushQueuedSessionUpdates(sessionIds: string[]): Promise<void> {
    const refreshTasks: Promise<SessionState | null | SessionRecoverySnapshot[]>[] = sessionIds.map(
        sessionId => refreshSessionState(sessionId)
    );
    refreshTasks.push(refreshSessionRecoverySnapshots());
    await Promise.allSettled(refreshTasks);
}

function ensureEventSubscription(): void {
    if (!canSubscribeToSessionEvents() || eventUnsubscribe) {
        return;
    }

    eventUnsubscribe = window.electron.session.onEvent((event: SessionEventEnvelope) => {
        queueSessionRefresh(event.sessionId);
    });
}

function updateSessionStateCache(sessionId: string, nextState: SessionState | null): SessionState | null {
    if (nextState) {
        sessionStates.set(sessionId, nextState);
    } else {
        sessionStates.delete(sessionId);
    }
    emit();
    return nextState;
}

function updateRecoverySnapshotCache(
    snapshots: SessionRecoverySnapshot[]
): SessionRecoverySnapshot[] {
    sessionRecoverySnapshots = snapshots;
    recoverySnapshotsLoaded = true;
    emit();
    return snapshots;
}

function updateCapabilityCatalogCache(
    descriptors: SessionCapabilityDescriptor[]
): SessionCapabilityDescriptor[] {
    sessionCapabilityCatalog = descriptors;
    capabilityCatalogLoaded = true;
    emit();
    return descriptors;
}

export function subscribeSessionRuntime(listener: Listener): () => void {
    ensureEventSubscription();
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getSessionStateSnapshot(sessionId: string | null): SessionState | null {
    if (!sessionId) {
        return null;
    }
    return sessionStates.get(sessionId) ?? null;
}

export async function refreshSessionState(sessionId: string): Promise<SessionState | null> {
    if (!canReadSessionState()) {
        return updateSessionStateCache(sessionId, null);
    }

    const inFlight = sessionRefreshes.get(sessionId);
    if (inFlight) {
        return inFlight;
    }

    const refreshPromise = window.electron.session
        .getState(sessionId)
        .then(nextState => updateSessionStateCache(sessionId, nextState))
        .finally(() => {
            sessionRefreshes.delete(sessionId);
        });

    sessionRefreshes.set(sessionId, refreshPromise);
    return refreshPromise;
}

export async function ensureSessionState(sessionId: string | null): Promise<SessionState | null> {
    ensureEventSubscription();
    if (!sessionId) {
        return null;
    }
    if (sessionStates.has(sessionId)) {
        return sessionStates.get(sessionId) ?? null;
    }
    return refreshSessionState(sessionId);
}

export function getSessionRecoverySnapshotList(): SessionRecoverySnapshot[] {
    return sessionRecoverySnapshots;
}

export async function refreshSessionRecoverySnapshots(): Promise<SessionRecoverySnapshot[]> {
    if (!canListSessionSnapshots()) {
        return updateRecoverySnapshotCache([]);
    }

    if (recoverySnapshotRefresh) {
        return recoverySnapshotRefresh;
    }

    recoverySnapshotRefresh = window.electron.session
        .list()
        .then(snapshots => updateRecoverySnapshotCache(snapshots))
        .finally(() => {
            recoverySnapshotRefresh = null;
        });

    return recoverySnapshotRefresh;
}

export async function ensureSessionRecoverySnapshots(): Promise<SessionRecoverySnapshot[]> {
    ensureEventSubscription();
    if (recoverySnapshotsLoaded) {
        return sessionRecoverySnapshots;
    }
    return refreshSessionRecoverySnapshots();
}

export function getSessionCapabilityCatalogSnapshot(): SessionCapabilityDescriptor[] {
    return sessionCapabilityCatalog;
}

export async function refreshSessionCapabilityCatalog(): Promise<SessionCapabilityDescriptor[]> {
    if (!canListSessionCapabilities()) {
        return updateCapabilityCatalogCache([]);
    }

    if (capabilityCatalogRefresh) {
        return capabilityCatalogRefresh;
    }

    capabilityCatalogRefresh = window.electron.session
        .listCapabilities()
        .then(descriptors => updateCapabilityCatalogCache(descriptors))
        .finally(() => {
            capabilityCatalogRefresh = null;
        });

    return capabilityCatalogRefresh;
}

export async function ensureSessionCapabilityCatalog(): Promise<SessionCapabilityDescriptor[]> {
    ensureEventSubscription();
    if (capabilityCatalogLoaded) {
        return sessionCapabilityCatalog;
    }
    return refreshSessionCapabilityCatalog();
}
