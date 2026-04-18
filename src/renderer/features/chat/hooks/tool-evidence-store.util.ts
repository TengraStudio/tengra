/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { 
    AiEvidenceRecord, 
    AiEvidenceStoreSnapshot,
} from '@shared/types/ai-runtime';
import { Message, ToolCall, ToolResult } from '@shared/types/chat';
import { JsonValue } from '@shared/types/common';

/**
 * Renderer-side utility to manage the in-memory evidence store for the current chat session.
 * This mirrors parts of the main process evidence logic for UI feedback and local loop control.
 */
export class ToolEvidenceStore {
    private records: AiEvidenceRecord[] = [];
    private totalSatisfaction: number = 0;

    constructor() {}

    /**
     * Integrates new tool results into the renderer's view of evidence.
     * This is used for real-time UI updates during model turns.
     */
    integrateToolResult(
        toolName: string, 
        result: ToolResult, 
    ): AiEvidenceRecord[] {
        const id = `ev-render-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        let score = 0.2;
        if (result.success) {
            score = 0.6;
            if (result.isComplete) {score = 1.0;}
        }

        const record: AiEvidenceRecord = {
            id,
            timestamp: Date.now(),
            kind: 'tool_result',
            summary: this.getReadableSummary(toolName, result),
            toolName,
            scope: 'turn',
            sourceSurface: 'chat',
            isReusable: true,
            satisfactionScore: score,
            rawContent: typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
        };

        this.records.push(record);
        this.recalculateSatisfaction();
        return [record];
    }

    /**
     * Snapshot for synchronizing with IPC.
     */
    getSnapshot(): AiEvidenceStoreSnapshot {
        return {
            records: [...this.records],
            totalSatisfaction: this.totalSatisfaction,
            lastUpdated: Date.now()
        };
    }

    /**
     * Used when starting a new session or clearing history.
     */
    reset() {
        this.records = [];
        this.totalSatisfaction = 0;
    }

    /**
     * Merges records from the main process into the renderer store.
     * This ensures the UI reflects what the backend knows.
     */
    mergeFromMain(snapshot: AiEvidenceStoreSnapshot) {
        // Simple merge: keep unique records by ID
        const existingIds = new Set(this.records.map(r => r.id));
        const newRecords = snapshot.records.filter(r => !existingIds.has(r.id));
        this.records = [...this.records, ...newRecords];
        this.recalculateSatisfaction();
    }

    private getReadableSummary(toolName: string, result: ToolResult): string {
        if (!result.success) {return `Error: ${toolName}`;}
        if (typeof result.content === 'string') {return result.content.substring(0, 100);}
        return `Tool content for ${toolName}`;
    }

    private recalculateSatisfaction() {
        if (this.records.length === 0) {
            this.totalSatisfaction = 0;
            return;
        }
        
        // Cumulative weighted total, maxing at 1.0
        const total = this.records.reduce((acc, r) => acc + r.satisfactionScore, 0);
        this.totalSatisfaction = Math.min(1.0, total);
    }
}

/**
 * Singleton instance for the current renderer context.
 */
export const evidenceStore = new ToolEvidenceStore();

// --- LEGACY COMPATIBILITY LAYER ---

export interface ToolEvidenceState {
    evidenceRecords: AiEvidenceRecord[];
    toolMessages: Message[];
    toolCallMap: Map<string, ToolCall>;
}

const toolContentCache = new Map<string, JsonValue>();

export function createToolEvidenceState(): ToolEvidenceState {
    return {
        evidenceRecords: [],
        toolMessages: [],
        toolCallMap: new Map<string, ToolCall>(),
    };
}

export function appendEvidenceRecords(state: ToolEvidenceState, records: AiEvidenceRecord[]) {
    state.evidenceRecords.push(...records);
    // Also sync to global store
    evidenceStore.mergeFromMain({ records, totalSatisfaction: 0, lastUpdated: Date.now() });
}

export function appendToolMessages(state: ToolEvidenceState, messages: Message[]) {
    state.toolMessages.push(...messages);
}

export function rememberToolCalls(state: ToolEvidenceState, calls: ToolCall[]) {
    for (const call of calls) {
        if (call.id) {state.toolCallMap.set(call.id, call);}
    }
}

export function cacheToolContentsForSignature(signature: string, content: JsonValue) {
    toolContentCache.set(signature, content);
}

export function getCachedToolContentsForSignature(signature: string): JsonValue | undefined {
    return toolContentCache.get(signature);
}

