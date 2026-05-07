/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { JsonValue } from '../common';

export interface SemanticFragment {
    id: string;
    content: string;
    embedding: number[];
    source: string;
    sourceId: string;
    tags: string[];
    importance: number;
    workspaceId?: string;
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

