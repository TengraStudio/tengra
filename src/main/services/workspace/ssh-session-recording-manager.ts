import * as crypto from 'crypto';

import { SSHSessionRecording } from '@shared/types/ssh';

export class SSHSessionRecordingManager {
    private readonly sessionRecordings = new Map<string, SSHSessionRecording>();

    start(connectionId: string): SSHSessionRecording {
        const recording: SSHSessionRecording = {
            id: crypto.randomUUID(),
            connectionId,
            startedAt: Date.now(),
            chunks: []
        };
        this.sessionRecordings.set(connectionId, recording);
        return recording;
    }

    stop(connectionId: string): SSHSessionRecording | null {
        const recording = this.sessionRecordings.get(connectionId);
        if (!recording) {
            return null;
        }
        recording.endedAt = Date.now();
        return recording;
    }

    append(connectionId: string, chunk: string): void {
        const recording = this.sessionRecordings.get(connectionId);
        if (!recording) {
            return;
        }
        recording.chunks.push(chunk);
        if (recording.chunks.length > 10000) {
            recording.chunks.shift();
        }
    }

    get(connectionId: string): SSHSessionRecording | null {
        return this.sessionRecordings.get(connectionId) ?? null;
    }

    search(connectionId: string, query: string): string[] {
        const recording = this.sessionRecordings.get(connectionId);
        if (!recording) {
            return [];
        }
        const normalized = query.toLowerCase();
        return recording.chunks.filter(chunk => chunk.toLowerCase().includes(normalized));
    }

    export(connectionId: string): string {
        const recording = this.sessionRecordings.get(connectionId);
        if (!recording) {
            return '';
        }
        return recording.chunks.join('');
    }

    list(): SSHSessionRecording[] {
        return Array.from(this.sessionRecordings.values());
    }

    clear(): void {
        this.sessionRecordings.clear();
    }
}
