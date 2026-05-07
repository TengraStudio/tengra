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
import { ToolResult } from '@shared/types/chat';

/**
 * Normalizes tool results and content into evidence records for the main process.
 * This handles session-scoped evidence that persists across the conversation lifecycle.
 */
export class SessionEvidenceStore {
    private records: AiEvidenceRecord[] = [];
    private satisfactionScore: number = 0;

    constructor() {}

    /**
     * Converts a raw tool result into one or more evidence records.
     */
    addToolResult(
        toolName: string, 
        result: ToolResult, 
    ): AiEvidenceRecord[] {
        const timestamp = Date.now();
        const id = `ev-${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
        
        // Simple heuristic for satisfaction score based on result length/content
        // This will be refined as we add deterministic handlers
        let score = 0.1;
        if (result.success) {
            score = 0.5;
            const contentStr = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
            if (contentStr.length > 50) {score = 0.8;}
            if (result.isComplete) {score = 1.0;}
        }

        const record: AiEvidenceRecord = {
            id,
            timestamp,
            kind: 'tool_result',
            summary: this.summarizeToolResult(toolName, result),
            toolName,
            scope: 'session',
            sourceSurface: 'chat',
            isReusable: true,
            satisfactionScore: score,
            rawContent: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
            intentRelationship: 'supporting'
        };

        this.records.push(record);
        this.updateTotalSatisfaction();
        return [record];
    }

    /**
     * Clears all session evidence records.
     */
    reset() {
        this.records = [];
        this.satisfactionScore = 0;
    }

    /**
     * Captures content evidence from assistant responses.
     */
    addContentEvidence(content: string): AiEvidenceRecord {
        const timestamp = Date.now();
        const id = `ev-content-${timestamp}`;
        
        const record: AiEvidenceRecord = {
            id,
            timestamp,
            kind: 'content',
            summary: content.substring(0, 100),
            scope: 'session',
            sourceSurface: 'chat',
            isReusable: false,
            satisfactionScore: 0.2, // content itself is low evidence until verified
            rawContent: content
        };

        this.records.push(record);
        this.updateTotalSatisfaction();
        return record;
    }

    getSnapshot(): AiEvidenceStoreSnapshot {
        return {
            records: [...this.records],
            totalSatisfaction: this.satisfactionScore,
            lastUpdated: Date.now()
        };
    }

    clear() {
        this.records = [];
        this.satisfactionScore = 0;
    }

    private summarizeToolResult(toolName: string, result: ToolResult): string {
        if (!result.success) {
            return `Failed: ${toolName}`;
        }
        if (typeof result.content === 'string') {
            return result.content.substring(0, 100);
        }
        return `Success: ${toolName}`;
    }

    private updateTotalSatisfaction() {
        if (this.records.length === 0) {
            this.satisfactionScore = 0;
            return;
        }
        
        // Cumulative weighted average of satisfaction scores
        const sum = this.records.reduce((acc, r) => acc + r.satisfactionScore, 0);
        this.satisfactionScore = Math.min(1.0, sum / (this.records.length > 0 ? this.records.length : 1) * 1.2); 
    }
}

/**
 * Singleton instance for the current session context in the main process.
 */
export const sessionEvidenceStore = new SessionEvidenceStore();

// --- LEGACY COMPATIBILITY LAYER ---

export function createSessionEvidenceState() {
    return sessionEvidenceStore;
}

export function recordContentAsEvidence(store: SessionEvidenceStore, content: string) {
    return store.addContentEvidence(content);
}

export function recordToolResultAsEvidence(store: SessionEvidenceStore, toolName: string, result: ToolResult) {
    return store.addToolResult(toolName, result);
}


