/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * IPC Batching utility for renderer process
 * Simplifies batching multiple IPC calls into a single request
 */

import { Folder } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { ClaudeQuota, CodexUsage, CopilotQuota, QuotaResponse } from '@shared/types/quota';
import { AppSettings } from '@shared/types/settings';
import { sanitizeObject } from '@shared/utils/sanitize.util';

import { LinkedAccountInfo } from '@/electron.d';
import type { Chat, Message, Workspace } from '@/types';
import { IpcValue } from '@/types/common';

export interface BatchRequest {
    channel: string
    args: IpcValue[]
}

export interface BatchResult {
    channel: string
    success: boolean
    data?: IpcValue
    error?: string
}

export interface BatchResponse {
    results: BatchResult[]
    timing: {
        startTime: number
        endTime: number
        totalMs: number
    }
}

/**
 * Helper to create batch requests easily
 */
export function createBatchRequest(channel: string, ...args: IpcValue[]): BatchRequest {
    return { channel, args };
}

/**
 * Execute multiple IPC calls in parallel as a single batch
 */
export async function batchInvoke(requests: BatchRequest[]): Promise<BatchResponse> {
    return window.electron.batch.invoke(requests);
}

/**
 * Execute multiple IPC calls sequentially as a single batch
 */
async function batchInvokeSequential(requests: BatchRequest[]): Promise<BatchResponse> {
    return window.electron.batch.invokeSequential(requests);
}

/**
 * Helper to extract results from batch response
 * Returns a map of channel -> result for easy access
 */
function extractBatchResults(response: BatchResponse): Map<string, IpcValue> {
    const results = new Map<string, IpcValue>();

    response.results.forEach(result => {
        if (result.success) {
            results.set(result.channel, result.data);
        } else {
            // Store error information
            results.set(result.channel, { success: false, error: result.error });
        }
    });

    return results;
}

/**
 * Higher-level utility for common batching patterns
 */
export class IPCBatcher {
    private requests: BatchRequest[] = [];

    /**
     * Add a request to the batch
     */
    add(channel: string, ...args: IpcValue[]): IPCBatcher {
        this.requests.push(createBatchRequest(channel, ...args));
        return this;
    }

    /**
     * Execute all batched requests in parallel
     */
    async execute(): Promise<Map<string, IpcValue>> {
        const response = await batchInvoke(this.requests);
        return extractBatchResults(response);
    }

    /**
     * Execute all batched requests sequentially
     */
    async executeSequential(): Promise<Map<string, IpcValue>> {
        const response = await batchInvokeSequential(this.requests);
        return extractBatchResults(response);
    }

    /**
     * Clear all requests
     */
    clear(): IPCBatcher {
        this.requests = [];
        return this;
    }

    /**
     * Get number of batched requests
     */
    size(): number {
        return this.requests.length;
    }
}

/**
 * Create a new batch builder
 */
export function createBatch(): IPCBatcher {
    return new IPCBatcher();
}

/**
 * Common batch operations - pre-built batches for frequent patterns
 */
export const CommonBatches = {
    /**
     * Load auth accounts and active account in one batch
     */
    async loadAuthState() {
        const results = await createBatch()
            .add('auth:get-linked-accounts')
            .add('auth:get-active-linked-account', 'github')
            .execute();

        return {
            accounts: (results.get('auth:get-linked-accounts') as LinkedAccountInfo[] | undefined) ?? [],
            activeAccount: (results.get('auth:get-active-linked-account') as LinkedAccountInfo | null | undefined) ?? null
        };
    },

    /**
     * Load all database entities in one batch
     */
    async loadDashboardData() {
        const results = await createBatch()
            .add('db:getAllChats')
            .add('db:getWorkspaces')
            .add('db:getFolders')
            .add('db:getStats')
            .execute();

        return {
            chats: (results.get('db:getAllChats') as Chat[] | undefined) ?? [],
            workspaces: (results.get('db:getWorkspaces') as Workspace[] | undefined) ?? [],
            folders: (results.get('db:getFolders') as Folder[] | undefined) ?? [],
            stats: (results.get('db:getStats') as { chatCount: number; messageCount: number; dbSize: number } | undefined) ?? { chatCount: 0, messageCount: 0, dbSize: 0 }
        };
    },

    /**
     * Load chat with messages in one batch
     */
    async loadChatData(chatId: string) {
        const results = await createBatch()
            .add('db:getChat', chatId)
            .add('db:getMessages', chatId)
            .execute();

        return {
            chat: (results.get('db:getChat') as Chat | null | undefined) ?? null,
            messages: (results.get('db:getMessages') as Message[] | undefined) ?? []
        };
    },

    /**
     * Load all settings and quota data in one batch
     */
    async loadSettingsData() {
        const results = await createBatch()
            .add('getSettings')
            .add('getQuota')
            .add('getCopilotQuota')
            .add('getCodexUsage')
            .add('getClaudeQuota')
            .execute();

        return {
            settings: results.get('getSettings') as AppSettings | undefined,
            quota: results.get('getQuota') as { accounts: Array<QuotaResponse & { accountId?: string; email?: string }> } | null,
            copilotQuota: results.get('getCopilotQuota') as { accounts: Array<CopilotQuota & { accountId?: string; email?: string }> } | undefined,
            codexUsage: results.get('getCodexUsage') as { accounts: Array<{ usage: CodexUsage; accountId?: string; email?: string }> } | undefined,
            claudeQuota: results.get('getClaudeQuota') as { accounts: Array<ClaudeQuota> } | undefined
        };
    },

    /**
     * Load workspace data with git info in one batch
     */
    async loadWorkspaceData(workspacePath: string) {
        const results = await createBatch()
            .add('git:getBranch', workspacePath)
            .add('git:getStatus', workspacePath)
            .add('git:getLastCommit', workspacePath)
            .add('git:getBranches', workspacePath)
            .execute();

        return {
            branch: results.get('git:getBranch') as { success: boolean; branch?: string; error?: string } | undefined,
            status: results.get('git:getStatus') as { success: boolean; isClean?: boolean; changes?: number; files?: Array<{ path: string; status: string }>; error?: string } | undefined,
            lastCommit: results.get('git:getLastCommit') as { success: boolean; hash?: string; message?: string; author?: string; relativeTime?: string; date?: string; error?: string } | undefined,
            branches: results.get('git:getBranches') as { success: boolean; branches?: string[]; error?: string } | undefined
        };
    },

    /**
     * Update multiple chats in one batch
     */
    async updateChatsBatch(updates: Array<{ id: string; updates: Partial<Chat> }>) {
        const batch = createBatch();
        updates.forEach(({ id, updates }) => {
            batch.add('db:updateChat', id, sanitizeChatUpdates(updates));
        });
        return batch.execute();
    },

    /**
     * Delete multiple chats in one batch
     */
    async deleteChatsBatch(chatIds: string[]) {
        const batch = createBatch();
        chatIds.forEach(id => {
            batch.add('db:deleteChat', id);
        });
        return batch.execute();
    }
};

function sanitizeChatUpdates(updates: Partial<Chat>): IpcValue {
    return sanitizeObject(updates as JsonObject) as IpcValue;
}

