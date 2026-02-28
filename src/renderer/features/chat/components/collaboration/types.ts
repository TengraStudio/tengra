export type Strategy = 'consensus' | 'voting' | 'best-of-n' | 'chain-of-thought';

export interface ModelResponse {
    provider: string;
    model: string;
    content: string;
    latency: number;
}

export interface CollaborationResult {
    response?: string;
    responses: ModelResponse[];
    consensus?: string;
    bestResponse?: {
        provider: string;
        model: string;
        content: string;
    };
}

export interface PresenceParticipant {
    id: string;
    name: string;
    role: 'owner' | 'guest' | 'ai';
    isOnline: boolean;
}

export interface CursorMarker {
    id: string;
    user: string;
    target: string;
    highlightedAt: number;
}

export interface ChangeAnnotation {
    id: string;
    author: string;
    note: string;
    timestamp: number;
}
