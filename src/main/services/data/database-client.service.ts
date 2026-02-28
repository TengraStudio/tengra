/**
 * Database Client Service
 *
 * HTTP client for communicating with the standalone Rust database service.
 * This service provides the same interface as DatabaseService but uses
 * HTTP calls to the external db-service.
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import {
    DbApiResponse,
    DbChat,
    DbCodeSymbol,
    DbCreateChatRequest,
    DbCreateFolderRequest,
    DbCreateMessageRequest,
    DbCreateProjectRequest,
    DbCreatePromptRequest,
    DbFolder,
    DbGetMarketplaceModelsRequest,
    DbHealthResponse,
    DbMarketplaceModel,
    DbMessage,
    DbProject,
    DbPrompt,
    DbQueryRequest,
    DbQueryResponse,
    DbSearchMarketplaceModelsRequest,
    DbSemanticFragment,
    DbStats,
    DbStoreCodeSymbolRequest,
    DbStoreSemanticFragmentRequest,
    DbUpdateChatRequest,
    DbUpdateFolderRequest,
    DbUpdateMessageRequest,
    DbUpdateProjectRequest,
    DbUpdatePromptRequest,
    DbUpsertMarketplaceModelsRequest,
    DbVectorSearchRequest,
} from '@shared/types/db-api';
import { delay } from '@shared/utils/delay.util';
import { getErrorMessage } from '@shared/utils/error.util';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { app } from 'electron';

/** PERF-117: Cached port file entry with TTL */
interface PortFileCacheEntry {
    content: string;
    timestamp: number;
}

/** PERF-117: TTL for port file cache in milliseconds */
const PORT_FILE_CACHE_TTL_MS = 5_000;

const SERVICE_NAME = 'db-service';
const MAX_HEALTH_RETRIES = 30;
const HEALTH_RETRY_DELAY_MS = 500;

// PERF-003-4: HTTP agent configuration for connection pooling
const HTTP_AGENT_CONFIG = {
    keepAlive: true, // Enable keep-alive connections
    keepAliveMsecs: 1000, // Initial delay for keep-alive probes
    maxSockets: 10, // Maximum concurrent sockets per host
    maxFreeSockets: 5, // Maximum idle sockets to keep in pool
    timeout: 60000, // Socket timeout in ms
};

/**
 * Database Client Service - communicates with the standalone Rust database service
 */
export class DatabaseClientService extends BaseService {
    private apiClient: AxiosInstance;
    private servicePort: number | null = null;
    private isReady = false;
    // PERF-003-4: HTTP agent for connection pooling
    private httpAgent: http.Agent;
    private pendingRequests = 0;
    private maxPendingRequests = 200;
    private totalRequests = 0;
    private failedRequests = 0;
    private lastRequestAt?: number;

    /** PERF-117: Cache for port file reads to avoid repeated synchronous I/O */
    private portFileCache = new Map<string, PortFileCacheEntry>();

    constructor(
        private eventBus: EventBusService,
        private processManager: ProcessManagerService
    ) {
        super('DatabaseClientService');

        // PERF-003-4: Create reusable HTTP agent with connection pooling
        this.httpAgent = new http.Agent(HTTP_AGENT_CONFIG);

        this.apiClient = axios.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
            // PERF-003-4: Use connection pooling agent
            httpAgent: this.httpAgent,
        });
    }

    /** Validates that a value is a non-empty string safe for URL path segments. */
    private validatePathId(value: unknown, label: string): asserts value is string {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${label} must be a non-empty string`);
        }
        if (!/^[\w\-.:]+$/.test(value)) {
            throw new Error(`${label} contains invalid characters`);
        }
    }

    /** Validates that a value is a non-empty string. */
    private validateRequiredString(value: unknown, label: string): asserts value is string {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${label} must be a non-empty string`);
        }
    }

    /** Validates that a value is an array. */
    private validateArray(value: unknown, label: string): asserts value is unknown[] {
        if (!Array.isArray(value)) {
            throw new Error(`${label} must be an array`);
        }
    }

    /**
     * Initialize the database client
     */
    override async initialize(): Promise<void> {
        this.logInfo('Initializing database client...');

        try {
            // Discover or start the db-service
            this.servicePort = await this.discoverOrStartService();

            if (!this.servicePort) {
                throw new Error('Failed to discover or start db-service');
            }

            // Wait for health check
            await this.waitForHealth();

            // Listen for service restarts
            this.processManager.on(`${SERVICE_NAME}:ready`, (newPort: number) => {
                this.logInfo(`db-service restarted, updating port to ${newPort}`);
                this.servicePort = newPort;
                this.isReady = true;
            });

            this.isReady = true;
            this.eventBus.emit('db:ready', { timestamp: Date.now() });
            this.logInfo(`Connected to db-service on port ${this.servicePort}`);
        } catch (error) {
            this.logError('Failed to initialize database client', error);
            this.eventBus.emit('db:error', { error: getErrorMessage(error) });
            throw error;
        }
    }

    /**
     * Discover existing service or start a new one
     */
    private async discoverOrStartService(): Promise<number | null> {
        // Try to discover existing service
        const existingPort = await this.discoverService();
        if (existingPort) {
            this.logInfo(`Discovered existing db-service on port ${existingPort}`);
            return existingPort;
        }

        // Start new service
        this.logInfo('Starting db-service...');
        await this.processManager.startService({
            name: SERVICE_NAME,
            executable: 'tengra-db-service',
            args: ['--console'], // Run in console mode, not as Windows Service
            persistent: true,
        });

        // Wait for port file to appear
        const maxAttempts = 50;
        for (let i = 0; i < maxAttempts; i++) {
            const port = await this.discoverService();
            if (port) {
                return port;
            }
            const managedPort = this.processManager.getServicePort(SERVICE_NAME);
            if (managedPort) {
                this.logInfo(`Using managed db-service port from process manager: ${managedPort}`);
                return managedPort;
            }
            await delay(100);
        }

        return null;
    }

    /**
     * Discover the service port from the port file
     */
    private async discoverService(): Promise<number | null> {
        const portFiles = this.getPortFileCandidates();
        for (const portFile of portFiles) {
            try {
                await fsPromises.access(portFile, fs.constants.F_OK);
            } catch {
                continue;
            }

            try {
                const content = this.readPortFileCached(portFile);
                const port = parseInt(content, 10);
                if (isNaN(port)) {
                    continue;
                }

                // Verify the port is open
                const isOpen = await this.isPortOpen(port);
                if (!isOpen) {
                    // Clean up stale port file
                    try {
                        await fsPromises.unlink(portFile);
                        this.portFileCache.delete(portFile);
                    } catch {
                        /* ignore */
                    }
                    continue;
                }

                return port;
            } catch {
                continue;
            }
        }

        return null;
    }

    /** PERF-117: Read port file with caching to avoid repeated synchronous I/O */
    private readPortFileCached(filePath: string): string {
        const now = Date.now();
        const cached = this.portFileCache.get(filePath);
        if (cached && (now - cached.timestamp) < PORT_FILE_CACHE_TTL_MS) {
            return cached.content;
        }

        const content = fs.readFileSync(filePath, 'utf8').trim();
        this.portFileCache.set(filePath, { content, timestamp: now });
        return content;
    }

    /**
     * Get the port file path
     */
    private getPortFileCandidates(): string[] {
        const appData = app.getPath('appData');
        const roots = ['Tengra', 'tengra'];
        return roots.map(root => path.join(appData, root, 'services', `${SERVICE_NAME}.port`));
    }

    /**
     * Check if a port is open
     */
    private isPortOpen(port: number): Promise<boolean> {
        return new Promise(resolve => {
            const socket = new net.Socket();
            socket.setTimeout(OPERATION_TIMEOUTS.PORT_CHECK_FAST);
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });
            socket.connect(port, '127.0.0.1');
        });
    }

    /**
     * Wait for the service to become healthy
     */
    private async waitForHealth(): Promise<void> {
        for (let i = 0; i < MAX_HEALTH_RETRIES; i++) {
            try {
                const response = await this.getHealth();
                if (response.success && response.data?.status === 'healthy') {
                    this.logInfo(`db-service healthy (v${response.data.version})`);
                    return;
                }
            } catch {
                // Continue retrying
            }
            await delay(HEALTH_RETRY_DELAY_MS);
        }
        throw new Error('db-service health check timed out');
    }

    /**
     * Make an API call to the db-service with retry on connection failure
     */
    private async apiCall<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: string,
        data?: unknown,
        isRetry = false
    ): Promise<DbApiResponse<T>> {
        if (!this.servicePort) {
            throw new Error('db-service not connected');
        }
        if (this.pendingRequests >= this.maxPendingRequests) {
            return {
                success: false,
                error: `Connection pool overflow: pending=${this.pendingRequests}, max=${this.maxPendingRequests}`
            };
        }

        const url = `http://127.0.0.1:${this.servicePort}${path}`;
        this.pendingRequests += 1;
        this.totalRequests += 1;
        this.lastRequestAt = Date.now();

        try {
            const response = await this.apiClient.request({
                method,
                url,
                data,
            });
            return response.data as DbApiResponse<T>;
        } catch (error) {
            this.failedRequests += 1;
            const isConnectionError =
                axios.isAxiosError(error) &&
                (error.code === 'ECONNREFUSED' ||
                    error.code === 'ETIMEDOUT' ||
                    error.code === 'ECONNRESET');

            if (isConnectionError && !isRetry) {
                this.logWarn(
                    `Connection to db-service failed (${(error as AxiosError).code}). Attempting to re-discover...`
                );
                // Try to discover new port
                const newPort = await this.discoverService();
                if (newPort && newPort !== this.servicePort) {
                    this.logInfo(`Discovered new port for db-service: ${newPort}. Retrying...`);
                    this.servicePort = newPort;
                    return this.apiCall<T>(method, path, data, true);
                }
            }

            this.logError(`API call failed: ${method} ${path}`, error);
            return {
                success: false,
                error: getErrorMessage(error),
            };
        } finally {
            this.pendingRequests = Math.max(0, this.pendingRequests - 1);
        }
    }

    setPoolLimits(config: { maxSockets?: number; maxFreeSockets?: number; maxPendingRequests?: number }): void {
        if (typeof config.maxPendingRequests === 'number') {
            this.maxPendingRequests = Math.max(1, config.maxPendingRequests);
        }
        if (typeof config.maxSockets === 'number') {
            this.httpAgent.maxSockets = Math.max(1, config.maxSockets);
        }
        if (typeof config.maxFreeSockets === 'number') {
            this.httpAgent.maxFreeSockets = Math.max(1, config.maxFreeSockets);
        }
    }

    async recycleConnectionPool(): Promise<void> {
        this.httpAgent.destroy();
        this.httpAgent = new http.Agent({
            ...HTTP_AGENT_CONFIG,
            maxSockets: this.httpAgent.maxSockets,
            maxFreeSockets: this.httpAgent.maxFreeSockets
        });
        this.apiClient.defaults.httpAgent = this.httpAgent;
    }

    async testConnection(timeoutMs = 5_000): Promise<{ healthy: boolean; latencyMs: number }> {
        const startedAt = Date.now();
        const healthPromise = this.getHealth();
        const timeoutPromise = new Promise<DbApiResponse<DbHealthResponse>>((resolve) => {
            setTimeout(() => resolve({ success: false, error: 'timeout' }), timeoutMs);
        });
        const health = await Promise.race([healthPromise, timeoutPromise]);
        const latencyMs = Date.now() - startedAt;
        return { healthy: health.success, latencyMs };
    }

    getConnectionPoolMetrics(): {
        maxSockets: number;
        maxFreeSockets: number;
        pendingRequests: number;
        maxPendingRequests: number;
        totalRequests: number;
        failedRequests: number;
        errorRate: number;
        lastRequestAt?: number;
    } {
        const errorRate = this.totalRequests > 0 ? this.failedRequests / this.totalRequests : 0;
        return {
            maxSockets: this.httpAgent.maxSockets,
            maxFreeSockets: this.httpAgent.maxFreeSockets,
            pendingRequests: this.pendingRequests,
            maxPendingRequests: this.maxPendingRequests,
            totalRequests: this.totalRequests,
            failedRequests: this.failedRequests,
            errorRate,
            lastRequestAt: this.lastRequestAt
        };
    }

    // ========================================================================
    // Health
    // ========================================================================

    async getHealth(): Promise<DbApiResponse<DbHealthResponse>> {
        return this.apiCall<DbHealthResponse>('GET', '/health');
    }

    // ========================================================================
    // Chat Operations
    // ========================================================================

    async getAllChats(): Promise<DbChat[]> {
        const response = await this.apiCall<DbChat[]>('GET', '/api/v1/chats');
        return response.data ?? [];
    }

    async getChat(id: string): Promise<DbChat | null> {
        this.validatePathId(id, 'chatId');
        const response = await this.apiCall<DbChat | null>('GET', `/api/v1/chats/${id}`);
        return response.data ?? null;
    }

    async createChat(
        req: DbCreateChatRequest
    ): Promise<{ success: boolean; chat?: DbChat; error?: string }> {
        this.validateRequiredString(req.title, 'title');
        const response = await this.apiCall<DbChat>('POST', '/api/v1/chats', req);
        return {
            success: response.success,
            chat: response.data,
            error: response.error,
        };
    }

    async updateChat(id: string, updates: DbUpdateChatRequest): Promise<boolean> {
        this.validatePathId(id, 'chatId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/chats/${id}`, updates);
        return response.data ?? false;
    }

    async deleteChat(id: string): Promise<boolean> {
        this.validatePathId(id, 'chatId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/chats/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Message Operations
    // ========================================================================

    async getMessages(chatId: string): Promise<DbMessage[]> {
        this.validatePathId(chatId, 'chatId');
        const response = await this.apiCall<DbMessage[]>('GET', `/api/v1/chats/${chatId}/messages`);
        return response.data ?? [];
    }

    async addMessage(
        req: DbCreateMessageRequest
    ): Promise<{ success: boolean; message?: DbMessage; error?: string }> {
        this.validateRequiredString(req.chat_id, 'chat_id');
        this.validateRequiredString(req.role, 'role');
        const response = await this.apiCall<DbMessage>('POST', '/api/v1/messages', req);
        return {
            success: response.success,
            message: response.data,
            error: response.error,
        };
    }

    async updateMessage(id: string, updates: DbUpdateMessageRequest): Promise<boolean> {
        this.validatePathId(id, 'messageId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/messages/${id}`, updates);
        return response.data ?? false;
    }

    async deleteMessage(id: string): Promise<boolean> {
        this.validatePathId(id, 'messageId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/messages/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Project Operations
    // ========================================================================

    async getProjects(): Promise<DbProject[]> {
        const response = await this.apiCall<DbProject[]>('GET', '/api/v1/projects');
        return response.data ?? [];
    }

    async getProject(id: string): Promise<DbProject | null> {
        this.validatePathId(id, 'projectId');
        const response = await this.apiCall<DbProject | null>('GET', `/api/v1/projects/${id}`);
        return response.data ?? null;
    }

    async createProject(
        req: DbCreateProjectRequest
    ): Promise<{ success: boolean; project?: DbProject; error?: string }> {
        this.validateRequiredString(req.title, 'title');
        this.validateRequiredString(req.path, 'path');
        const response = await this.apiCall<DbProject>('POST', '/api/v1/projects', req);
        return {
            success: response.success,
            project: response.data,
            error: response.error,
        };
    }

    async updateProject(id: string, updates: DbUpdateProjectRequest): Promise<boolean> {
        this.validatePathId(id, 'projectId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/projects/${id}`, updates);
        return response.data ?? false;
    }

    async deleteProject(id: string): Promise<boolean> {
        this.validatePathId(id, 'projectId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/projects/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Folder Operations
    // ========================================================================

    async getFolders(): Promise<DbFolder[]> {
        const response = await this.apiCall<DbFolder[]>('GET', '/api/v1/folders');
        return response.data ?? [];
    }

    async createFolder(
        req: DbCreateFolderRequest
    ): Promise<{ success: boolean; folder?: DbFolder; error?: string }> {
        this.validateRequiredString(req.name, 'name');
        const response = await this.apiCall<DbFolder>('POST', '/api/v1/folders', req);
        return {
            success: response.success,
            folder: response.data,
            error: response.error,
        };
    }

    async updateFolder(id: string, updates: DbUpdateFolderRequest): Promise<boolean> {
        this.validatePathId(id, 'folderId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/folders/${id}`, updates);
        return response.data ?? false;
    }

    async deleteFolder(id: string): Promise<boolean> {
        this.validatePathId(id, 'folderId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/folders/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Prompt Operations
    // ========================================================================

    async getPrompts(): Promise<DbPrompt[]> {
        const response = await this.apiCall<DbPrompt[]>('GET', '/api/v1/prompts');
        return response.data ?? [];
    }

    async createPrompt(
        req: DbCreatePromptRequest
    ): Promise<{ success: boolean; prompt?: DbPrompt; error?: string }> {
        this.validateRequiredString(req.title, 'title');
        this.validateRequiredString(req.content, 'content');
        const response = await this.apiCall<DbPrompt>('POST', '/api/v1/prompts', req);
        return {
            success: response.success,
            prompt: response.data,
            error: response.error,
        };
    }

    async updatePrompt(id: string, updates: DbUpdatePromptRequest): Promise<boolean> {
        this.validatePathId(id, 'promptId');
        const response = await this.apiCall<boolean>('PUT', `/api/v1/prompts/${id}`, updates);
        return response.data ?? false;
    }

    async deletePrompt(id: string): Promise<boolean> {
        this.validatePathId(id, 'promptId');
        const response = await this.apiCall<boolean>('DELETE', `/api/v1/prompts/${id}`);
        return response.data ?? false;
    }

    // ========================================================================
    // Knowledge Operations
    // ========================================================================

    async storeCodeSymbol(req: DbStoreCodeSymbolRequest): Promise<void> {
        this.validateRequiredString(req.name, 'name');
        this.validateRequiredString(req.project_path, 'project_path');
        this.validateRequiredString(req.file_path, 'file_path');
        await this.apiCall<void>('POST', '/api/v1/knowledge/symbols', req);
    }

    async searchCodeSymbols(req: DbVectorSearchRequest): Promise<DbCodeSymbol[]> {
        this.validateArray(req.embedding, 'embedding');
        const response = await this.apiCall<DbCodeSymbol[]>(
            'POST',
            '/api/v1/knowledge/symbols/search',
            req
        );
        return response.data ?? [];
    }

    async storeSemanticFragment(req: DbStoreSemanticFragmentRequest): Promise<void> {
        this.validateRequiredString(req.content, 'content');
        this.validateRequiredString(req.source, 'source');
        this.validateRequiredString(req.source_id, 'source_id');
        this.validateArray(req.embedding, 'embedding');
        await this.apiCall<void>('POST', '/api/v1/knowledge/fragments', req);
    }

    async searchSemanticFragments(req: DbVectorSearchRequest): Promise<DbSemanticFragment[]> {
        this.validateArray(req.embedding, 'embedding');
        const response = await this.apiCall<DbSemanticFragment[]>(
            'POST',
            '/api/v1/knowledge/fragments/search',
            req
        );
        return response.data ?? [];
    }

    // ========================================================================
    // Stats Operations
    // ========================================================================

    async getStats(): Promise<DbStats> {
        const response = await this.apiCall<DbStats>('GET', '/api/v1/stats');
        return (
            response.data ?? {
                chatCount: 0,
                messageCount: 0,
                dbSize: 0,
            }
        );
    }

    // ========================================================================
    // Raw Query Operations
    // ========================================================================

    async executeQuery(req: DbQueryRequest): Promise<DbQueryResponse> {
        this.validateRequiredString(req.sql, 'sql');
        if (req.params !== undefined) {
            this.validateArray(req.params, 'params');
        }
        const response = await this.apiCall<DbQueryResponse>('POST', '/api/v1/query', req);
        return response.data ?? { rows: [], affected_rows: 0 };
    }

    // ========================================================================
    // Marketplace Model Operations
    // ========================================================================

    async getMarketplaceModels(
        req?: DbGetMarketplaceModelsRequest
    ): Promise<DbMarketplaceModel[]> {
        const params = new URLSearchParams();
        if (req?.provider) {params.append('provider', req.provider);}
        if (req?.limit) {params.append('limit', String(req.limit));}
        if (req?.offset) {params.append('offset', String(req.offset));}

        const queryString = params.toString();
        const path = `/api/v1/marketplace/models${queryString ? `?${queryString}` : ''}`;
        const response = await this.apiCall<{ models: DbMarketplaceModel[]; total: number }>('GET', path);
        return response.data?.models ?? [];
    }

    async upsertMarketplaceModels(
        req: DbUpsertMarketplaceModelsRequest
    ): Promise<{ success: boolean; count: number; error?: string }> {
        this.validateArray(req.models, 'models');
        const response = await this.apiCall<{ count: number }>(
            'POST',
            '/api/v1/marketplace/models',
            req
        );
        return {
            success: response.success,
            count: response.data?.count ?? 0,
            error: response.error,
        };
    }

    async searchMarketplaceModels(
        req: DbSearchMarketplaceModelsRequest
    ): Promise<DbMarketplaceModel[]> {
        this.validateRequiredString(req.query, 'query');
        const response = await this.apiCall<{ models: DbMarketplaceModel[]; total: number }>(
            'POST',
            '/api/v1/marketplace/models/search',
            req
        );
        return response.data?.models ?? [];
    }

    async clearMarketplaceModels(provider?: 'ollama' | 'huggingface'): Promise<boolean> {
        const params = provider ? `?provider=${provider}` : '';
        const response = await this.apiCall<boolean>(
            'DELETE',
            `/api/v1/marketplace/models${params}`
        );
        return response.data ?? false;
    }

    // ========================================================================
    // Lifecycle
    // ========================================================================

    /**
     * Check if the service is ready
     */
    isConnected(): boolean {
        return this.isReady && this.servicePort !== null;
    }

    /**
     * Cleanup resources
     */
    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up database client...');
        this.isReady = false;

        // PERF-003-4: Destroy HTTP agent and close all pooled connections
        this.httpAgent.destroy();

        // PERF-117: Clear port file cache
        this.portFileCache.clear();

        // Note: We don't stop the service as it's persistent
    }
}
