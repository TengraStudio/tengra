import { JsonValue } from './common';

export interface SemanticFragment {
    id: string;
    content: string;
    embedding: number[];
    source: string;
    sourceId: string;
    tags: string[];
    importance: number;
    projectId?: string;
    createdAt: number;
    updatedAt: number;
    [key: string]: JsonValue | undefined;
}

export interface EpisodicMemory {
    id: string;
    title: string;
    summary: string;
    embedding: number[];
    startDate: number;
    endDate: number;
    chatId: string;
    participants: string[];
    createdAt: number;
}

export interface EntityKnowledge {
    id: string;
    entityType: string;
    entityName: string;
    key: string;
    value: string;
    confidence: number;
    source: string;
    updatedAt: number;
}
