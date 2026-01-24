/**
 * IPC Batching utility for renderer process
 * Simplifies batching multiple IPC calls into a single request
 */

export interface BatchRequest {
    channel: string
    args: any[]
}

export interface BatchResult {
    channel: string
    success: boolean
    data?: any
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
export function createBatchRequest(channel: string, ...args: any[]): BatchRequest {
    return { channel, args }
}

/**
 * Execute multiple IPC calls in parallel as a single batch
 */
export async function batchInvoke(requests: BatchRequest[]): Promise<BatchResponse> {
    return window.electron.batch.invoke(requests)
}

/**
 * Execute multiple IPC calls sequentially as a single batch
 */
export async function batchInvokeSequential(requests: BatchRequest[]): Promise<BatchResponse> {
    return window.electron.batch.invokeSequential(requests)
}

/**
 * Helper to extract results from batch response
 * Returns a map of channel -> result for easy access
 */
export function extractBatchResults(response: BatchResponse): Map<string, any> {
    const results = new Map<string, any>()
    
    response.results.forEach(result => {
        if (result.success) {
            results.set(result.channel, result.data)
        } else {
            // Store error information
            results.set(result.channel, { error: result.error })
        }
    })
    
    return results
}

/**
 * Higher-level utility for common batching patterns
 */
export class IPCBatcher {
    private requests: BatchRequest[] = []

    /**
     * Add a request to the batch
     */
    add(channel: string, ...args: any[]): IPCBatcher {
        this.requests.push(createBatchRequest(channel, ...args))
        return this
    }

    /**
     * Execute all batched requests in parallel
     */
    async execute(): Promise<Map<string, any>> {
        const response = await batchInvoke(this.requests)
        return extractBatchResults(response)
    }

    /**
     * Execute all batched requests sequentially
     */
    async executeSequential(): Promise<Map<string, any>> {
        const response = await batchInvokeSequential(this.requests)
        return extractBatchResults(response)
    }

    /**
     * Clear all requests
     */
    clear(): IPCBatcher {
        this.requests = []
        return this
    }

    /**
     * Get number of batched requests
     */
    size(): number {
        return this.requests.length
    }
}

/**
 * Create a new batch builder
 */
export function createBatch(): IPCBatcher {
    return new IPCBatcher()
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
            .execute()
        
        return {
            accounts: results.get('auth:get-linked-accounts') ?? [],
            activeAccount: results.get('auth:get-active-linked-account') ?? null
        }
    },

    /**
     * Load all database entities in one batch
     */
    async loadDashboardData() {
        const results = await createBatch()
            .add('db:getAllChats')
            .add('db:getProjects')
            .add('db:getFolders')
            .add('db:getStats')
            .execute()
        
        return {
            chats: results.get('db:getAllChats') ?? [],
            projects: results.get('db:getProjects') ?? [],
            folders: results.get('db:getFolders') ?? [],
            stats: results.get('db:getStats') ?? { chatCount: 0, messageCount: 0, dbSize: 0 }
        }
    },

    /**
     * Load chat with messages in one batch
     */
    async loadChatData(chatId: string) {
        const results = await createBatch()
            .add('db:getChat', chatId)
            .add('db:getMessages', chatId)
            .execute()
        
        return {
            chat: results.get('db:getChat'),
            messages: results.get('db:getMessages') ?? []
        }
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
            .execute()
        
        return {
            settings: results.get('getSettings'),
            quota: results.get('getQuota'),
            copilotQuota: results.get('getCopilotQuota'),
            codexUsage: results.get('getCodexUsage'),
            claudeQuota: results.get('getClaudeQuota')
        }
    },

    /**
     * Load project data with git info in one batch
     */
    async loadProjectData(projectPath: string) {
        const results = await createBatch()
            .add('git:getBranch', projectPath)
            .add('git:getStatus', projectPath)
            .add('git:getLastCommit', projectPath)
            .add('git:getBranches', projectPath)
            .execute()
        
        return {
            branch: results.get('git:getBranch'),
            status: results.get('git:getStatus'),
            lastCommit: results.get('git:getLastCommit'),
            branches: results.get('git:getBranches')
        }
    },

    /**
     * Update multiple chats in one batch
     */
    async updateChatsBatch(updates: Array<{ id: string; updates: Partial<any> }>) {
        const batch = createBatch()
        updates.forEach(({ id, updates }) => {
            batch.add('db:updateChat', id, updates)
        })
        return batch.execute()
    },

    /**
     * Delete multiple chats in one batch
     */
    async deleteChatsBatch(chatIds: string[]) {
        const batch = createBatch()
        chatIds.forEach(id => {
            batch.add('db:deleteChat', id)
        })
        return batch.execute()
    }
}