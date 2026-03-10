import {
    SessionRecoverySnapshot,
    SessionState,
} from '@shared/types/session-engine';

export interface SessionRegistryReader {
    getSnapshot(sessionId: string): SessionState | null;
    listRecoverySnapshots(): SessionRecoverySnapshot[];
}
